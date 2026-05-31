import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { chainForNetwork } from "@/lib/contracts/chain";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oracleRuns } from "@/lib/db/schema";
import { aggregateUserScores } from "@/lib/fpl/scoring";
import { FplScoreProvider } from "@/lib/scoring/fpl-provider";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolvePoolById } from "@/lib/contracts/factory";
import { fechaRound } from "@/lib/tournaments/seasons";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * End-to-end finalize of ONE fecha (gameweek pool): submitScores -> finalizeAndDistribute.
 * ?t=<tournamentId> selects the fecha; its FPL round comes from the season config.
 * On-chain state decides which phase to run; both phases are idempotent so the
 * retry cron can re-run safely and pick up a partial run.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const tParam = req.nextUrl.searchParams.get("t");
  if (tParam === null) {
    return NextResponse.json({ ok: false, reason: "missing ?t=<tournamentId>" }, { status: 400 });
  }
  const tournamentId = Number(tParam);
  const round = fechaRound(tournamentId);
  if (round === undefined) {
    return NextResponse.json({ ok: false, reason: `tournamentId ${tournamentId} not in season config` }, { status: 400 });
  }

  const db = getDb();
  const network = DEFAULT_NETWORK;
  const chain = chainForNetwork(network);
  const publicClient = createPublicClient({ chain, transport: http() });

  const poolAddr = await resolvePoolById(publicClient, network, tournamentId);
  if (!poolAddr) {
    return NextResponse.json({ ok: false, reason: `pool not found for tournamentId ${tournamentId}` }, { status: 500 });
  }

  const [scoresSubmittedOnChain, finalizedOnChain, emergencyActiveOnChain] = await Promise.all([
    publicClient.readContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "scoresSubmitted" }) as Promise<boolean>,
    publicClient.readContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "finalized" }) as Promise<boolean>,
    publicClient.readContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "emergencyActive" }) as Promise<boolean>,
  ]);

  if (emergencyActiveOnChain) {
    return NextResponse.json({ ok: false, reason: "emergencyActive — emergency path supersedes finalize" });
  }
  if (finalizedOnChain) {
    return NextResponse.json({ ok: true, reason: "already finalized" });
  }

  if (!process.env.ORACLE_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, reason: "ORACLE_PRIVATE_KEY not configured" }, { status: 500 });
  }
  const oracleAccount = privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ chain, account: oracleAccount, transport: http() });

  let submitTxHash: `0x${string}` | undefined;

  // ── Phase 1 — submitScores (only if not already done) ──
  if (!scoresSubmittedOnChain) {
    const settled = await FplScoreProvider.isRoundSettled(round).catch(() => false);
    if (!settled) {
      await db.insert(oracleRuns).values({ mw: round, status: "skipped", error: `round ${round} not settled` });
      return NextResponse.json({ ok: false, reason: "not settled, will retry" });
    }
    const roundMap = await FplScoreProvider.getRoundPoints(round);

    const numParticipants = (await publicClient.readContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "participantsLength" })) as bigint;
    if (numParticipants === BigInt(0)) {
      return NextResponse.json({ ok: false, reason: "no participants" });
    }
    const participants: `0x${string}`[] = [];
    for (let i = BigInt(0); i < numParticipants; i += BigInt(1)) {
      participants.push((await publicClient.readContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "participants", args: [i] })) as `0x${string}`);
    }
    const lineups: Record<string, readonly [number, number, number, number, number]> = {};
    for (const user of participants) {
      lineups[user] = (await publicClient.readContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "getLineup", args: [user] })) as readonly [number, number, number, number, number];
    }

    const scoreList = aggregateUserScores(lineups, roundMap);
    const users = scoreList.map((s) => s.user as `0x${string}`);
    const points = scoreList.map((s) => BigInt(s.points));
    const randomSeed = ("0x" + crypto.randomBytes(32).toString("hex")) as `0x${string}`;

    const [runRow] = await db.insert(oracleRuns).values({ mw: round, status: "pending", randomSeed }).returning({ id: oracleRuns.id });
    try {
      submitTxHash = await walletClient.writeContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "submitScores", args: [users, points, BigInt(randomSeed)] });
      await db.update(oracleRuns).set({ status: "submitted", txHash: submitTxHash }).where(eq(oracleRuns.id, runRow.id));
      await publicClient.waitForTransactionReceipt({ hash: submitTxHash });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await db.update(oracleRuns).set({ status: "failed", error: err }).where(eq(oracleRuns.id, runRow.id));
      return NextResponse.json({ ok: false, phase: "submit", error: err }, { status: 500 });
    }
  }

  // ── Phase 2 — finalizeAndDistribute (always runs if we get here) ──
  const [finalizeRunRow] = await db.insert(oracleRuns).values({ mw: round, status: "finalizing" }).returning({ id: oracleRuns.id });
  let finalizeTxHash: `0x${string}`;
  try {
    finalizeTxHash = await walletClient.writeContract({ address: poolAddr, abi: pick5PoolAbi, functionName: "finalizeAndDistribute" });
    await db.update(oracleRuns).set({ status: "finalized", txHash: finalizeTxHash }).where(eq(oracleRuns.id, finalizeRunRow.id));
    await publicClient.waitForTransactionReceipt({ hash: finalizeTxHash });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await db.update(oracleRuns).set({ status: "failed", error: err }).where(eq(oracleRuns.id, finalizeRunRow.id));
    return NextResponse.json({ ok: false, phase: "finalize", submitTxHash, error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tournamentId, round, submitTxHash: submitTxHash ?? null, submitSkipped: !submitTxHash, finalizeTxHash });
}
