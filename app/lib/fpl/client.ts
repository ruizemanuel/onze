const FPL = "https://fantasy.premierleague.com/api";

export type FplPlayerElement = {
  id: number;
  code: number;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  selected_by_percent: string;
  form: string;
  total_points: number;
  status: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
};

export type FplTeam = {
  id: number;
  name: string;
  short_name: string;
};

export type FplBootstrap = {
  elements: FplPlayerElement[];
  teams: FplTeam[];
};

export type FplLiveElementStats = {
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
};

export type FplLiveElement = {
  id: number;
  stats: FplLiveElementStats;
};

export type FplLive = {
  elements: FplLiveElement[];
};

export async function getBootstrap(): Promise<FplBootstrap> {
  const r = await fetch(`${FPL}/bootstrap-static/`, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`FPL bootstrap ${r.status}`);
  return (await r.json()) as FplBootstrap;
}

export async function getLive(mw: number): Promise<FplLive> {
  const r = await fetch(`${FPL}/event/${mw}/live/`, { next: { revalidate: 60 } });
  if (!r.ok) throw new Error(`FPL live ${mw} ${r.status}`);
  return (await r.json()) as FplLive;
}

/**
 * Heuristic: a matchweek is "settled" when at least ~100 players have minutes > 0
 * (covers the case of all 10 fixtures being played, ~5 starters per team × 20 teams).
 * FPL marks `data_checked` on bootstrap once BPS bonus is finalized — for V1 we use this
 * proxy because bootstrap re-fetch is more expensive than a single live call.
 */
export async function isMwSettled(mw: number): Promise<boolean> {
  const live = await getLive(mw);
  const played = live.elements.filter((e) => e.stats.minutes > 0).length;
  return played >= 100;
}
