"use client";

import Link from "next/link";
import type { Route } from "next";
import { useAccount } from "wagmi";
import { usePool } from "@/hooks/usePool";

/**
 * The desktop landing's torn-ticket CTA. Mirrors the routing logic of the
 * mobile <LandingCTA>: a connected wallet that already joined resumes at
 * /play; a finalized tournament points at /results; everyone else enters
 * the join funnel at /play (which redirects to the active fecha). Styling
 * comes from the `.lp-` classes in the landing page's inline <style> block.
 */
export function DesktopTicketCTA() {
  const { isConnected } = useAccount();
  const pool = usePool();

  let href: Route = "/play" as Route;
  let label = "KICK OFF";
  if (pool.isFinalized) {
    href = "/results" as Route;
    label = "SEE RESULTS";
  } else if (isConnected && pool.hasJoined) {
    href = "/play" as Route;
    label = "VIEW TEAM";
  } else if (pool.isLocked) {
    // Entries are closed once the pool locks — point at the live standings.
    href = "/leaderboard" as Route;
    label = "SEE STANDINGS";
  }

  return (
    <Link href={href} className="lp-ticket-cta lp-anim lp-anim-d7">
      <span className="lp-cta-stub">
        ADMIT
        <br />
        <b>ONE · $1</b>
      </span>
      <span className="lp-cta-body">{label}</span>
    </Link>
  );
}
