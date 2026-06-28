import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/scoring/providers";
import { getPhasePoints } from "@/lib/scoring/phase-points";
import { fechaRound, phaseRounds, seasonForFecha, seasonProvider } from "@/lib/tournaments/seasons";
import { getFifaRounds } from "@/lib/worldcup/client";
import { mapRounds, aggregatePlayerGoals } from "@/lib/fixtures/fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-player phase stats for a fecha's team-view overlay (provider-agnostic).
 * ?t=<tournamentId>. Returns { mw, stats: { [playerId]: { points, goals, assists } } }.
 * Points come from the provider seam (getPhasePoints over the phase rounds — the same
 * numbers finalize/leaderboard use). Goals/assists are aggregated from the World Cup
 * match feed (the FIFA fantasy feed exposes no per-player goals/assists; minutes are
 * unavailable entirely). Only players with a non-zero stat are returned to keep the
 * payload small; the consumer treats a missing id as all-zero.
 */
export async function GET(req: NextRequest) {
  const t = Number(req.nextUrl.searchParams.get("t"));
  const season = Number.isInteger(t) ? seasonForFecha(t) : undefined;
  if (!season) return NextResponse.json({ mw: t, stats: {} });

  try {
    const provider = getProvider(seasonProvider(season));
    const rounds = phaseRounds(season, t);
    const points = await getPhasePoints(provider, rounds);

    let ga = new Map<number, { goals: number; assists: number }>();
    if (seasonProvider(season) === "fifa-wc") {
      ga = aggregatePlayerGoals(mapRounds(await getFifaRounds(0)), rounds);
    }

    const stats: Record<number, { points: number; goals: number; assists: number }> = {};
    const ids = new Set<number>([...points.keys(), ...ga.keys()]);
    for (const id of ids) {
      const pts = points.get(id) ?? 0;
      const g = ga.get(id);
      const goals = g?.goals ?? 0;
      const assists = g?.assists ?? 0;
      if (pts !== 0 || goals !== 0 || assists !== 0) {
        stats[id] = { points: pts, goals, assists };
      }
    }
    return NextResponse.json({ mw: fechaRound(t) ?? 0, stats });
  } catch (e) {
    console.error("scores/live failed", e);
    return NextResponse.json({ mw: fechaRound(t) ?? 0, stats: {} });
  }
}
