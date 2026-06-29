"use client";

import { PhaseSwitcher } from "@/components/design/PhaseSwitcher";

/** Client wrapper so the (server) leaderboard page never passes a function prop
 * across the RSC boundary — `hrefFor` is defined here, inside the client component.
 * `tid` undefined = the Overall (season-aggregate) view. */
export function LeaderboardPhaseSwitcher({ tid }: { tid?: number }) {
  return (
    <PhaseSwitcher
      currentTid={tid}
      overallHref="/leaderboard"
      hrefFor={(t) => `/leaderboard?t=${t}`}
    />
  );
}
