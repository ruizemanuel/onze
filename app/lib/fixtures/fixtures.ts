import type { FifaMatch, FifaRound } from "@/lib/worldcup/client";

export type MatchStatus = "upcoming" | "live" | "finished";

export type Side = {
  squadId: number;
  name: string;
  abbr: string;
  score: number | null;
  penalties: number | null;
};

export type Match = {
  id: number;
  kickoff: string; // ISO from FIFA `date`
  status: MatchStatus;
  home: Side;
  away: Side;
};

export type RoundFixtures = {
  round: number;
  stage: string;
  stageLabel: string;
  startDate?: string;
  endDate?: string;
  matches: Match[];
};

export const STAGE_LABEL: Record<string, string> = {
  GROUP: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  F: "Final",
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Timezone-independent "Mon D" from an ISO string's date portion. */
export function shortDate(iso?: string): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function matchStatus(m: FifaMatch): MatchStatus {
  if (m.status === "complete" || m.period === "full_time") return "finished";
  if (m.status === "scheduled" || m.period === "pre_match") return "upcoming";
  return "live"; // genuinely in-play (status/period are mid-match values)
}

export function mapMatch(m: FifaMatch): Match {
  return {
    id: m.id,
    kickoff: m.date,
    status: matchStatus(m),
    home: { squadId: m.homeSquadId, name: m.homeSquadName, abbr: m.homeSquadAbbr, score: m.homeScore, penalties: m.homePenaltyScore },
    away: { squadId: m.awaySquadId, name: m.awaySquadName, abbr: m.awaySquadAbbr, score: m.awayScore, penalties: m.awayPenaltyScore },
  };
}

export function mapRounds(rounds: FifaRound[]): RoundFixtures[] {
  return rounds.map((r) => ({
    round: r.id,
    stage: r.stage ?? "",
    stageLabel: stageLabel(r.stage ?? ""),
    startDate: r.startDate,
    endDate: r.endDate,
    matches: (r.tournaments ?? []).map(mapMatch),
  }));
}

/** Index of the round to expand by default. Derived from match statuses only
 * (no wall-clock), so it is deterministic and testable. */
export function currentRoundIndex(rounds: RoundFixtures[]): number {
  if (rounds.length === 0) return 0;
  const inPlay = (r: RoundFixtures) =>
    r.matches.some((m) => m.status === "live") ||
    (r.matches.some((m) => m.status === "finished") && r.matches.some((m) => m.status === "upcoming"));
  let i = rounds.findIndex(inPlay);
  if (i !== -1) return i;
  i = rounds.findIndex((r) => r.matches.some((m) => m.status === "upcoming"));
  if (i !== -1) return i;
  for (let j = rounds.length - 1; j >= 0; j--) if (rounds[j].matches.length > 0) return j;
  return 0;
}

/** Group a round's matches by FIFA calendar day (date portion), sorted ascending. */
export function groupMatchesByDay(matches: Match[]): { day: string; matches: Match[] }[] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const day = m.kickoff.slice(0, 10);
    const list = map.get(day);
    if (list) list.push(m);
    else map.set(day, [m]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, matches]) => ({
      day,
      matches: [...matches].sort((x, y) => x.kickoff.localeCompare(y.kickoff)),
    }));
}
