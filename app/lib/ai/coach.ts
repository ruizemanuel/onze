import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { ProviderPlayer } from "@/lib/scoring/provider";
import { filterAvailable } from "@/lib/scoring/availability";

/** The Onze XI: 11 distinct players. */
export const PICKS_COUNT = 11;

// Primary: OpenRouter's free gpt-oss-120b (OpenAI open-weight, strong + free).
// Fallback: gemini-2.5-flash via the Vercel AI Gateway (reliable free). Both are
// free; the route falls back to rule-based picks only if BOTH fail.
const OPENROUTER_MODEL = "openai/gpt-oss-120b:free";
const GATEWAY_MODEL = "google/gemini-2.5-flash";

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

// JSON Schema mirror of PicksSchema for OpenRouter structured outputs (strict).
const PICKS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      minItems: PICKS_COUNT,
      maxItems: PICKS_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["playerId", "playerName", "reasoning"],
        properties: {
          playerId: { type: "integer" },
          playerName: { type: "string" },
          reasoning: { type: "string" },
        },
      },
    },
  },
};

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

function buildPrompt(mw: number, topPlayers: unknown[]): string {
  return `You are an expert fantasy football analyst picking a World Cup XI for round ${mw}.
Pick the ${PICKS_COUNT} players most likely to deliver high points. All ${PICKS_COUNT} must be DISTINCT player IDs.
Consider: recent form, fixture difficulty, ownership, and value.
Every candidate below has already been confirmed available to play — do not worry about injuries or suspensions.

Top 50 candidates (sorted by form × ownership ÷ cost):
${JSON.stringify(topPlayers, null, 2)}

Output the ${PICKS_COUNT} best picks with their playerId, playerName, and a 1-2 sentence reasoning each.`;
}

/** Primary path: OpenRouter (OpenAI-compatible) with strict json_schema output. */
async function picksViaOpenRouter(prompt: string): Promise<CoachPicks> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: { name: "picks", strict: true, schema: PICKS_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned empty content");
  return PicksSchema.parse(JSON.parse(content));
}

/** Fallback path: Vercel AI Gateway (gemini-2.5-flash) via the AI SDK. */
async function picksViaGateway(prompt: string): Promise<CoachPicks> {
  const result = await generateObject({
    model: gateway(GATEWAY_MODEL),
    schema: PicksSchema,
    prompt,
  });
  return result.object;
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
  const prompt = buildPrompt(mw, topPlayers);

  let picks: CoachPicks;
  try {
    picks = await picksViaOpenRouter(prompt);
  } catch (e) {
    console.warn("OpenRouter coach failed, falling back to gateway:", e instanceof Error ? e.message : e);
    picks = await picksViaGateway(prompt);
  }

  // Validate distinct IDs
  const ids = new Set(picks.picks.map((p) => p.playerId));
  if (ids.size !== PICKS_COUNT) throw new Error("LLM returned duplicate player IDs");
  // Enforce: every pick must be inside the filtered candidate pool. A hallucinated
  // id for an unavailable player would otherwise be committed on-chain.
  const allowed = new Set(topPlayers.map((p) => p.id));
  if (picks.picks.some((p) => !allowed.has(p.playerId)))
    throw new Error("LLM returned a player outside the available candidate pool");
  return picks;
}
