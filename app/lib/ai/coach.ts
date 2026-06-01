import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { ProviderPlayer } from "@/lib/scoring/provider";
import { filterAvailable } from "@/lib/scoring/availability";

/** The Onze XI: 11 distinct players. */
export const PICKS_COUNT = 11;

export const PicksSchema = z.object({
  picks: z
    .array(
      z.object({
        playerId: z.number().int().min(1).max(65535),
        playerName: z.string(),
        reasoning: z.string().min(20).max(300),
      }),
    )
    .length(PICKS_COUNT),
});

export type CoachPicks = z.infer<typeof PicksSchema>;

/**
 * Pure: drop unavailable players, then take the top-50 candidates by
 * form × ownership ÷ cost. Exported so it can be unit-tested without the LLM call.
 */
export function rankCandidates(players: ProviderPlayer[]): ProviderPlayer[] {
  return filterAvailable(players)
    .sort(
      (a, b) =>
        (b.form * b.owned) / Math.max(b.cost, 0.1) -
        (a.form * a.owned) / Math.max(a.cost, 0.1),
    )
    .slice(0, 50);
}

export async function generateCoachPicks(
  mw: number,
  players: ProviderPlayer[],
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

  const result = await generateObject({
    model: gateway("anthropic/claude-sonnet-4-6"),
    schema: PicksSchema,
    prompt: `You are an expert fantasy football analyst picking a World Cup XI for round ${mw}.
Pick the ${PICKS_COUNT} players most likely to deliver high points. All ${PICKS_COUNT} must be DISTINCT player IDs.
Consider: recent form, fixture difficulty, ownership, and value.
Every candidate below has already been confirmed available to play — do not worry about injuries or suspensions.

Top 50 candidates (sorted by form × ownership ÷ cost):
${JSON.stringify(topPlayers, null, 2)}

Output the ${PICKS_COUNT} best picks with their playerId, playerName, and a 1-2 sentence reasoning each.`,
  });

  // Validate distinct IDs
  const ids = new Set(result.object.picks.map((p) => p.playerId));
  if (ids.size !== PICKS_COUNT) throw new Error("LLM returned duplicate player IDs");
  // Enforce: every pick must be inside the filtered candidate pool. A hallucinated
  // id for an unavailable player would otherwise be committed on-chain.
  const allowed = new Set(topPlayers.map((p) => p.id));
  if (result.object.picks.some((p) => !allowed.has(p.playerId)))
    throw new Error("LLM returned a player outside the available candidate pool");
  return result.object;
}
