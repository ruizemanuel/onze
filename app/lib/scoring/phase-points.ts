import type { ScoreProvider } from "./provider";

/**
 * Sum a provider's per-round points over every round of a phase into one
 * playerId -> points map. The WC group stage aggregates FIFA rounds [1,2,3];
 * a knockout phase is a single round. Rounds are fetched in parallel.
 */
export async function getPhasePoints(
  provider: ScoreProvider,
  rounds: number[],
): Promise<Map<number, number>> {
  const maps = await Promise.all(rounds.map((r) => provider.getRoundPoints(r)));
  const total = new Map<number, number>();
  for (const m of maps) {
    for (const [id, pts] of m) total.set(id, (total.get(id) ?? 0) + pts);
  }
  return total;
}
