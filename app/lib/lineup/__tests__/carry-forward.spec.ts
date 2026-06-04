import { describe, it, expect } from "vitest";
import { buildCarryForwardDraft } from "../carry-forward";

// 4-3-3 order: GK, DEF×4, MID×3, FWD×3
const POS = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD"];
function lookup(elim: number[]) {
  return (id: number) => ({ position: POS[id - 1] ?? "MID", eliminated: elim.includes(id) });
}

describe("buildCarryForwardDraft", () => {
  const priorIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // ids == 4-3-3 slot order

  it("keeps the formation and carries every player when none are eliminated", () => {
    const d = buildCarryForwardDraft(priorIds, 6, lookup([]));
    expect(d.formation).toBe("4-3-3");
    expect(d.slots).toEqual(priorIds);
    expect(d.captainId).toBe(6);
  });
  it("drops eliminated players to empty slots, preserving positions", () => {
    const d = buildCarryForwardDraft(priorIds, 6, lookup([3, 9])); // a DEF + a FWD out
    expect(d.formation).toBe("4-3-3");
    expect(d.slots).toEqual([1, 2, null, 4, 5, 6, 7, 8, null, 10, 11]);
    expect(d.captainId).toBe(6); // captain (6) still in
  });
  it("resets the captain when the captain is eliminated", () => {
    const d = buildCarryForwardDraft(priorIds, 9, lookup([9]));
    expect(d.slots[8]).toBeNull();
    expect(d.captainId).toBeNull();
  });
});
