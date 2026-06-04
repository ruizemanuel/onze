import { describe, it, expect } from "vitest";
import { providerPlayerToUi, initialsFor, teamColorFor } from "../uiPlayer";
import type { ProviderPlayer } from "@/lib/scoring/provider";

const base: ProviderPlayer = {
  id: 7, name: "Lionel Messi", team: "ARG", position: "FWD", cost: 12.5,
  form: 8.1, owned: 44, totalPoints: 91, status: "a",
  chanceThisRound: null, chanceNextRound: null,
};

describe("providerPlayerToUi", () => {
  it("maps fields and derives initials + a stable team color", () => {
    const ui = providerPlayerToUi(base);
    expect(ui).toMatchObject({
      id: 7, name: "Lionel Messi", team: "ARG", position: "FWD",
      cost: 12.5, form: 8.1, owned: 44, points: 91,
    });
    expect(ui.initials).toBe("LM");
    expect(ui.teamColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(ui.photoUrl).toBe("");
    expect(ui.eliminated).toBe(false);
  });
  it("passes eliminated: true when the provider player is eliminated", () => {
    const ui = providerPlayerToUi({ ...base, eliminated: true });
    expect(ui.eliminated).toBe(true);
  });
  it("gives the same team the same color (stable)", () => {
    expect(teamColorFor("ARG")).toBe(teamColorFor("ARG"));
  });
  it("derives single-token initials from one name", () => {
    expect(initialsFor("Neymar")).toBe("NE");
  });
});
