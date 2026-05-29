import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { celo, celoAlfajores, celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oracleRuns } from "@/lib/db/schema";
import { aggregateUserScores } from "@/lib/fpl/scoring";
import { FplScoreProvider } from "@/lib/scoring/fpl-provider";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK, poolAddress } from "@/lib/contracts/addresses";
import type { Network } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getChain(network: Network) {
  if (network === "celo") return celo;
  if (network === "alfajores") return celoAlfajores;
  if (network === "celo-sepolia") return celoSepolia;
  return celoAlfajores;
}

/**
 * End-to-end finalize: submitScores → finalizeAndDistribute.
 *
 * On-chain state is the source of truth for which phase to run. The DB
 * `oracle_runs` table is an audit log, not a gate. Both phases are
 * independently idempotent (the contract reverts AlreadyFinalized /
 * AlreadySubmitted), so re-running this handler from the retry cron is
 * always safe and naturally picks up wherever the previous run left off.
 *
 *   scoresSubmitted=false, finalized=false  → run submitScores, then finalize
 *   scoresSubmitted=true,  finalized=false  → skip submit, run finalize
 *   scoresSubmitted=true,  finalized=true   → no-op (already done)
 *   emergencyActive=true                    → abort (emergency path supersedes)
 */
export async function GET(req: NextRequest) {
  // Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const mwParam = req.nextUrl.searchParams.get("mw");
  const mw = Number(mwParam ?? 38);
  if (mw !== 38) {
    return NextResponse.json({
      ok: false,
      reason:
        "only mw=38 triggers final submitScores; intermediate MWs update leaderboard cache only",
    });
  }

  const db = getDb();
  const network = DEFAULT_NETWORK;
  const chain = getChain(network);
  const publicClient = createPublicClient({ chain, transport: http() });
  const poolAddr = poolAddress(network);

  if (poolAddr === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json(
      { ok: false, reason: "pool address not configured for network " + network },
      { status: 500 },
    );
  }

  // Read on-chain truth — decides which phases to run.
  const [scoresSubmittedOnChain, finalizedOnChain, emergencyActiveOnChain] =
    await Promise.all([
      publicClient.readContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "scoresSubmitted",
      }) as Promise<boolean>,
      publicClient.readContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "finalized",
      }) as Promise<boolean>,
      publicClient.readContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "emergencyActive",
      }) as Promise<boolean>,
    ]);

  if (emergencyActiveOnChain) {
    return NextResponse.json({
      ok: false,
      reason: "emergencyActive — emergency path supersedes finalize",
    });
  }
  if (finalizedOnChain) {
    return NextResponse.json({ ok: true, reason: "already finalized" });
  }

  if (!process.env.ORACLE_PRIVATE_KEY) {
    return NextResponse.json(
      { ok: false, reason: "ORACLE_PRIVATE_KEY not configured" },
      { status: 500 },
    );
  }
  const oracleAccount = privateKeyToAccount(
    process.env.ORACLE_PRIVATE_KEY as `0x${string}`,
  );
  const walletClient = createWalletClient({
    chain,
    account: oracleAccount,
    transport: http(),
  });

  let submitTxHash: `0x${string}` | undefined;

  // ────────────────────────────────────────────────────────────────────
  // Phase 1 — submitScores (only if not already done)
  // ────────────────────────────────────────────────────────────────────
  if (!scoresSubmittedOnChain) {
    const settled37 = await FplScoreProvider.isRoundSettled(37).catch(() => false);
    const settled38 = await FplScoreProvider.isRoundSettled(38).catch(() => false);
    if (!settled37 || !settled38) {
      await db.insert(oracleRuns).values({
        mw,
        status: "skipped",
        error: `settled37=${settled37} settled38=${settled38}`,
      });
      return NextResponse.json({ ok: false, reason: "not settled, will retry" });
    }

    const [m37, m38] = await Promise.all([
      FplScoreProvider.getRoundPoints(37),
      FplScoreProvider.getRoundPoints(38),
    ]);

    const numParticipants = (await publicClient.readContract({
      address: poolAddr,
      abi: pick5PoolAbi,
      functionName: "participantsLength",
    })) as bigint;
    if (numParticipants === BigInt(0)) {
      return NextResponse.json({ ok: false, reason: "no participants" });
    }

    const participants: `0x${string}`[] = [];
    for (let i = BigInt(0); i < numParticipants; i += BigInt(1)) {
      const p = (await publicClient.readContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "participants",
        args: [i],
      })) as `0x${string}`;
      participants.push(p);
    }

    const lineups: Record<
      string,
      readonly [number, number, number, number, number]
    > = {};
    for (const user of participants) {
      const lineup = (await publicClient.readContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "getLineup",
        args: [user],
      })) as readonly [number, number, number, number, number];
      lineups[user] = lineup;
    }

    const scoreList = aggregateUserScores(lineups, m37, m38);
    const users = scoreList.map((s) => s.user as `0x${string}`);
    const points = scoreList.map((s) => BigInt(s.points));

    const randomSeed = ("0x" +
      crypto.randomBytes(32).toString("hex")) as `0x${string}`;

    const [runRow] = await db
      .insert(oracleRuns)
      .values({ mw, status: "pending", randomSeed })
      .returning({ id: oracleRuns.id });

    try {
      submitTxHash = await walletClient.writeContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "submitScores",
        args: [users, points, BigInt(randomSeed)],
      });
      await db
        .update(oracleRuns)
        .set({ status: "submitted", txHash: submitTxHash })
        .where(eq(oracleRuns.id, runRow.id));
      // Wait for the submit tx to land before we send the finalize tx — same
      // wallet, back-to-back writes need confirmed nonce + the contract needs
      // scoresSubmitted=true visible at finalize time.
      await publicClient.waitForTransactionReceipt({ hash: submitTxHash });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await db
        .update(oracleRuns)
        .set({ status: "failed", error: err })
        .where(eq(oracleRuns.id, runRow.id));
      return NextResponse.json({ ok: false, phase: "submit", error: err }, { status: 500 });
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Phase 2 — finalizeAndDistribute (always runs if we get here)
  // ────────────────────────────────────────────────────────────────────
  const [finalizeRunRow] = await db
    .insert(oracleRuns)
    .values({ mw, status: "finalizing" })
    .returning({ id: oracleRuns.id });

  let finalizeTxHash: `0x${string}`;
  try {
    finalizeTxHash = await walletClient.writeContract({
      address: poolAddr,
      abi: pick5PoolAbi,
      functionName: "finalizeAndDistribute",
    });
    await db
      .update(oracleRuns)
      .set({ status: "finalized", txHash: finalizeTxHash })
      .where(eq(oracleRuns.id, finalizeRunRow.id));
    await publicClient.waitForTransactionReceipt({ hash: finalizeTxHash });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await db
      .update(oracleRuns)
      .set({ status: "failed", error: err })
      .where(eq(oracleRuns.id, finalizeRunRow.id));
    return NextResponse.json(
      { ok: false, phase: "finalize", submitTxHash, error: err },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    submitTxHash: submitTxHash ?? null,
    submitSkipped: !submitTxHash,
    finalizeTxHash,
  });
}
