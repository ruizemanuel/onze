import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Match } from "@/lib/fixtures/fixtures";
import { MatchRow } from "./MatchRow";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as Record<string, string>)} />;
  },
}));

function match(over: Partial<Match> = {}): Match {
  return {
    id: 1, kickoff: "2026-06-11T20:00:00+01:00",
    status: "upcoming",
    home: { squadId: 28, name: "Mexico", abbr: "MEX", score: null, penalties: null },
    away: { squadId: 40, name: "South Africa", abbr: "RSA", score: null, penalties: null },
    goals: [],
    ...over,
  };
}

describe("MatchRow", () => {
  it("shows both team abbreviations and kit images", () => {
    render(<MatchRow match={match()} />);
    expect(screen.getByText("MEX")).toBeInTheDocument();
    expect(screen.getByText("RSA")).toBeInTheDocument();
    expect(screen.getByAltText("Mexico")).toBeInTheDocument();
    expect(screen.getByAltText("South Africa")).toBeInTheDocument();
  });

  it("shows the score and an FT badge for a finished match", () => {
    render(<MatchRow match={match({ status: "finished", home: { squadId: 28, name: "Mexico", abbr: "MEX", score: 2, penalties: 0 }, away: { squadId: 40, name: "South Africa", abbr: "RSA", score: 0, penalties: 0 } })} />);
    expect(screen.getByText("FT")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows a LIVE badge for an in-play match", () => {
    render(<MatchRow match={match({ status: "live", home: { squadId: 28, name: "Mexico", abbr: "MEX", score: 1, penalties: null }, away: { squadId: 40, name: "South Africa", abbr: "RSA", score: 1, penalties: null } })} />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows penalties for a KO match decided on pens", () => {
    render(<MatchRow match={match({ status: "finished", home: { squadId: 28, name: "Mexico", abbr: "MEX", score: 1, penalties: 4 }, away: { squadId: 40, name: "South Africa", abbr: "RSA", score: 1, penalties: 3 } })} />);
    expect(screen.getByText(/4.?3 pens/i)).toBeInTheDocument();
  });
});
