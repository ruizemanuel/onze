import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo, celoAlfajores, celoSepolia } from "viem/chains";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leaderboardCache } from "@/lib/db/schema";
import { FplScoreProvider } from "@/lib/scoring/fpl-provider";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { poolAddress, DEFAULT_NETWORK } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getChain(network: string) {
  if (network === "celo") return celo;
  if (network === "celo-sepolia") return celoSepolia;
  return celoAlfajores;
}

export async function GET(req: NextRequest) {
  // Triggered by the GH Actions cron (Bearer CRON_SECRET). The endpoint
  // does on-chain reads + DB writes, so gate it to prevent DoS even though
  // the cache it produces is non-authoritative.
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const db = getDb();

  const network = DEFAULT_NETWORK;
  const chain = getChain(network);
  const client = createPublicClient({ chain, transport: http() });
  const poolAddr = poolAddress(network);

  if (poolAddr === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ ok: false, reason: `pool not configured for ${network}` });
  }

  const [numParticipants, scoresSubmittedOnChain] = await Promise.all([
    client.readContract({
      address: poolAddr,
      abi: pick5PoolAbi,
      functionName: "participantsLength",
    }) as Promise<bigint>,
    client.readContract({
      address: poolAddr,
      abi: pick5PoolAbi,
      functionName: "scoresSubmitted",
    }) as Promise<boolean>,
  ]);

  if (numParticipants === BigInt(0)) {
    return NextResponse.json({ ok: true, users: 0 });
  }

  // Two scoring sources:
  //   pre-submitScores: live FPL feed — leaderboard tracks standings as
  //     fixtures play out. Bonus is provisional, firms up at settle.
  //   post-submitScores: on-chain `scores[wallet]` — immutable per-user total
  //     written by the oracle. We switch to this once the contract has the
  //     authoritative scores because FPL eventually purges/drifts old MW data
  //     between seasons; without this guard, the next daily recompute would
  //     overwrite the cache with stale zeros (which happened in V1: the May 25
  //     04:18 UTC run zeroed the MW38 winner's MW37 column after FPL had
  //     started purging it).
  const m37 = scoresSubmittedOnChain
    ? new Map<number, number>()
    : await FplScoreProvider.getRoundPoints(37).catch(() => new Map<number, number>());
  const m38 = scoresSubmittedOnChain
    ? new Map<number, number>()
    : await FplScoreProvider.getRoundPoints(38).catch(() => new Map<number, number>());

  type Lineup = readonly [bigint, bigint, bigint, bigint, bigint];
  const lineups: Record<string, Lineup> = {};
  for (let i = BigInt(0); i < numParticipants; i += BigInt(1)) {
    const u = (await client.readContract({
      address: poolAddr,
      abi: pick5PoolAbi,
      functionName: "participants",
      args: [i],
    })) as `0x${string}`;
    const lin = (await client.readContract({
      address: poolAddr,
      abi: pick5PoolAbi,
      functionName: "getLineup",
      args: [u],
    })) as Lineup;
    lineups[u] = lin;
  }

  let maxTotal = 0;
  for (const [user, lineup] of Object.entries(lineups)) {
    let mw37Pts = 0;
    let mw38Pts = 0;
    if (scoresSubmittedOnChain) {
      // Read the immutable on-chain total. The contract only stores totals,
      // not per-MW splits, so we collapse the whole score into mw38Pts (the
      // active MW at the time of submit) and leave mw37Pts at 0. Nothing in
      // the UI displays the mw37/mw38 split — only `total` is rendered.
      const onChainScore = (await client.readContract({
        address: poolAddr,
        abi: pick5PoolAbi,
        functionName: "scores",
        args: [user as `0x${string}`],
      })) as bigint;
      mw38Pts = Number(onChainScore);
    } else {
      for (const idBn of lineup) {
        const id = Number(idBn);
        mw37Pts += m37.get(id) ?? 0;
        mw38Pts += m38.get(id) ?? 0;
      }
    }
    maxTotal = Math.max(maxTotal, mw37Pts + mw38Pts);
    // Store lowercase — /api/leaderboard/me normalizes the query param to
    // lowercase before an exact match, so the cache key must be lowercase too.
    await db
      .insert(leaderboardCache)
      .values({ wallet: user.toLowerCase(), mw37Pts, mw38Pts, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: leaderboardCache.wallet,
        set: { mw37Pts, mw38Pts, updatedAt: new Date() },
      });
  }

  // Recompute ranks via window function — but only once there are real points
  // on the board. While every wallet is still at 0, RANK() ties them all at
  // #1, which surfaces a misleading "#1 of all players" in the UI; keep rank
  // NULL until standings have actually differentiated.
  if (maxTotal > 0) {
    await db.execute(sql`
      UPDATE leaderboard_cache lc
      SET rank = sub.rank
      FROM (
        SELECT wallet, RANK() OVER (ORDER BY (mw37_pts + mw38_pts) DESC) AS rank
        FROM leaderboard_cache
      ) sub
      WHERE lc.wallet = sub.wallet
    `);
  } else {
    await db.execute(sql`UPDATE leaderboard_cache SET rank = NULL`);
  }

  return NextResponse.json({
    ok: true,
    users: Object.keys(lineups).length,
    ranked: maxTotal > 0,
    source: scoresSubmittedOnChain ? "onchain" : "fpl-live",
  });
}
