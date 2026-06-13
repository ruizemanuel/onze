"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UiPlayer } from "@/lib/players/uiPlayer";

async function fetchPlayers(): Promise<UiPlayer[]> {
  const r = await fetch("/api/players");
  if (!r.ok) return [];
  const d = (await r.json()) as { players?: UiPlayer[] };
  return d.players ?? [];
}

/** Players keyed by id, for resolving goal scorers + the user's XI. Cached 5 min. */
export function usePlayers() {
  const { data, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: fetchPlayers,
    staleTime: 5 * 60_000,
  });
  const byId = useMemo(() => {
    const m = new Map<number, UiPlayer>();
    for (const p of data ?? []) m.set(p.id, p);
    return m;
  }, [data]);
  return { byId, isLoading };
}
