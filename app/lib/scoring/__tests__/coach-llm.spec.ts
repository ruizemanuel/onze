import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM layer so we can drive generateCoachPicks' output validation.
vi.mock("@ai-sdk/gateway", () => ({ gateway: vi.fn(() => "mock-model") }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { generateObject } from "ai";
import { generateCoachPicks } from "@/lib/ai/coach";
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

// ids 1..12 available with positions so a 4-3-3 is buildable from [1..11].
// id 99 injured -> filtered OUT of the candidate pool.
const POS: Record<number, ProviderPlayer["position"]> = {
  1: "GK", 2: "DEF", 3: "DEF", 4: "DEF", 5: "DEF",
  6: "MID", 7: "MID", 8: "MID", 9: "FWD", 10: "FWD", 11: "FWD", 12: "MID",
};
const pool: ProviderPlayer[] = [
  ...Array.from({ length: 12 }, (_, i) => player({ id: i + 1, status: "a", position: POS[i + 1] })),
  player({ id: 99, status: "i", form: 9, owned: 90, cost: 4, position: "FWD" }),
];

const pick = (id: number) => ({ playerId: id, playerName: "X", reasoning: "x".repeat(25) });

// Mock the LLM (gateway) to return a position-line XI.
function mockXI(gk: number[], def: number[], mid: number[], fwd: number[]) {
  vi.mocked(generateObject).mockResolvedValue({
    object: { gk: gk.map(pick), def: def.map(pick), mid: mid.map(pick), fwd: fwd.map(pick) },
  } as never);
}

beforeEach(() => {
  vi.mocked(generateObject).mockReset();
});

describe("generateCoachPicks output validation (4-3-3 + pool + budget)", () => {
  it("accepts a valid 4-3-3 of in-pool players", async () => {
    mockXI([1], [2, 3, 4, 5], [6, 7, 8], [9, 10, 11]);
    const res = await generateCoachPicks(38, pool);
    expect(res.picks.map((p) => p.playerId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("rejects a player outside the available candidate pool", async () => {
    mockXI([1], [2, 3, 4, 99], [6, 7, 8], [9, 10, 11]); // 99 injured -> not in pool
    await expect(generateCoachPicks(38, pool)).rejects.toThrow(/candidate pool/);
  });

  it("rejects a player placed in the wrong position line", async () => {
    mockXI([1], [2, 3, 4, 6], [7, 8, 12], [9, 10, 11]); // id 6 is a MID, put in def
    await expect(generateCoachPicks(38, pool)).rejects.toThrow(/line/);
  });

  it("rejects duplicate ids", async () => {
    mockXI([1], [2, 3, 4, 5], [6, 7, 8], [9, 10, 9]); // id 9 duplicated -> 10 distinct
    await expect(generateCoachPicks(38, pool)).rejects.toThrow(/duplicate/);
  });

  it("enforces the budget when one is provided", async () => {
    mockXI([1], [2, 3, 4, 5], [6, 7, 8], [9, 10, 11]); // valid 4-3-3 but 11×10 = 110 > 100
    await expect(generateCoachPicks(38, pool, 100)).rejects.toThrow(/budget/);
  });
});
