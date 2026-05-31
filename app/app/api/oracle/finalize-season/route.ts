import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { chainForNetwork } from "@/lib/contracts/chain";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "node:crypto";
import { pick5PoolAbi, pick5SeasonAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolvePoolById, resolveSeasonPool } from "@/lib/contracts/factory";
import { getSeasonById } from "@/lib/tournaments/seasons";
import { sumSeasonScores } from "@/lib/scoring/season";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Close a season: build aggregate standings from every fecha's on-chain scores
 * (only wallets that played >= 1 fecha), then SeasonPool.submitFinalStandings ->
 * finalize(). ?s=<seasonId>. Requires every fecha already settled. Idempotent +
 * chained — safe to re-run from a retry cron.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const sParam = req.nextUrl.searchParams.get("s");
  if (sParam === null) {
    return NextResponse.json({ ok: false, reason: "missing ?s=<seasonId>" }, { status: 400 });
  }
  const seasonId = Number(sParam);
  const season = getSeasonById(seasonId);
  if (!season) {
    return NextResponse.json({ ok: false, reason: `season ${seasonId} not in config` }, { status: 400 });
  }

  const network = DEFAULT_NETWORK;
  const chain = chainForNetwork(network);
  const publicClient = createPublicClient({ chain, transport: http() });

  const seasonPool = await resolveSeasonPool(publicClient, network, seasonId);
  if (!seasonPool) {
    return NextResponse.json({ ok: false, reason: `season pool not found for season ${seasonId}` }, { status: 500 });
  }

  const [standingsSubmitted, finalized] = await Promise.all([
    publicClient.readContract({ address: seasonPool, abi: pick5SeasonAbi, functionName: "standingsSubmitted" }) as Promise<boolean>,
    publicClient.readContract({ address: seasonPool, abi: pick5SeasonAbi, functionName: "finalized" }) as Promise<boolean>,
  ]);
  if (finalized) {
    return NextResponse.json({ ok: true, reason: "already finalized" });
  }

  if (!process.env.ORACLE_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, reason: "ORACLE_PRIVATE_KEY not configured" }, { status: 500 });
  }
  const oracleAccount = privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ chain, account: oracleAccount, transport: http() });

  let submitTxHash: `0x${string}` | undefined;

  if (!standingsSubmitted) {
    // Gather each fecha's on-chain per-wallet scores (requires all fechas settled).
    const fechaMaps: Map<string, number>[] = [];
    for (const f of season.fechas) {
      const pool = await resolvePoolById(publicClient, network, f.tournamentId);
      if (!pool) {
        return NextResponse.json({ ok: false, reason: `fecha ${f.tournamentId} pool not found` }, { status: 500 });
      }
      const submitted = (await publicClient.readContract({ address: pool, abi: pick5PoolAbi, functionName: "scoresSubmitted" })) as boolean;
      if (!submitted) {
        return NextResponse.json({ ok: false, reason: `fecha ${f.tournamentId} not settled yet, will retry` });
      }
      const n = (await publicClient.readContract({ address: pool, abi: pick5PoolAbi, functionName: "participantsLength" })) as bigint;
      const m = new Map<string, number>();
      for (let i = BigInt(0); i < n; i += BigInt(1)) {
        const w = (await publicClient.readContract({ address: pool, abi: pick5PoolAbi, functionName: "participants", args: [i] })) as `0x${string}`;
        const s = (await publicClient.readContract({ address: pool, abi: pick5PoolAbi, functionName: "scores", args: [w] })) as bigint;
        m.set(w.toLowerCase(), Number(s));
      }
      fechaMaps.push(m);
    }

    const totals = sumSeasonScores(fechaMaps);
    const wallets = [...totals.keys()] as `0x${string}`[];
    if (wallets.length === 0) {
      return NextResponse.json({ ok: false, reason: "no season participants" });
    }
    const points = wallets.map((w) => BigInt(totals.get(w) ?? 0));
    const randomSeed = ("0x" + crypto.randomBytes(32).toString("hex")) as `0x${string}`;

    try {
      submitTxHash = await walletClient.writeContract({ address: seasonPool, abi: pick5SeasonAbi, functionName: "submitFinalStandings", args: [wallets, points, BigInt(randomSeed)] });
      await publicClient.waitForTransactionReceipt({ hash: submitTxHash });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, phase: "submit", error: err }, { status: 500 });
    }
  }

  let finalizeTxHash: `0x${string}`;
  try {
    finalizeTxHash = await walletClient.writeContract({ address: seasonPool, abi: pick5SeasonAbi, functionName: "finalize" });
    await publicClient.waitForTransactionReceipt({ hash: finalizeTxHash });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, phase: "finalize", submitTxHash, error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seasonId, submitTxHash: submitTxHash ?? null, submitSkipped: !submitTxHash, finalizeTxHash });
}
