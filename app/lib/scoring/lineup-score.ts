/**
 * Score a fantasy lineup against a playerId -> points map, doubling the captain
 * (the captain's points are counted a second time). The captain MUST be one of
 * the lineup ids on-chain (OnzePool enforces it); here a captain absent from the
 * points map (or 0/undefined) simply adds 0. Pure — used by both the authoritative
 * finalize path and the provisional recompute so they always agree.
 */
export function scoreLineup(
  lineup: number[],
  captainId: number | undefined,
  points: Map<number, number>,
): number {
  let total = 0;
  for (const id of lineup) total += points.get(id) ?? 0;
  if (captainId !== undefined && captainId !== 0) {
    total += points.get(captainId) ?? 0; // captain counts twice
  }
  return total;
}

/** Score many users (each with its own captain) against one points map. */
export function aggregateOnzeScores(
  entries: Array<{ user: string; lineup: number[]; captainId: number }>,
  points: Map<number, number>,
): Array<{ user: string; points: number }> {
  return entries.map((e) => ({ user: e.user, points: scoreLineup(e.lineup, e.captainId, points) }));
}
