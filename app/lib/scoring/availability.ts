import type { ProviderPlayer } from "./provider";

// Task X.1: keep only players who will actually play. Available status differs
// by provider: FPL uses "a" (anything else — doubtful "d", injured "i",
// suspended "s", unavailable "u", not-in-squad "n" — is excluded), while FIFA's
// World Cup feed uses "playing" (not-called-up players arrive as "transferred"
// and are already dropped at the provider seam). A null chance-of-playing means
// no concern was flagged, so treat it as fit (100). We gate on BOTH this-round
// and next-round because picks are published before the round plays.
const CHANCE_GATE = 75;
const AVAILABLE_STATUSES = new Set(["a", "playing"]);

export function filterAvailable(players: ProviderPlayer[]): ProviderPlayer[] {
  return players.filter(
    (p) =>
      AVAILABLE_STATUSES.has(p.status) &&
      (p.chanceThisRound ?? 100) >= CHANCE_GATE &&
      (p.chanceNextRound ?? 100) >= CHANCE_GATE,
  );
}
