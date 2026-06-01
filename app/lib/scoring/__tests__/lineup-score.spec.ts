import { describe, it, expect } from "vitest";
import { scoreLineup, aggregateOnzeScores } from "../lineup-score";

describe("scoreLineup", () => {
  const pts = new Map<number, number>([[1, 5], [2, 10], [3, 0], [4, 7]]);

  it("sums lineup points and doubles the captain", () => {
    // 5 + 10 + 0 + (captain 2 again: +10) = 25
    expect(scoreLineup([1, 2, 3], 2, pts)).toBe(25);
  });
  it("treats a captain missing from the points map as 0 extra", () => {
    // 5 + 10 + (captain 99 not in map: +0) = 15
    expect(scoreLineup([1, 2], 99, pts)).toBe(15);
  });
  it("treats players missing from the points map as 0", () => {
    // id 50 absent -> 0; id 4 -> 7; captain 4 again -> +7 = 14
    expect(scoreLineup([50, 4], 4, pts)).toBe(14);
  });
  it("does not double when captainId is undefined or 0", () => {
    expect(scoreLineup([1, 2], undefined, pts)).toBe(15);
    expect(scoreLineup([1, 2], 0, pts)).toBe(15);
  });
});

describe("aggregateOnzeScores", () => {
  it("scores each entry with its own captain", () => {
    const pts = new Map<number, number>([[1, 5], [2, 10], [3, 3]]);
    const out = aggregateOnzeScores(
      [
        { user: "0xA", lineup: [1, 2], captainId: 2 }, // 5+10+10 = 25
        { user: "0xB", lineup: [1, 3], captainId: 1 }, // 5+3+5 = 13
      ],
      pts,
    );
    expect(out).toEqual([
      { user: "0xA", points: 25 },
      { user: "0xB", points: 13 },
    ]);
  });
});
