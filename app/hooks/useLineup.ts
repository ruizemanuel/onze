"use client";

import { useAccount, useReadContract } from "wagmi";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { CHAIN_ID, DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { useActiveTournament } from "@/hooks/useActiveTournament";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function useLineup(poolAddrParam?: `0x${string}`) {
  const { address } = useAccount();
  const active = useActiveTournament(!poolAddrParam);
  const poolAddr = (poolAddrParam ?? active.poolAddr ?? ZERO) as `0x${string}`;
  const chainId = CHAIN_ID[DEFAULT_NETWORK];

  const r = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "getLineup",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address) && poolAddr !== ZERO,
      refetchInterval: 10_000,
    },
  });

  return {
    lineup: r.data as readonly [bigint, bigint, bigint, bigint, bigint] | undefined,
    isLoading: r.isLoading,
    isFetching: r.isFetching,
    refetch: r.refetch,
  };
}
