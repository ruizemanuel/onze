import { describe, it, expect } from "vitest";
import { bootstrapToProviderPlayers } from "../fpl-provider";

describe("bootstrapToProviderPlayers", () => {
  const bootstrap = {
    teams: [{ id: 1, name: "Arsenal", short_name: "ARS" }],
    elements: [
      {
        id: 7,
        code: 111,
        web_name: "Saka",
        team: 1,
        element_type: 3, // MID
        now_cost: 125, // -> 12.5
        selected_by_percent: "44.5",
        form: "6.2",
        total_points: 180,
        status: "a",
        chance_of_playing_this_round: 100,
        chance_of_playing_next_round: null,
      },
    ],
  };

  it("normalizes an FPL element into a ProviderPlayer", () => {
    const [p] = bootstrapToProviderPlayers(bootstrap);
    expect(p).toEqual({
      id: 7,
      name: "Saka",
      team: "ARS",
      position: "MID",
      cost: 12.5,
      form: 6.2,
      owned: 44.5,
      totalPoints: 180,
      status: "a",
      chanceThisRound: 100,
      chanceNextRound: null,
    });
  });

  it("falls back to empty team + '?' position for unknown refs", () => {
    const [p] = bootstrapToProviderPlayers({
      teams: [],
      elements: [{ ...bootstrap.elements[0], team: 99, element_type: 9 }],
    });
    expect(p.team).toBe("");
    expect(p.position).toBe("?");
  });
});
