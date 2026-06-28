import {
  getFifaPlayers,
  getFifaSquads,
  getFifaRounds,
  type FifaFantasyPlayer,
  type FifaSquad,
} from "@/lib/worldcup/client";
import type { ProviderPlayer, ScoreProvider } from "./provider";

/** Pure: map FIFA fantasy players (+ squads for team names) to ProviderPlayer. */
export function fifaPlayersToProviderPlayers(
  players: FifaFantasyPlayer[],
  squads: FifaSquad[],
): ProviderPlayer[] {
  const squadById = new Map(squads.map((s) => [s.id, s]));
  return players
    // Drop players not in a World Cup squad — FIFA marks them status "transferred"
    // (they were never called up, so they can never score or be picked). Distinct
    // from `eliminated`, where the player WAS in a squad whose team got knocked out.
    .filter((p) => p.status !== "transferred")
    .map((p) => {
    const squad = squadById.get(p.squadId);
    return {
      id: p.id,
      name: p.knownName ?? `${p.firstName} ${p.lastName}`.trim(),
      team: squad?.abbr ?? squad?.name ?? "",
      position: p.position,
      cost: p.price,
      form: p.stats.form,
      owned: p.percentSelected,
      totalPoints: p.stats.totalPoints,
      status: p.status,
      // FIFA's fantasy feed has no per-round availability probability -> null
      // (the seam treats null as "fit", same as FPL when data is unavailable).
      chanceThisRound: null,
      chanceNextRound: null,
      eliminated: squad?.isEliminated ?? false,
      teamId: p.squadId,
    };
  });
}

/** Pure: playerId -> points for a single FIFA round id (0 when absent). */
export function fifaRoundPointsToMap(
  players: FifaFantasyPlayer[],
  round: number,
): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of players) m.set(p.id, p.stats.roundPoints[round] ?? 0);
  return m;
}

/** A FIFA round is settled (final) once its status is "complete" — FIFA's marker for a
 * finished round. ("closed" kept for forward-compat; it is NOT the value FIFA emits.)
 * Pure so the finalize/reveal gate is unit-testable. */
export function isFifaRoundSettled(status: string | undefined): boolean {
  return status === "complete" || status === "closed";
}

export const OnzeWcScoreProvider: ScoreProvider = {
  id: "fifa-wc",
  async getPlayers() {
    const [players, squads] = await Promise.all([getFifaPlayers(), getFifaSquads()]);
    return fifaPlayersToProviderPlayers(players, squads);
  },
  async getRoundPoints(round) {
    return fifaRoundPointsToMap(await getFifaPlayers(), round);
  },
  async isRoundSettled(round) {
    const rounds = await getFifaRounds();
    return isFifaRoundSettled(rounds.find((r) => r.id === round)?.status);
  },
};
