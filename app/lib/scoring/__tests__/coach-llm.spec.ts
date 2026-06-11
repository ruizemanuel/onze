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

// ids 1..12 available; id 99 injured -> filtered OUT of the candidate pool.
const pool: ProviderPlayer[] = [
  ...Array.from({ length: 12 }, (_, i) => player({ id: i + 1, status: "a" })),
  player({ id: 99, status: "i", form: 9, owned: 90, cost: 4 }),
];

const XI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function pick(id: number) {
  return { playerId: id, playerName: "X", reasoning: "x".repeat(25) };
}

beforeEach(() => {
  vi.mocked(generateObject).mockReset();
  // Force the gateway (mocked generateObject) path: without an OpenRouter key the
  // primary path throws before any fetch, so generateCoachPicks falls through.
  delete process.env.OPENROUTER_API_KEY;
});

describe("generateCoachPicks output validation (XI enforcement)", () => {
  it("rejects picks containing a player outside the available candidate pool", async () => {
    // 11 picks but one (99) is injured / outside the filtered pool.
    vi.mocked(generateObject).mockResolvedValue({
      object: { picks: [...XI.slice(0, 10), 99].map(pick) },
    } as never);
    await expect(generateCoachPicks(38, pool)).rejects.toThrow(/candidate pool/);
  });

  it("accepts picks that are all within the available candidate pool", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { picks: XI.map(pick) },
    } as never);
    const res = await generateCoachPicks(38, pool);
    expect(res.picks.map((p) => p.playerId)).toEqual(XI);
  });

  it("rejects duplicate ids (existing guard still holds)", async () => {
    // 11 entries but id 1 is duplicated (10 distinct) -> duplicate guard fires.
    vi.mocked(generateObject).mockResolvedValue({
      object: { picks: [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pick) },
    } as never);
    await expect(generateCoachPicks(38, pool)).rejects.toThrow(/duplicate/);
  });
});
