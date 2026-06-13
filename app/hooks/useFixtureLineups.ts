"use client";
import { useCallback } from "react";
import { useFechaPool } from "@/hooks/useFechaPool";
import { useLineup } from "@/hooks/useLineup";
import { tidForRound } from "@/lib/tournaments/seasons";
import type { Xi } from "@/lib/fixtures/tie-in";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

function toXi(lineup: readonly bigint[] | undefined, captainId: number | undefined): Xi | null {
  if (!lineup) return null;
  const ids = new Set<number>();
  for (const v of lineup) {
    const n = Number(v);
    if (n > 0) ids.add(n);
  }
  if (ids.size === 0) return null;
  return { ids, captainId };
}

/** Resolve the connected user's XI for each phase and expose a per-round lookup.
 * Group rounds use pool tid 0, knockout rounds tid 1. Returns null when the wallet
 * is disconnected, the phase pool doesn't exist yet, or no XI was joined. */
export function useFixtureLineups() {
  const group = useFechaPool(0);
  const ko = useFechaPool(1);
  const groupLineup = useLineup(group.poolAddr ?? ZERO);
  const koLineup = useLineup(ko.poolAddr ?? ZERO);

  const groupXi = group.poolAddr ? toXi(groupLineup.lineup, groupLineup.captainId) : null;
  const koXi = ko.poolAddr ? toXi(koLineup.lineup, koLineup.captainId) : null;

  const lineupForRound = useCallback(
    (round: number): Xi | null => {
      const tid = tidForRound(round);
      if (tid === 0) return groupXi;
      if (tid === 1) return koXi;
      return null;
    },
    [groupXi, koXi],
  );

  return { lineupForRound };
}
