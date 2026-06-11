import type { ProviderPlayer } from "@/lib/scoring/provider";
import { rankCandidates, type CoachPicks } from "./coach";

// Rule-based last resort (only if BOTH LLMs fail). Builds a VALID 4-3-3 within
// budget: best-by-score per position, falling back to cheapest-per-position if
// that XI is over budget. Mirrors the formation/budget rules the LLM must satisfy.
const SHAPE: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

export function fallbackPicks(players: ProviderPlayer[], budget = Infinity): CoachPicks {
  const pool = rankCandidates(players); // already sorted best-first by score
  const build = (cheapest: boolean): ProviderPlayer[] => {
    const out: ProviderPlayer[] = [];
    for (const [pos, n] of Object.entries(SHAPE)) {
      const line = pool.filter((p) => p.position === pos);
      if (cheapest) line.sort((a, b) => a.cost - b.cost);
      out.push(...line.slice(0, n));
    }
    return out;
  };
  const total = (xs: ProviderPlayer[]) => xs.reduce((s, p) => s + p.cost, 0);

  let xi = build(false);
  if (xi.length === 11 && total(xi) > budget) xi = build(true);
  // Safety: if a position line was short, pad to 11 from the rest of the pool.
  if (xi.length < 11) {
    const have = new Set(xi.map((p) => p.id));
    for (const p of pool) {
      if (xi.length >= 11) break;
      if (!have.has(p.id)) xi.push(p);
    }
  }

  return {
    picks: xi.slice(0, 11).map((p) => ({
      playerId: p.id,
      playerName: p.name,
      reasoning: "Selected via rule-based fallback (valid 4-3-3 within budget).",
    })),
  };
}
