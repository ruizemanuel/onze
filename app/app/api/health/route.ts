import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo, celoAlfajores, celoSepolia } from "viem/chains";
import { pick5PoolAbi, coachAgentAbi } from "@/lib/contracts/abi";
import { poolAddress, coachAddress, usdtAddress, DEFAULT_NETWORK } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function getChain(network: string) {
  if (network === "celo") return celo;
  if (network === "celo-sepolia") return celoSepolia;
  return celoAlfajores;
}

const ERC20_BAL_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function GET() {
  const network = DEFAULT_NETWORK;
  const chain = getChain(network);
  const client = createPublicClient({ chain, transport: http() });
  const pool = poolAddress(network);
  const coach = coachAddress(network);
  const usdt = usdtAddress(network);

  if (pool === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ ok: false, reason: `pool not configured for ${network}` }, { status: 503 });
  }

  const reads = await Promise.all([
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "deposit" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "seedAmount" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "participantsLength" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "lockTime" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "endTime" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "scoresSubmitted" }) as Promise<boolean>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "finalized" }) as Promise<boolean>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "prizeClaimed" }) as Promise<boolean>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "prizeAmount" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "winner" }) as Promise<`0x${string}`>,
    client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "emergencyActive" }) as Promise<boolean>,
    client.readContract({ address: usdt, abi: ERC20_BAL_ABI, functionName: "balanceOf", args: [pool] }) as Promise<bigint>,
  ]);
  const [deposit, seedAmount, participants, lockTime, endTime, scoresSubmitted, finalized, prizeClaimed, prizeAmount, winner, emergencyActive, contractUsdt] = reads;

  const now = Math.floor(Date.now() / 1000);
  const lockTimeNum = Number(lockTime);
  const endTimeNum = Number(endTime);

  let phase: "pre-join" | "joining" | "locked" | "ended" | "scores-in" | "finalized" | "emergency";
  if (emergencyActive) phase = "emergency";
  else if (finalized) phase = "finalized";
  else if (scoresSubmitted) phase = "scores-in";
  else if (now >= endTimeNum) phase = "ended";
  else if (now >= lockTimeNum) phase = "locked";
  else if (now > 0) phase = "joining";
  else phase = "pre-join";

  // Coach state (best-effort — coach may not be configured on this network)
  let coachState: unknown = null;
  if (coach !== "0x0000000000000000000000000000000000000000") {
    const coachReads = await Promise.all([
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "coachWallet" }) as Promise<string>,
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "commitments", args: [37] }) as Promise<`0x${string}`>,
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "commitments", args: [38] }) as Promise<`0x${string}`>,
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "hasRevealed", args: [37] }) as Promise<boolean>,
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "hasRevealed", args: [38] }) as Promise<boolean>,
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "accuracy", args: [37] }) as Promise<number>,
      client.readContract({ address: coach, abi: coachAgentAbi, functionName: "accuracy", args: [38] }) as Promise<number>,
    ]);
    const [coachWallet, commitMw37, commitMw38, revealedMw37, revealedMw38, accuracyMw37, accuracyMw38] = coachReads;
    const empty = "0x0000000000000000000000000000000000000000000000000000000000000000";
    coachState = {
      coachWallet,
      mw37: { committed: commitMw37 !== empty, revealed: revealedMw37, accuracy: Number(accuracyMw37) },
      mw38: { committed: commitMw38 !== empty, revealed: revealedMw38, accuracy: Number(accuracyMw38) },
    };
  }

  return NextResponse.json({
    ok: true,
    network,
    now,
    pool: {
      address: pool,
      phase,
      deposit: deposit.toString(),
      seedAmount: seedAmount.toString(),
      participantsLength: Number(participants),
      lockTime: lockTimeNum,
      endTime: endTimeNum,
      scoresSubmitted,
      finalized,
      prizeClaimed,
      prizeAmount: prizeAmount.toString(),
      winner: winner === "0x0000000000000000000000000000000000000000" ? null : winner,
      emergencyActive,
      contractUsdtBalance: contractUsdt.toString(),
    },
    coach: coachState,
  });
}
