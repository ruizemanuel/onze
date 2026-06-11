import { describe, it, expect } from "vitest";
import { filterAvailable } from "../availability";
import type { ProviderPlayer } from "../provider";

function player(over: Partial<ProviderPlayer>): ProviderPlayer {
  return {
    id: 1,
    name: "P",
    team: "ARS",
    position: "MID",
    cost: 10,
    form: 5,
    owned: 20,
    totalPoints: 100,
    status: "a",
    chanceThisRound: null,
    chanceNextRound: null,
    ...over,
  };
}

describe("filterAvailable", () => {
  it("keeps fully available players (status 'a', null chances = assume fit)", () => {
    const out = filterAvailable([player({ id: 1 })]);
    expect(out.map((p) => p.id)).toEqual([1]);
  });

  it("drops injured / suspended / doubtful / out by status", () => {
    const out = filterAvailable([
      player({ id: 1, status: "a" }),
      player({ id: 2, status: "i" }),
      player({ id: 3, status: "s" }),
      player({ id: 4, status: "d" }),
      player({ id: 5, status: "u" }),
      player({ id: 6, status: "n" }),
    ]);
    expect(out.map((p) => p.id)).toEqual([1]);
  });

  it("keeps FIFA World Cup players (status 'playing')", () => {
    const out = filterAvailable([
      player({ id: 1, status: "playing" }),
      player({ id: 2, status: "transferred" }), // not called up -> excluded
    ]);
    expect(out.map((p) => p.id)).toEqual([1]);
  });

  it("drops players below the 75% chance gate (this or next round)", () => {
    const out = filterAvailable([
      player({ id: 1, chanceThisRound: 100, chanceNextRound: 100 }),
      player({ id: 2, chanceThisRound: 50 }),
      player({ id: 3, chanceNextRound: 25 }),
      player({ id: 4, chanceThisRound: 75, chanceNextRound: 75 }),
    ]);
    expect(out.map((p) => p.id)).toEqual([1, 4]);
  });
});
