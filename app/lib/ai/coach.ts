import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { ProviderPlayer } from "@/lib/scoring/provider";
import { filterAvailable } from "@/lib/scoring/availability";

/** The Onze XI: 11 distinct players. */
export const PICKS_COUNT = 11;

// gemini-2.5-flash via the Vercel AI Gateway (free + reliable). We tried OpenRouter's
// free gpt-oss-120b but it mis-assigns positions / routes to flaky providers, so it
// couldn't reliably produce a legal formation. If the model call fails the route
// falls back to deterministic rule-based picks.
const GATEWAY_MODEL = "google/gemini-2.5-flash";

// The coach plays a fixed 4-3-3. Emitting the XI as POSITION LINES lets the
// structured-output schema enforce the per-line counts, so the model can't return
// an illegal shape (given a free choice models tend to over-stack forwards).
const FORMATION = { GK: 1, DEF: 4, MID: 3, FWD: 3 } as const;

const Pick = z.object({
  playerId: z.number().int().min(1).max(65535),
  playerName: z.string(),
  reasoning: z.string().min(20).max(300),
});

/** What the LLM returns: one player line per position (counts = the 4-3-3). */
export const XISchema = z.object({
  gk: z.array(Pick).length(FORMATION.GK),
  def: z.array(Pick).length(FORMATION.DEF),
  mid: z.array(Pick).length(FORMATION.MID),
  fwd: z.array(Pick).length(FORMATION.FWD),
});
type LlmXI = z.infer<typeof XISchema>;

/** Flattened result consumed by the rest of the pipeline. */
export const PicksSchema = z.object({ picks: z.array(Pick).length(PICKS_COUNT) });
export type CoachPicks = z.infer<typeof PicksSchema>;

/**
 * Pure: drop unavailable players, then take the top-50 candidates by
 * (form + 1) × ownership ÷ cost. The (form + 1) keeps the score meaningful
 * PRE-tournament, when every player's form is 0 — otherwise the product collapses
 * to 0 for everyone and the "top 50" just becomes the feed's order (grouped by
 * squad → the LLM only ever sees the first 1-2 teams). Ownership diversifies across
 * nations, value (÷cost) keeps it budget-aware, form amplifies once matches play.
 */
export function rankCandidates(players: ProviderPlayer[]): ProviderPlayer[] {
  const score = (p: ProviderPlayer) =>
    ((p.form + 1) * p.owned) / Math.max(p.cost, 0.1);
  return filterAvailable(players)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 50);
}

function buildPrompt(
  mw: number,
  topPlayers: { id: number; position: string }[],
  budget: number,
): string {
  return `You are an expert fantasy football analyst picking a World Cup XI for round ${mw}.
Build a 4-3-3: exactly 1 goalkeeper (gk), 4 defenders (def), 3 midfielders (mid), 3 forwards (fwd) — 11 DISTINCT players.
Put each player in the line that matches their listed position (a GK in "gk", a DEF in "def", etc.).
The total cost of all 11 picks must be AT MOST ${budget}M (each candidate's "cost" is in M).
Pick the highest-upside players for each line considering form, ownership, value and fixtures. Every candidate is confirmed available.

Candidates (id, name, team, position, cost, form, owned):
${JSON.stringify(topPlayers, null, 2)}

Return gk (1), def (4), mid (3), fwd (3), each pick with playerId, playerName and a 1-2 sentence reasoning.`;
}

async function generateXI(prompt: string): Promise<LlmXI> {
  const result = await generateObject({ model: gateway(GATEWAY_MODEL), schema: XISchema, prompt });
  return result.object;
}

export async function generateCoachPicks(
  mw: number,
  players: ProviderPlayer[],
  budget?: number,
): Promise<CoachPicks> {
  const topPlayers = rankCandidates(players).map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    position: p.position,
    cost: p.cost,
    form: p.form,
    owned: p.owned,
    total_points: p.totalPoints,
  }));
  const prompt = buildPrompt(mw, topPlayers, budget ?? Infinity);

  const xi = await generateXI(prompt);

  const meta = new Map(topPlayers.map((p) => [p.id, p]));
  // Every pick must be in the pool AND sit in the line matching its real position
  // (the schema fixes the counts; this guarantees a legal 4-3-3 of real players).
  for (const [key, pos] of [["gk", "GK"], ["def", "DEF"], ["mid", "MID"], ["fwd", "FWD"]] as const) {
    for (const pk of xi[key]) {
      const m = meta.get(pk.playerId);
      if (!m) throw new Error("LLM returned a player outside the available candidate pool");
      if (m.position !== pos) throw new Error(`LLM put a ${m.position} in the ${pos} line`);
    }
  }

  const picks = [...xi.gk, ...xi.def, ...xi.mid, ...xi.fwd];
  if (new Set(picks.map((p) => p.playerId)).size !== PICKS_COUNT)
    throw new Error("LLM returned duplicate player IDs");
  if (budget != null) {
    const spent = picks.reduce((s, p) => s + (meta.get(p.playerId)?.cost ?? 0), 0);
    if (spent > budget) throw new Error(`LLM XI over budget (${spent.toFixed(1)}/${budget}M)`);
  }
  return { picks };
}
