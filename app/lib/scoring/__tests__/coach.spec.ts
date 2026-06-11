import { describe, it, expect } from "vitest";
import { rankCandidates } from "@/lib/ai/coach";
import { fallbackPicks } from "@/lib/ai/fallback";
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

describe("rankCandidates", () => {
  it("excludes unavailable players even when they rank highest", () => {
    const pool = [
      // Highest form×owned/cost but injured — must be dropped:
      player({ id: 1, status: "i", form: 9, owned: 60, cost: 5 }),
      player({ id: 2, status: "s", form: 9, owned: 60, cost: 5 }),
      player({ id: 3, status: "d", form: 9, owned: 60, cost: 5 }),
      // Available:
      player({ id: 4, status: "a", form: 6, owned: 30, cost: 6 }),
      player({ id: 5, status: "a", form: 4, owned: 10, cost: 8 }),
    ];
    const ids = rankCandidates(pool).map((p) => p.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
    expect(ids).toEqual([4, 5]); // sorted by form×owned/cost desc
  });

  it("pre-tournament (form all 0) still ranks by ownership/value, not feed order", () => {
    // form=0 for everyone (no matches played). The old form×owned/cost score
    // collapsed to 0 → degenerate feed order. Now ownership/value must drive it.
    const pool = [
      player({ id: 1, form: 0, owned: 2, cost: 5 }),
      player({ id: 2, form: 0, owned: 50, cost: 5 }), // most-owned -> first
      player({ id: 3, form: 0, owned: 10, cost: 5 }),
    ];
    expect(rankCandidates(pool).map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("caps the candidate pool at 50", () => {
    const pool = Array.from({ length: 80 }, (_, i) =>
      player({ id: i + 1, form: i + 1 }),
    );
    expect(rankCandidates(pool)).toHaveLength(50);
  });
});

describe("fallbackPicks", () => {
  it("never returns an unavailable player and returns a full XI", () => {
    const pool = [
      player({ id: 1, status: "i", form: 9, owned: 60, cost: 5 }), // injured -> excluded
      ...Array.from({ length: 12 }, (_, i) =>
        player({ id: i + 2, status: "a", form: 12 - i, owned: 40 - i, cost: 6 }),
      ),
    ];
    const ids = fallbackPicks(pool).picks.map((p) => p.playerId);
    expect(ids).not.toContain(1);
    expect(ids).toHaveLength(11);
  });
});
