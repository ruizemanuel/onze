import { describe, it, expect } from "vitest";
import {
  fifaPlayersToProviderPlayers,
  fifaRoundPointsToMap,
} from "../worldcup-provider";
import type { FifaFantasyPlayer, FifaSquad } from "@/lib/worldcup/client";

const squads: FifaSquad[] = [
  { id: 1, name: "Argentina", shortName: "ARG" },
  { id: 2, name: "France" }, // no shortName -> falls back to name
];

const players: FifaFantasyPlayer[] = [
  {
    id: 10, firstName: "Lionel", lastName: "Messi", knownName: "Messi",
    squadId: 1, position: "FWD", price: 12.5, status: "playing", percentSelected: 40.2,
    stats: { totalPoints: 7, avgPoints: 3.5, form: 5.0, lastRoundPoints: 4, roundPoints: [0, 3, 4] },
  },
  {
    id: 20, firstName: "Kylian", lastName: "Mbappé", knownName: null,
    squadId: 2, position: "FWD", price: 12.0, status: "playing", percentSelected: 38.0,
    stats: { totalPoints: 5, avgPoints: 2.5, form: 4.0, lastRoundPoints: 2, roundPoints: [0, 5] },
  },
];

describe("fifaPlayersToProviderPlayers", () => {
  it("maps FIFA players to the ProviderPlayer shape", () => {
    const out = fifaPlayersToProviderPlayers(players, squads);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 10, name: "Messi", team: "ARG", position: "FWD",
      cost: 12.5, form: 5.0, owned: 40.2, totalPoints: 7, status: "playing",
      chanceThisRound: null, chanceNextRound: null,
    });
  });
  it("uses firstName+lastName when knownName is null, and squad name when shortName is missing", () => {
    const out = fifaPlayersToProviderPlayers(players, squads);
    expect(out[1].name).toBe("Kylian Mbappé");
    expect(out[1].team).toBe("France");
  });
});

describe("fifaRoundPointsToMap", () => {
  it("builds playerId -> points for a given FIFA round (0 when absent)", () => {
    const m = fifaRoundPointsToMap(players, 2); // roundPoints index 2
    expect(m.get(10)).toBe(4); // [0,3,4][2]
    expect(m.get(20)).toBe(0); // [0,5][2] -> undefined -> 0
  });
});
