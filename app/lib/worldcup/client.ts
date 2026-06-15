// Thin client for FIFA's (unofficial, free) World Cup Fantasy JSON.
// Mirrors lib/fpl/client.ts: fetch + typed JSON only; all transformation lives
// in the tested pure mappers in lib/scoring/worldcup-provider.ts.
// Endpoints verified live + open 2026-05-31. No SLA — treat as best-effort.

const FIFA = "https://play.fifa.com/json/fantasy";

export type FifaPlayerStats = {
  totalPoints: number;
  avgPoints: number;
  form: number;
  lastRoundPoints: number;
  // points per FIFA round, indexed by round id (1..8); empty pre-tournament.
  roundPoints: number[];
};

export type FifaFantasyPlayer = {
  id: number;
  firstName: string;
  lastName: string;
  knownName: string | null;
  squadId: number; // -> FifaSquad.id
  position: "GK" | "DEF" | "MID" | "FWD";
  price: number;
  status: string; // e.g. "playing"
  percentSelected: number;
  stats: FifaPlayerStats;
};

export type FifaSquad = {
  id: number;     // matches FifaFantasyPlayer.squadId (1..48, the World Cup field)
  name: string;   // e.g. "Algeria"
  abbr?: string;  // 3-letter code, e.g. "ALG"
  isEliminated?: boolean; // squads.json flag — true once the squad is knocked out
};

export type FifaMatch = {
  id: number;
  status: string; // "scheduled" | "complete" | (in-play string, e.g. "playing")
  period: string; // "pre_match" | "full_time" | (in-play)
  minutes: number;
  extraMinutes: number;
  date: string; // ISO w/ offset, e.g. "2026-06-11T20:00:00+01:00"
  venueName?: string;
  venueCity?: string;
  venueId?: number;
  isSuspended?: boolean;
  homeSquadId: number; // 1..48 -> kits/{id}.png
  awaySquadId: number;
  homeSquadName: string;
  awaySquadName: string;
  homeSquadAbbr: string;
  awaySquadAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  homeGoalScorersAssists: { playerId: number; assistId: number | null }[] | null;
  awayGoalScorersAssists: { playerId: number; assistId: number | null }[] | null;
};

export type FifaRound = {
  id: number;
  status: string; // "scheduled" | "open" | "closed" | "playing" | ...
  startDate?: string;
  endDate?: string;
  stage?: string;
  tournaments?: FifaMatch[]; // FIFA's name for the round's matches; absent/empty before a round is seeded
};

async function getJson<T>(path: string, revalidate: number): Promise<T> {
  // revalidate > 0 → Next Data Cache (stale-while-revalidate). revalidate <= 0 →
  // no cache: fetch fresh every request (used by the fixtures route so /fixtures is
  // never served stale on entry).
  const r = await fetch(
    `${FIFA}/${path}`,
    revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`FIFA ${path} ${r.status}`);
  return (await r.json()) as T;
}

/** Raw players list (the JSON is `{ players: [...] }` OR a bare array; normalize). */
export async function getFifaPlayers(): Promise<FifaFantasyPlayer[]> {
  const data = await getJson<FifaFantasyPlayer[] | { players: FifaFantasyPlayer[] }>(
    "players.json",
    3600,
  );
  return Array.isArray(data) ? data : data.players;
}

// NOTE: use `squads.json` (the 48-team field, ids 1..48 keyed to player.squadId),
// NOT `squads_fifa.json` (FIFA-internal ids like 43817 that DON'T match squadId, so
// the team lookup silently fell back to "").
export async function getFifaSquads(): Promise<FifaSquad[]> {
  const data = await getJson<FifaSquad[] | { squads: FifaSquad[] }>("squads.json", 86400);
  return Array.isArray(data) ? data : data.squads;
}

export async function getFifaRounds(revalidate = 600): Promise<FifaRound[]> {
  const data = await getJson<FifaRound[] | { rounds: FifaRound[] }>("rounds.json", revalidate);
  return Array.isArray(data) ? data : data.rounds;
}
