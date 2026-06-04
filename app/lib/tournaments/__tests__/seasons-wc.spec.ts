import { describe, it, expect } from "vitest";
import {
  getActiveSeason,
  seasonProvider,
  phaseRounds,
  fechaBudget,
  fechaLabel,
  priorPhaseTid,
} from "../seasons";

describe("WC season config", () => {
  it("makes the World Cup the active season with 2 phases", () => {
    const s = getActiveSeason();
    expect(s.label).toBe("World Cup 2026");
    expect(seasonProvider(s)).toBe("fifa-wc");
    expect(s.fechas).toHaveLength(2);
  });
  it("group stage aggregates rounds 1,2,3", () => {
    expect(phaseRounds(getActiveSeason(), 100)).toEqual([1, 2, 3]);
  });
  it("knockout aggregates rounds 4-8", () => {
    expect(phaseRounds(getActiveSeason(), 101)).toEqual([4, 5, 6, 7, 8]);
  });
  it("exposes per-phase budget + label", () => {
    expect(fechaBudget(100)).toBe(100);
    expect(fechaBudget(101)).toBe(105);
    expect(fechaLabel(100)).toBe("Group Stage");
    expect(fechaLabel(101)).toBe("Knockout");
  });
  it("priorPhaseTid: knockout's prior is the group stage; group has none", () => {
    const s = getActiveSeason();
    expect(priorPhaseTid(s, 101)).toBe(100);
    expect(priorPhaseTid(s, 100)).toBeUndefined();
  });
});
