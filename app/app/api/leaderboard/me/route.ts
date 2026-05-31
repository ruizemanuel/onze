import { NextRequest, NextResponse } from "next/server";
import { inArray, sql, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leaderboardCache } from "@/lib/db/schema";
import { getActiveSeason, seasonFechaIds } from "@/lib/tournaments/seasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !/^0x[0-9a-f]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  // Optional ?t=<tournamentId> scopes points + rank to a single fecha; absent, it
  // aggregates the whole active season (the Tabla General). Same query, different ids.
  const tParam = req.nextUrl.searchParams.get("t");
  const t = tParam !== null && /^\d+$/.test(tParam) ? Number(tParam) : undefined;

  try {
    const db = getDb();
    const ids = t !== undefined ? [t] : seasonFechaIds(getActiveSeason());
    const rows = await db
      .select({
        wallet: leaderboardCache.wallet,
        total: sql<number>`sum(${leaderboardCache.pts})::int`,
      })
      .from(leaderboardCache)
      .where(inArray(leaderboardCache.tournamentId, ids))
      .groupBy(leaderboardCache.wallet)
      .orderBy(desc(sql`sum(${leaderboardCache.pts})`));

    const maxTotal = rows.length > 0 ? Number(rows[0].total) : 0;
    const idx = rows.findIndex((r) => r.wallet === wallet);
    if (idx < 0) {
      return NextResponse.json({ wallet, rank: null, total: 0 });
    }
    // Competition ranking (ties share a rank); null until anyone has points.
    let rank: number | null = null;
    if (maxTotal > 0) {
      const myTotal = Number(rows[idx].total);
      rank = 1;
      for (let i = 0; i < idx; i++) if (Number(rows[i].total) > myTotal) rank++;
    }
    return NextResponse.json({ wallet, rank, total: Number(rows[idx].total) });
  } catch (err) {
    console.error("[leaderboard/me]", err);
    return NextResponse.json({ wallet, rank: null, total: 0 });
  }
}
