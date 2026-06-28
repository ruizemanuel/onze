import { describe, it, expect } from "vitest";
import {
  fifaPlayersToProviderPlayers,
  fifaRoundPointsToMap,
  isFifaRoundSettled,
} from "../worldcup-provider";
import type { FifaFantasyPlayer, FifaSquad } from "@/lib/worldcup/client";

const squads: FifaSquad[] = [
  { id: 1, name: "Argentina", abbr: "ARG", isEliminated: true },
  { id: 2, name: "France" }, // no abbr -> name fallback; isEliminated undefined -> false
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
      eliminated: true,
      teamId: 1,
    });
  });
  it("uses firstName+lastName when knownName is null, and squad name when abbr is missing", () => {
    const out = fifaPlayersToProviderPlayers(players, squads);
    expect(out[1].name).toBe("Kylian Mbappé");
    expect(out[1].team).toBe("France");
    expect(out[1].eliminated).toBe(false);
    expect(out[1].teamId).toBe(2);
  });
  it("drops players not called up (status 'transferred')", () => {
    const withTransferred: FifaFantasyPlayer[] = [
      ...players,
      {
        id: 99, firstName: "Franco", lastName: "Mastantuono", knownName: null,
        squadId: 2, position: "MID", price: 5.8, status: "transferred", percentSelected: 0.1,
        stats: { totalPoints: 0, avgPoints: 0, form: 0, lastRoundPoints: 0, roundPoints: [] },
      },
    ];
    const out = fifaPlayersToProviderPlayers(withTransferred, squads);
    expect(out).toHaveLength(2);
    expect(out.find((p) => p.id === 99)).toBeUndefined();
  });
});

describe("fifaRoundPointsToMap", () => {
  it("builds playerId -> points for a given FIFA round (0 when absent)", () => {
    const m = fifaRoundPointsToMap(players, 2); // roundPoints index 2
    expect(m.get(10)).toBe(4); // [0,3,4][2]
    expect(m.get(20)).toBe(0); // [0,5][2] -> undefined -> 0
  });
});

describe("isFifaRoundSettled", () => {
  it("treats FIFA 'complete' rounds as settled (FIFA's finished marker)", () => {
    expect(isFifaRoundSettled("complete")).toBe(true);
  });
  it("treats 'closed' as settled too (forward-compat)", () => {
    expect(isFifaRoundSettled("closed")).toBe(true);
  });
  it("is NOT settled while scheduled / playing / undefined", () => {
    expect(isFifaRoundSettled("scheduled")).toBe(false);
    expect(isFifaRoundSettled("playing")).toBe(false);
    expect(isFifaRoundSettled(undefined)).toBe(false);
  });
});

import { getPhasePoints } from "../phase-points";
import type { ScoreProvider } from "../provider";

describe("roundPoints object shape (real FIFA data) + phase sum", () => {
  // FIFA returns roundPoints as an OBJECT keyed by round id, e.g. {1:19,2:14,3:7},
  // NOT a 0-indexed array. `roundPoints[round]` must still resolve per round.
  const objPlayers = [
    {
      id: 38, firstName: "Lionel", lastName: "Messi", knownName: null, squadId: 2,
      position: "FWD", price: 10, status: "playing", percentSelected: 0,
      stats: { totalPoints: 40, avgPoints: 0, form: 0, lastRoundPoints: 7,
        roundPoints: { 1: 19, 2: 14, 3: 7 } as unknown as number[] },
    },
  ] as unknown as FifaFantasyPlayer[];

  it("resolves each round id from the object", () => {
    expect(fifaRoundPointsToMap(objPlayers, 1).get(38)).toBe(19);
    expect(fifaRoundPointsToMap(objPlayers, 2).get(38)).toBe(14);
    expect(fifaRoundPointsToMap(objPlayers, 3).get(38)).toBe(7);
  });

  it("getPhasePoints sums all phase rounds (group = 1+2+3 = 40)", async () => {
    const provider = {
      id: "test", async getPlayers() { return []; },
      async getRoundPoints(r: number) { return fifaRoundPointsToMap(objPlayers, r); },
      async isRoundSettled() { return true; },
    } as unknown as ScoreProvider;
    const m = await getPhasePoints(provider, [1, 2, 3]);
    expect(m.get(38)).toBe(40);
  });
});
