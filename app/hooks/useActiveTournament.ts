"use client";

import { useReadContract } from "wagmi";
import { pick5FactoryAbi } from "@/lib/contracts/abi";
import { factoryAddress, DEFAULT_NETWORK, CHAIN_ID } from "@/lib/contracts/addresses";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * Resolves the factory's ACTIVE tournament — the most recently created one
 * (`tournamentBy(tournamentsLength() - 1)`). `enabled: false` skips the reads
 * when a caller already has an explicit pool address (Tanda 3.2 per-id routing).
 */
export function useActiveTournament(enabled = true) {
  const network = DEFAULT_NETWORK;
  const factory = factoryAddress(network);
  const chainId = CHAIN_ID[network];
  const on = enabled && factory !== ZERO;

  const length = useReadContract({
    abi: pick5FactoryAbi,
    address: factory,
    chainId,
    functionName: "tournamentsLength",
    query: { enabled: on },
  });

  const count = length.data as bigint | undefined;
  const lastId = count !== undefined && count > BigInt(0) ? count - BigInt(1) : undefined;

  const pool = useReadContract({
    abi: pick5FactoryAbi,
    address: factory,
    chainId,
    functionName: "tournamentBy",
    args: lastId !== undefined ? [lastId] : undefined,
    query: { enabled: on && lastId !== undefined },
  });

  return {
    factory,
    poolAddr: pool.data as `0x${string}` | undefined,
    tournamentId: lastId,
    hasTournaments: count !== undefined && count > BigInt(0),
    isLoading: length.isLoading || pool.isLoading,
  };
}
