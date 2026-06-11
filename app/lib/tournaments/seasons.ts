// Off-chain season config — the single source mapping each fecha (a gameweek
// Pick5Pool) to its FPL round, grouping fechas into a season, and pointing at the
// season's on-chain SeasonPool id. The contracts store no FPL round numbers, so
// this maps them. Update the entries to match the tournaments/seasons the factory
// actually created before each deploy (Tanda C4).

export type Fecha = {
  tournamentId: number; // factory.tournamentBy(tournamentId)
  round: number;        // primary provider round (back-compat; first of `rounds`)
  rounds?: number[];    // a phase may aggregate several provider rounds (WC group = [1,2,3])
  label?: string;       // human phase label, e.g. "Fase de grupos" (defaults to `GW{round}`)
  budget?: number;      // squad budget cap in millions for this phase (defaults to 100)
};

export type Season = {
  seasonId: number;     // factory.seasonBy(seasonId) -> SeasonPool
  label: string;
  provider?: string;    // ScoreProvider id; defaults to "fpl"
  fechas: Fecha[];
};

// World Cup 2026 — the only active season. On the fresh Onze factory (Celo mainnet,
// 0x920A592438582FB2Ee6522Bd769e2Ae2f798C9f6) the Group Stage is tournament #0, the
// Knockout is tournament #1 (created when the groups end — Phase 7), and the season is
// SeasonPool #0. The Premier entry was removed: on this factory its ids (seasonId 0 /
// tournamentId 0,1) collide with the WC and would mis-resolve. Until the Knockout pool
// is created, tournamentId 1 resolves to a zero address and the builder gates its join.
export const SEASONS: Season[] = [
  {
    seasonId: 0,
    label: "World Cup 2026",
    provider: "fifa-wc",
    fechas: [
      { tournamentId: 0, round: 1, rounds: [1, 2, 3], label: "Group Stage", budget: 100 },
      { tournamentId: 1, round: 4, rounds: [4, 5, 6, 7, 8], label: "Knockout", budget: 105 },
    ],
  },
];

/** The current season = the highest seasonId in the config. */
export function getActiveSeason(): Season {
  return SEASONS.reduce((a, b) => (b.seasonId > a.seasonId ? b : a), SEASONS[0]);
}

export function getSeasonById(seasonId: number): Season | undefined {
  return SEASONS.find((s) => s.seasonId === seasonId);
}

/** The season that contains a given fecha (tournamentId), if any. */
export function seasonForFecha(tournamentId: number): Season | undefined {
  return SEASONS.find((s) => s.fechas.some((f) => f.tournamentId === tournamentId));
}

/** The FPL round a fecha scores, or undefined if the tournamentId isn't configured. */
export function fechaRound(tournamentId: number): number | undefined {
  for (const s of SEASONS) {
    const f = s.fechas.find((x) => x.tournamentId === tournamentId);
    if (f) return f.round;
  }
  return undefined;
}

/** All tournamentIds belonging to a season. */
export function seasonFechaIds(season: Season): number[] {
  return season.fechas.map((f) => f.tournamentId);
}

/**
 * The 1-based position of a fecha within its season (the user-facing "Fecha N"),
 * or undefined if the tournamentId isn't configured. This is the single source
 * for the fecha number — derive it from the config, never from the raw
 * tournamentId, which need not be 0-based or contiguous on-chain.
 */
export function fechaNumber(tournamentId: number): number | undefined {
  for (const s of SEASONS) {
    const idx = s.fechas.findIndex((f) => f.tournamentId === tournamentId);
    if (idx >= 0) return idx + 1;
  }
  return undefined;
}

/** Is `round` an FPL round configured in any season? (coach mw validation) */
export function isConfiguredRound(round: number): boolean {
  return SEASONS.some((s) => s.fechas.some((f) => f.round === round));
}

/** The provider rounds a fecha/phase aggregates (rounds[] if set, else [round]). */
export function phaseRounds(season: Season, tournamentId: number): number[] {
  const f = season.fechas.find((x) => x.tournamentId === tournamentId);
  if (!f) return [];
  return f.rounds ?? [f.round];
}

/** A season's ScoreProvider id (defaults to "fpl"). */
export function seasonProvider(season: Season): string {
  return season.provider ?? "fpl";
}

/** The squad budget (in millions) for a fecha/phase. Defaults to 100. */
export function fechaBudget(tournamentId: number): number {
  for (const s of SEASONS) {
    const f = s.fechas.find((x) => x.tournamentId === tournamentId);
    if (f) return f.budget ?? 100;
  }
  return 100;
}

/** The squad budget (in millions) for a phase by its PRIMARY round (mw). Used by
 * the coach, which works in rounds (mw=1 group / mw=4 knockout), not tournamentIds.
 * Defaults to 100. */
export function roundBudget(round: number): number {
  for (const s of SEASONS) {
    const f = s.fechas.find((x) => x.round === round);
    if (f) return f.budget ?? 100;
  }
  return 100;
}

/** The human label for a fecha/phase, falling back to `GW{round}`. */
export function fechaLabel(tournamentId: number): string {
  for (const s of SEASONS) {
    const f = s.fechas.find((x) => x.tournamentId === tournamentId);
    if (f) return f.label ?? `GW${f.round}`;
  }
  return `#${tournamentId}`;
}

/** The tournamentId of the phase immediately before `tournamentId` in its season
 * (e.g. Group Stage for the Knockout pool), or undefined if it's the first phase. */
export function priorPhaseTid(season: Season, tournamentId: number): number | undefined {
  const idx = season.fechas.findIndex((f) => f.tournamentId === tournamentId);
  return idx > 0 ? season.fechas[idx - 1].tournamentId : undefined;
}
