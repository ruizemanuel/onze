import type { ProviderPlayer } from "@/lib/scoring/provider";

/** The shape the builder UI consumes (provider-agnostic). */
export type UiPlayer = {
  id: number;
  name: string;
  team: string;
  teamColor: string;
  position: string; // "GK" | "DEF" | "MID" | "FWD"
  cost: number;
  form: number;
  owned: number;
  points: number;
  photoUrl: string;
  initials: string;
  eliminated: boolean;
};

/** Two-letter initials from a name ("Lionel Messi" -> "LM", "Neymar" -> "NE"). */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = [
  "#00DF7C", "#5AA9FF", "#F5C842", "#FF6B6B", "#B388FF",
  "#4ECDC4", "#FF8A5B", "#9AE66E", "#FF5BA0", "#5BC0EB",
];

/** Deterministic color for a team code, so a team always renders the same hue. */
export function teamColorFor(team: string): string {
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function providerPlayerToUi(p: ProviderPlayer): UiPlayer {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    teamColor: teamColorFor(p.team),
    position: p.position,
    cost: p.cost,
    form: p.form,
    owned: p.owned,
    points: p.totalPoints,
    photoUrl: "", // provider feed has no photo; PlayerSlot falls back to initials
    initials: initialsFor(p.name),
    eliminated: p.eliminated ?? false,
  };
}
