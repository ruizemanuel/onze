// Provider-agnostic scoring seam. FPL is the only implementation today
// (see fpl-provider.ts); a future World Cup provider would implement the
// same interface so the Coach, oracle, recompute, and reveal paths don't
// change.

export type ProviderPlayer = {
  id: number;
  name: string;
  team: string; // short name, e.g. "ARS"
  position: string; // "GK" | "DEF" | "MID" | "FWD" | "?"
  cost: number; // in millions, e.g. 12.5
  form: number;
  owned: number; // selected-by percentage, 0-100
  totalPoints: number;
  status: string; // provider-defined availability status (e.g. FPL: "a" available, "d" doubtful, "i" injured, "s" suspended, "u"/"n" out)
  chanceThisRound: number | null; // 0-100 probability of featuring this round; null = data unavailable (treat as fit)
  chanceNextRound: number | null; // same, for the next round
};

export interface ScoreProvider {
  id: string; // unique provider identifier, e.g. "fpl"
  getPlayers(): Promise<ProviderPlayer[]>;
  getRoundPoints(round: number): Promise<Map<number, number>>; // playerId -> points
  isRoundSettled(round: number): Promise<boolean>;
}
