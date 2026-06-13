import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RoundFixtures } from "@/lib/fixtures/fixtures";
import { RoundSection } from "./RoundSection";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as Record<string, string>)} />;
  },
}));

const groupRound: RoundFixtures = {
  round: 1, stage: "GROUP", stageLabel: "Group Stage",
  startDate: "2026-06-11T20:00:00+01:00", endDate: "2026-06-18T05:00:00+01:00",
  matches: [
    { id: 1, kickoff: "2026-06-11T20:00:00+01:00", status: "finished",
      home: { squadId: 28, name: "Mexico", abbr: "MEX", score: 2, penalties: 0 },
      away: { squadId: 40, name: "South Africa", abbr: "RSA", score: 0, penalties: 0 },
      goals: [] },
  ],
};

const emptyKo: RoundFixtures = { round: 4, stage: "R32", stageLabel: "Round of 32", matches: [] };

describe("RoundSection", () => {
  it("renders the stage label and (when open) its matches", () => {
    render(<RoundSection round={groupRound} defaultOpen />);
    expect(screen.getByText("Group Stage")).toBeInTheDocument();
    expect(screen.getByText("MEX")).toBeInTheDocument();
  });

  it("collapses content when defaultOpen is false and expands on click", () => {
    render(<RoundSection round={groupRound} defaultOpen={false} />);
    expect(screen.queryByText("MEX")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /group stage/i }));
    expect(screen.getByText("MEX")).toBeInTheDocument();
  });

  it("shows a placeholder for an empty knockout round", () => {
    render(<RoundSection round={emptyKo} defaultOpen />);
    expect(screen.getByText(/bracket set after the group stage/i)).toBeInTheDocument();
  });
});
