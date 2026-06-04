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
  return players.map((p) => {
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
    return rounds.find((r) => r.id === round)?.status === "closed";
  },
};
