import {
  getBootstrap,
  getLive,
  isMwSettled,
  type FplBootstrap,
} from "@/lib/fpl/client";
import { liveToMap } from "@/lib/fpl/scoring";
import type { ProviderPlayer, ScoreProvider } from "./provider";

// FPL element_type is 1-indexed: 1=GK 2=DEF 3=MID 4=FWD (hence the -1 below)
const POSITIONS = ["GK", "DEF", "MID", "FWD"];

/** Pure: map an FPL bootstrap into the normalized ProviderPlayer shape. */
export function bootstrapToProviderPlayers(
  bootstrap: FplBootstrap,
): ProviderPlayer[] {
  return bootstrap.elements.map((e) => ({
    id: e.id,
    name: e.web_name,
    team: bootstrap.teams.find((t) => t.id === e.team)?.short_name ?? "",
    position: POSITIONS[e.element_type - 1] ?? "?",
    cost: e.now_cost / 10,
    form: parseFloat(e.form),
    owned: parseFloat(e.selected_by_percent),
    totalPoints: e.total_points,
    status: e.status,
    chanceThisRound: e.chance_of_playing_this_round,
    chanceNextRound: e.chance_of_playing_next_round,
  }));
}

export const FplScoreProvider: ScoreProvider = {
  id: "fpl",
  async getPlayers() {
    return bootstrapToProviderPlayers(await getBootstrap());
  },
  async getRoundPoints(round) {
    return liveToMap(await getLive(round));
  },
  async isRoundSettled(round) {
    return isMwSettled(round);
  },
};
