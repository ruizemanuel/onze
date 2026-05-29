"use client";

import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { ADDRESSES, DEFAULT_NETWORK, CHAIN_ID } from "@/lib/contracts/addresses";
import { useActiveTournament } from "@/hooks/useActiveTournament";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function usePool(poolAddrParam?: `0x${string}`) {
  const network = DEFAULT_NETWORK;
  // Default to the factory's active tournament; an explicit address (Tanda 3.2
  // per-tournament routing) skips the factory reads.
  const active = useActiveTournament(!poolAddrParam);
  const poolAddr = (poolAddrParam ?? active.poolAddr ?? ZERO) as `0x${string}`;
  const usdtAddr = ADDRESSES[network].usdt as `0x${string}`;
  // Pin every read/write to the network the contracts are actually on, so the
  // dApp behaves correctly regardless of which chain MetaMask happens to be on.
  // Writes will prompt the user to switch chains; reads always hit the right RPC.
  const chainId = CHAIN_ID[network] ?? 42220;

  const { address, chainId: connectedChainId } = useAccount();
  const wrongNetwork = Boolean(address) && connectedChainId !== chainId;
  const userEnabled = Boolean(address) && Boolean(poolAddr);

  const allowance = useReadContract({
    abi: erc20Abi,
    address: usdtAddr,
    chainId,
    functionName: "allowance",
    args: address ? [address, poolAddr] : undefined,
    query: { enabled: Boolean(address) && Boolean(usdtAddr) && Boolean(poolAddr) },
  });

  const hasJoined = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "hasJoined",
    args: address ? [address] : undefined,
    query: { enabled: userEnabled },
  });

  const lockTime = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "lockTime",
    query: { enabled: Boolean(poolAddr) },
  });

  const winner = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "winner",
    query: { enabled: Boolean(poolAddr) },
  });

  const finalized = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "finalized",
    query: { enabled: Boolean(poolAddr) },
  });

  const prizeAmount = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "prizeAmount",
    query: { enabled: Boolean(poolAddr) },
  });

  const prizeClaimed = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "prizeClaimed",
    query: { enabled: Boolean(poolAddr) },
  });

  const depositWithdrawn = useReadContract({
    abi: pick5PoolAbi,
    address: poolAddr,
    chainId,
    functionName: "depositWithdrawn",
    args: address ? [address] : undefined,
    query: { enabled: userEnabled },
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });

  async function writeAndWait(args: Parameters<typeof writeContractAsync>[0]) {
    // chainId forces wagmi to switch the wallet to the right network first.
    const hash = await writeContractAsync({ ...args, chainId } as Parameters<typeof writeContractAsync>[0]);
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    return hash;
  }

  // After joinTournament confirms, the read RPC node may lag a few seconds
  // behind the writer (Celo Sepolia is especially noisy here). Poll
  // getLineup until we see the new state, otherwise the user lands on
  // /play with a stale "all zeros" read and sees "No Lineup Yet" for ~10s.
  async function pollLineupSettled(maxAttempts = 20, intervalMs = 300) {
    if (!publicClient || !address) return;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await publicClient.readContract({
          address: poolAddr,
          abi: pick5PoolAbi,
          functionName: "getLineup",
          args: [address],
        });
        const arr = result as readonly (bigint | number)[];
        if (arr.some((x) => Number(x) !== 0)) return;
      } catch {
        // ignore transient RPC errors and retry
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  const winnerAddr = winner.data as `0x${string}` | undefined;
  const isWinner =
    !!address && !!winnerAddr && winnerAddr.toLowerCase() === address.toLowerCase();

  // `joinTournament` reverts with TournamentLocked() once block.timestamp
  // reaches lockTime — read it on-chain so the join funnel can close itself
  // instead of letting users build a lineup the contract will reject.
  const lockTimeSec = lockTime.data as bigint | undefined;
  const isLocked =
    lockTimeSec !== undefined && Date.now() >= Number(lockTimeSec) * 1000;

  return {
    addresses: { pool: poolAddr, usdt: usdtAddr },
    chainId,
    wrongNetwork,
    allowance: (allowance.data as bigint | undefined) ?? BigInt(0),
    hasJoined: Boolean(hasJoined.data),
    isLocked,
    winner: winnerAddr,
    isWinner,
    isFinalized: Boolean(finalized.data),
    prizeAmount: (prizeAmount.data as bigint | undefined) ?? BigInt(0),
    prizeClaimed: Boolean(prizeClaimed.data),
    depositWithdrawn: Boolean(depositWithdrawn.data),
    approve: () =>
      writeAndWait({
        abi: erc20Abi,
        address: usdtAddr,
        functionName: "approve",
        args: [poolAddr, parseUnits("1", 6)],
      }),
    join: async (lineup: readonly [number, number, number, number, number]) => {
      const hash = await writeAndWait({
        abi: pick5PoolAbi,
        address: poolAddr,
        functionName: "joinTournament",
        args: [lineup],
      });
      await pollLineupSettled();
      return hash;
    },
    claimPrize: () =>
      writeAndWait({
        abi: pick5PoolAbi,
        address: poolAddr,
        functionName: "claimPrize",
      }),
    withdrawDeposit: () =>
      writeAndWait({
        abi: pick5PoolAbi,
        address: poolAddr,
        functionName: "withdrawDeposit",
      }),
    refetchAllowance: allowance.refetch,
    refetchHasJoined: hasJoined.refetch,
    refetchPrizeClaimed: prizeClaimed.refetch,
    refetchDepositWithdrawn: depositWithdrawn.refetch,
  };
}
