import { describe, it, expect } from "vitest";
import { getPhasePoints } from "../phase-points";
import type { ScoreProvider } from "../provider";

// Stub provider: round r yields { 1: r, 2: r*10 }.
const stub: ScoreProvider = {
  id: "stub",
  async getPlayers() { return []; },
  async getRoundPoints(r) { return new Map([[1, r], [2, r * 10]]); },
  async isRoundSettled() { return true; },
};

describe("getPhasePoints", () => {
  it("sums points across all rounds of the phase", async () => {
    const m = await getPhasePoints(stub, [1, 2, 3]);
    expect(m.get(1)).toBe(1 + 2 + 3);     // 6
    expect(m.get(2)).toBe(10 + 20 + 30);  // 60
  });
  it("handles a single-round phase", async () => {
    const m = await getPhasePoints(stub, [4]);
    expect(m.get(1)).toBe(4);
    expect(m.get(2)).toBe(40);
  });
  it("returns an empty map for no rounds", async () => {
    const m = await getPhasePoints(stub, []);
    expect(m.size).toBe(0);
  });
});
