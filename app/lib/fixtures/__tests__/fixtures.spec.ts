import { describe, it, expect } from "vitest";
import {
  mapMatch,
  mapRounds,
  currentRoundIndex,
  groupMatchesByDay,
  stageLabel,
  shortDate,
} from "../fixtures";
import type { FifaMatch, FifaRound } from "@/lib/worldcup/client";

function fifaMatch(over: Partial<FifaMatch>): FifaMatch {
  return {
    id: 1, status: "scheduled", period: "pre_match", minutes: 0, extraMinutes: 0,
    date: "2026-06-11T20:00:00+01:00", venueName: "Estadio Banorte", venueCity: "Mexico City",
    venueId: 1, isSuspended: false,
    homeSquadId: 28, awaySquadId: 40, homeSquadName: "Mexico", awaySquadName: "South Africa",
    homeSquadAbbr: "MEX", awaySquadAbbr: "RSA",
    homeScore: null, awayScore: null, homePenaltyScore: null, awayPenaltyScore: null,
    homeGoalScorersAssists: null, awayGoalScorersAssists: null,
    ...over,
  };
}

describe("stageLabel", () => {
  it("maps known stages to friendly labels", () => {
    expect(stageLabel("GROUP")).toBe("Group Stage");
    expect(stageLabel("R32")).toBe("Round of 32");
    expect(stageLabel("F")).toBe("Final");
  });
  it("falls back to the raw value for unknown stages", () => {
    expect(stageLabel("WEIRD")).toBe("WEIRD");
  });
});

describe("shortDate", () => {
  it("formats the ISO date portion as 'Mon D' (timezone-independent)", () => {
    expect(shortDate("2026-06-11T20:00:00+01:00")).toBe("Jun 11");
    expect(shortDate("2026-07-19T22:00:00+01:00")).toBe("Jul 19");
  });
  it("returns empty string for undefined", () => {
    expect(shortDate(undefined)).toBe("");
  });
});

describe("mapMatch", () => {
  it("derives 'finished' from status complete and carries scores", () => {
    const m = mapMatch(fifaMatch({ status: "complete", period: "full_time", homeScore: 2, awayScore: 0, homePenaltyScore: 0, awayPenaltyScore: 0 }));
    expect(m.status).toBe("finished");
    expect(m.home).toMatchObject({ squadId: 28, abbr: "MEX", score: 2 });
    expect(m.away).toMatchObject({ squadId: 40, abbr: "RSA", score: 0 });
  });
  it("derives 'upcoming' from status scheduled", () => {
    expect(mapMatch(fifaMatch({ status: "scheduled" })).status).toBe("upcoming");
  });
  it("derives 'live' from any other (in-play) status", () => {
    expect(mapMatch(fifaMatch({ status: "playing", period: "first_half" })).status).toBe("live");
  });
  it("treats period full_time as finished even if status is an unexpected string", () => {
    expect(mapMatch(fifaMatch({ status: "ended", period: "full_time", homeScore: 1, awayScore: 0 })).status).toBe("finished");
  });
  it("treats period pre_match as upcoming even if status is an unexpected string", () => {
    expect(mapMatch(fifaMatch({ status: "tbd", period: "pre_match" })).status).toBe("upcoming");
  });
  it("carries penalty scores for KO matches", () => {
    const m = mapMatch(fifaMatch({ status: "complete", homeScore: 1, awayScore: 1, homePenaltyScore: 4, awayPenaltyScore: 3 }));
    expect(m.home.penalties).toBe(4);
    expect(m.away.penalties).toBe(3);
  });
});

describe("mapRounds", () => {
  const rounds: FifaRound[] = [
    { id: 1, status: "playing", stage: "GROUP", startDate: "2026-06-11T20:00:00+01:00", endDate: "2026-06-18T05:00:00+01:00",
      tournaments: [fifaMatch({ id: 1, status: "complete", homeScore: 2, awayScore: 0 })] },
    { id: 4, status: "scheduled", stage: "R32", tournaments: [] }, // empty KO
    { id: 5, status: "scheduled", stage: "R16" }, // tournaments absent
  ];
  it("maps each round, labels the stage, and tolerates empty/absent matches", () => {
    const out = mapRounds(rounds);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ round: 1, stage: "GROUP", stageLabel: "Group Stage" });
    expect(out[0].matches).toHaveLength(1);
    expect(out[1].matches).toEqual([]); // empty KO
    expect(out[2].matches).toEqual([]); // absent tournaments -> []
  });
});

describe("currentRoundIndex", () => {
  it("returns 0 for no rounds", () => {
    expect(currentRoundIndex([])).toBe(0);
  });
  it("picks a round that is in play (mixed finished + upcoming)", () => {
    const out = mapRounds([
      { id: 1, status: "complete", stage: "GROUP", tournaments: [fifaMatch({ id: 1, status: "complete", homeScore: 1, awayScore: 0 })] },
      { id: 2, status: "playing", stage: "GROUP", tournaments: [
        fifaMatch({ id: 2, status: "complete", homeScore: 0, awayScore: 0 }),
        fifaMatch({ id: 3, status: "scheduled" }),
      ] },
      { id: 3, status: "scheduled", stage: "GROUP", tournaments: [fifaMatch({ id: 4, status: "scheduled" })] },
    ]);
    expect(currentRoundIndex(out)).toBe(1);
  });
  it("picks the first round with upcoming matches when nothing is in play yet", () => {
    const out = mapRounds([
      { id: 1, status: "scheduled", stage: "GROUP", tournaments: [fifaMatch({ id: 1, status: "scheduled" })] },
      { id: 2, status: "scheduled", stage: "GROUP", tournaments: [fifaMatch({ id: 2, status: "scheduled" })] },
    ]);
    expect(currentRoundIndex(out)).toBe(0);
  });
  it("falls back to the last round with any matches", () => {
    const out = mapRounds([
      { id: 1, status: "complete", stage: "GROUP", tournaments: [fifaMatch({ id: 1, status: "complete", homeScore: 1, awayScore: 1 })] },
      { id: 2, status: "scheduled", stage: "R32", tournaments: [] },
    ]);
    expect(currentRoundIndex(out)).toBe(0);
  });
});

describe("groupMatchesByDay", () => {
  it("groups by the FIFA date portion, sorted ascending", () => {
    const matches = mapRounds([
      { id: 1, status: "playing", stage: "GROUP", tournaments: [
        fifaMatch({ id: 1, date: "2026-06-12T20:00:00+01:00" }),
        fifaMatch({ id: 2, date: "2026-06-11T20:00:00+01:00" }),
        fifaMatch({ id: 3, date: "2026-06-11T23:00:00+01:00" }),
      ] },
    ])[0].matches;
    const grouped = groupMatchesByDay(matches);
    expect(grouped.map((g) => g.day)).toEqual(["2026-06-11", "2026-06-12"]);
    expect(grouped[0].matches).toHaveLength(2);
    expect(grouped[1].matches).toHaveLength(1);
  });
});

describe("mapMatch goals", () => {
  it("maps home then away goal scorers with side + assist", () => {
    const m = mapMatch(fifaMatch({
      homeGoalScorersAssists: [{ playerId: 100, assistId: 200 }, { playerId: 101, assistId: null }],
      awayGoalScorersAssists: [{ playerId: 300, assistId: 301 }],
    }));
    expect(m.goals).toEqual([
      { side: "home", scorerId: 100, assistId: 200 },
      { side: "home", scorerId: 101, assistId: null },
      { side: "away", scorerId: 300, assistId: 301 },
    ]);
  });
  it("defaults to no goals when the feed arrays are null", () => {
    expect(mapMatch(fifaMatch({})).goals).toEqual([]);
  });
});
