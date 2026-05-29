import type { PublicClient } from "viem";
import { pick5FactoryAbi } from "./abi";
import { factoryAddress, type Network } from "./addresses";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/** Server-side: resolve the factory's active (latest) tournament pool address. */
export async function resolveActivePool(
  client: Pick<PublicClient, "readContract">,
  network: Network,
): Promise<`0x${string}` | null> {
  const factory = factoryAddress(network);
  if (factory === ZERO) return null;
  const length = (await client.readContract({
    address: factory,
    abi: pick5FactoryAbi,
    functionName: "tournamentsLength",
  })) as bigint;
  if (length === BigInt(0)) return null;
  return (await client.readContract({
    address: factory,
    abi: pick5FactoryAbi,
    functionName: "tournamentBy",
    args: [length - BigInt(1)],
  })) as `0x${string}`;
}
