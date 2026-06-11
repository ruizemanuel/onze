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
  it("builds a valid 4-3-3 within budget, never an unavailable player", () => {
    const mk = (id: number, position: ProviderPlayer["position"], cost: number) =>
      player({ id, status: "a", position, cost, form: 0, owned: 10 });
    const pool = [
      player({ id: 99, status: "i", position: "FWD", cost: 4 }), // injured -> excluded
      mk(1, "GK", 5), mk(2, "GK", 5),
      ...[3, 4, 5, 6, 7].map((id) => mk(id, "DEF", 5)),
      ...[8, 9, 10, 11, 12].map((id) => mk(id, "MID", 6)),
      ...[13, 14, 15, 16].map((id) => mk(id, "FWD", 7)),
    ];
    const ids = fallbackPicks(pool, 100).picks.map((p) => p.playerId);
    expect(ids).toHaveLength(11);
    expect(ids).not.toContain(99);
    const byId = new Map(pool.map((p) => [p.id, p]));
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const id of ids) c[byId.get(id)!.position as keyof typeof c]++;
    expect(c).toEqual({ GK: 1, DEF: 4, MID: 3, FWD: 3 });
    const spent = ids.reduce((s, id) => s + byId.get(id)!.cost, 0);
    expect(spent).toBeLessThanOrEqual(100);
  });
});
