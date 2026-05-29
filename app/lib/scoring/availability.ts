import type { ProviderPlayer } from "./provider";

// Task X.1: keep only players who will actually play. FPL `status` "a" =
// available; anything else (doubtful "d", injured "i", suspended "s",
// unavailable "u", not-in-squad "n") is excluded. A null chance-of-playing
// means FPL hasn't flagged a concern, so treat it as fit (100). We gate on
// BOTH this-round and next-round because picks are published before the
// round plays (Wed-publish / Sat-play windows).
const CHANCE_GATE = 75;

export function filterAvailable(players: ProviderPlayer[]): ProviderPlayer[] {
  return players.filter(
    (p) =>
      p.status === "a" &&
      (p.chanceThisRound ?? 100) >= CHANCE_GATE &&
      (p.chanceNextRound ?? 100) >= CHANCE_GATE,
  );
}
