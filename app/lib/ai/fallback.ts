import type { ProviderPlayer } from "@/lib/scoring/provider";
import { rankCandidates, PICKS_COUNT, type CoachPicks } from "./coach";

export function fallbackPicks(players: ProviderPlayer[]): CoachPicks {
  return {
    picks: rankCandidates(players)
      .slice(0, PICKS_COUNT)
      .map((p) => ({
        playerId: p.id,
        playerName: p.name,
        reasoning: "Selected via rule-based fallback (form × ownership ÷ cost).",
      })),
  };
}
