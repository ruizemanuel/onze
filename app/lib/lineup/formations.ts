export type Position = "GK" | "DEF" | "MID" | "FWD";
export type PitchPosition = { top: string; left: string };

/** def-mid-fwd counts (GK is always 1). All sum to 10 outfield + 1 GK = 11. */
export const FORMATIONS: Record<string, { def: number; mid: number; fwd: number }> = {
  "4-3-3": { def: 4, mid: 3, fwd: 3 },
  "3-4-3": { def: 3, mid: 4, fwd: 3 },
  "3-5-2": { def: 3, mid: 5, fwd: 2 },
  "4-4-2": { def: 4, mid: 4, fwd: 2 },
  "4-5-1": { def: 4, mid: 5, fwd: 1 },
  "5-2-3": { def: 5, mid: 2, fwd: 3 },
  "5-3-2": { def: 5, mid: 3, fwd: 2 },
  "5-4-1": { def: 5, mid: 4, fwd: 1 },
};

export const FORMATION_KEYS = Object.keys(FORMATIONS);
export const DEFAULT_FORMATION = "4-3-3";

/** Ordered position list for a formation: GK, then DEF, MID, FWD. Length 11. */
export function formationSlots(formation: string): Position[] {
  const f = FORMATIONS[formation] ?? FORMATIONS[DEFAULT_FORMATION];
  return [
    "GK",
    ...Array<Position>(f.def).fill("DEF"),
    ...Array<Position>(f.mid).fill("MID"),
    ...Array<Position>(f.fwd).fill("FWD"),
  ];
}

// Row depth on the pitch (top %): GK at the back, FWD up front.
const ROW_TOP: Record<Position, string> = {
  GK: "88%", DEF: "68%", MID: "44%", FWD: "20%",
};

function row(pos: Position, k: number): PitchPosition[] {
  return Array.from({ length: k }, (_, i) => ({
    top: ROW_TOP[pos],
    left: `${Math.round(((i + 1) / (k + 1)) * 100)}%`,
  }));
}

/** {top,left} per slot, same order/length as formationSlots. */
export function formationLayout(formation: string): PitchPosition[] {
  const f = FORMATIONS[formation] ?? FORMATIONS[DEFAULT_FORMATION];
  return [
    { top: ROW_TOP.GK, left: "50%" },
    ...row("DEF", f.def),
    ...row("MID", f.mid),
    ...row("FWD", f.fwd),
  ];
}
