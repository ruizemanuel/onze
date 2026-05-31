"use client";

import { useAccount } from "wagmi";
import { PrimaryCTALink } from "@/components/design/PrimaryCTA";
import { usePool } from "@/hooks/usePool";

export function LandingCTA() {
  const { isConnected } = useAccount();
  const pool = usePool();

  if (pool.isFinalized) {
    return <PrimaryCTALink href="/results" variant="gold" label="See Results" />;
  }
  if (isConnected && pool.hasJoined) {
    return <PrimaryCTALink href="/play" label="View My Team" />;
  }
  // Entries are closed once the pool locks — send prospective players to the
  // standings instead of into a join funnel the contract will reject.
  if (pool.isLocked) {
    return <PrimaryCTALink href="/leaderboard" label="See Standings" />;
  }
  return <PrimaryCTALink href="/play" label="Start Playing" />;
}
