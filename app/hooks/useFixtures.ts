"use client";
import { useQuery } from "@tanstack/react-query";
import type { RoundFixtures } from "@/lib/fixtures/fixtures";

async function fetchFixtures(): Promise<RoundFixtures[]> {
  const r = await fetch("/api/fixtures");
  if (!r.ok) return [];
  const d = (await r.json()) as { rounds?: RoundFixtures[] };
  return d.rounds ?? [];
}

export function useFixtures() {
  const { data, isLoading } = useQuery({
    queryKey: ["fixtures"],
    queryFn: fetchFixtures,
    refetchInterval: 60_000,
    staleTime: 0, // always refetch on mount → /fixtures is fresh on every entry
  });
  return { rounds: data ?? [], isLoading };
}
