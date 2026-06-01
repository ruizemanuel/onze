import { describe, it, expect } from "vitest";
import {
  getActiveSeason,
  seasonProvider,
  phaseRounds,
  fechaBudget,
  fechaLabel,
} from "../seasons";

describe("WC season config", () => {
  it("makes the World Cup the active season", () => {
    const s = getActiveSeason();
    expect(s.label).toBe("Copa del Mundo 2026");
    expect(seasonProvider(s)).toBe("fifa-wc");
    expect(s.fechas).toHaveLength(6);
  });
  it("groups stage aggregates rounds 1,2,3", () => {
    const s = getActiveSeason();
    expect(phaseRounds(s, 100)).toEqual([1, 2, 3]);
  });
  it("knockout phases aggregate a single round", () => {
    const s = getActiveSeason();
    expect(phaseRounds(s, 101)).toEqual([4]);
  });
  it("exposes per-phase budget (100 groups / 105 KO) and label", () => {
    expect(fechaBudget(100)).toBe(100);
    expect(fechaBudget(101)).toBe(105);
    expect(fechaLabel(100)).toBe("Fase de grupos");
    expect(fechaLabel(105)).toBe("Final");
  });
});
