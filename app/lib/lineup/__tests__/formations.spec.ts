import { describe, it, expect } from "vitest";
import {
  FORMATION_KEYS, DEFAULT_FORMATION, formationSlots, formationLayout,
} from "../formations";

describe("formations", () => {
  it("offers the 8 valid formations, default 4-3-3", () => {
    expect(FORMATION_KEYS).toEqual([
      "4-3-3", "3-4-3", "3-5-2", "4-4-2", "4-5-1", "5-2-3", "5-3-2", "5-4-1",
    ]);
    expect(DEFAULT_FORMATION).toBe("4-3-3");
  });
  it("every formation has exactly 11 slots: 1 GK + DEF + MID + FWD", () => {
    for (const k of FORMATION_KEYS) {
      const slots = formationSlots(k);
      expect(slots).toHaveLength(11);
      expect(slots[0]).toBe("GK");
      const [def, mid, fwd] = k.split("-").map(Number);
      expect(slots.filter((p) => p === "DEF")).toHaveLength(def);
      expect(slots.filter((p) => p === "MID")).toHaveLength(mid);
      expect(slots.filter((p) => p === "FWD")).toHaveLength(fwd);
    }
  });
  it("layout returns 11 positioned slots aligned with formationSlots order", () => {
    const layout = formationLayout("4-3-3");
    expect(layout).toHaveLength(11);
    for (const pos of layout) {
      expect(pos.top).toMatch(/%$/);
      expect(pos.left).toMatch(/%$/);
    }
    expect(layout[0].left).toBe("50%");
  });
});
