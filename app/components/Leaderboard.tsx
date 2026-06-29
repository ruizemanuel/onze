import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leaderboardCache } from "@/lib/db/schema";
import { getActiveSeason, seasonFechaIds } from "@/lib/tournaments/seasons";
import { LeaderboardView, type LeaderboardRow } from "./LeaderboardView";

async function loadRows(tid?: number): Promise<LeaderboardRow[]> {
  try {
    const db = getDb();
    // tid set → single-phase standings (that pool's points); else → season aggregate.
    const ids = tid !== undefined ? [tid] : seasonFechaIds(getActiveSeason());
    const rows = await db
      .select({
        wallet: leaderboardCache.wallet,
        total: sql<number>`sum(${leaderboardCache.pts})::int`,
      })
      .from(leaderboardCache)
      .where(inArray(leaderboardCache.tournamentId, ids))
      .groupBy(leaderboardCache.wallet)
      .orderBy(desc(sql`sum(${leaderboardCache.pts})`))
      .limit(100);

    const maxTotal = rows.length > 0 ? Number(rows[0].total) : 0;
    let prevTotal: number | null = null;
    let prevRank = 0;
    return rows.map((r, i) => {
      const total = Number(r.total);
      let rank: number | null = null;
      if (maxTotal > 0) {
        rank = prevTotal !== null && total === prevTotal ? prevRank : i + 1;
        prevTotal = total;
        prevRank = rank;
      }
      return { wallet: r.wallet, total, rank };
    });
  } catch {
    return [];
  }
}

export async function Leaderboard({ tid }: { tid?: number }) {
  const rows = await loadRows(tid);
  return <LeaderboardView rows={rows} />;
}
