export type Network = "alfajores" | "celo" | "celo-sepolia";

export const CHAIN_ID: Record<Network, number> = {
  celo: 42220,
  alfajores: 44787,
  "celo-sepolia": 11142220,
};

export const ADDRESSES = {
  alfajores: {
    factory:    process.env.NEXT_PUBLIC_PICK5_FACTORY_ALFAJORES ?? "",
    pick5Pool:  process.env.NEXT_PUBLIC_PICK5_POOL_ALFAJORES ?? "",
    coachAgent: process.env.NEXT_PUBLIC_COACH_AGENT_ALFAJORES ?? "",
    usdt:       process.env.NEXT_PUBLIC_USDT_ALFAJORES ?? "",
  },
  celo: {
    factory:    process.env.NEXT_PUBLIC_PICK5_FACTORY_CELO ?? "",
    pick5Pool:  process.env.NEXT_PUBLIC_PICK5_POOL_CELO ?? "",
    coachAgent: process.env.NEXT_PUBLIC_COACH_AGENT_CELO ?? "",
    usdt:       "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  },
  "celo-sepolia": {
    factory:    process.env.NEXT_PUBLIC_PICK5_FACTORY_SEPOLIA ?? "",
    pick5Pool:  process.env.NEXT_PUBLIC_PICK5_POOL_SEPOLIA ?? "",
    coachAgent: process.env.NEXT_PUBLIC_COACH_AGENT_SEPOLIA ?? "",
    usdt:       process.env.NEXT_PUBLIC_USDT_SEPOLIA ?? "",
  },
} as const;

export const DEFAULT_NETWORK: Network =
  (process.env.NEXT_PUBLIC_NETWORK as Network) ?? "alfajores";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function factoryAddress(network: Network = DEFAULT_NETWORK): `0x${string}` {
  return (ADDRESSES[network].factory || ZERO) as `0x${string}`;
}

// Legacy single-pool address (still used by the server cron routes until Tanda 3.2
// parameterizes them per tournament). The user-facing UI resolves the active
// tournament from the factory instead (see useActiveTournament / resolveActivePool).
export function poolAddress(network: Network = DEFAULT_NETWORK): `0x${string}` {
  return (ADDRESSES[network].pick5Pool || ZERO) as `0x${string}`;
}

export function coachAddress(network: Network = DEFAULT_NETWORK): `0x${string}` {
  return (ADDRESSES[network].coachAgent || ZERO) as `0x${string}`;
}

export function usdtAddress(network: Network = DEFAULT_NETWORK): `0x${string}` {
  return (ADDRESSES[network].usdt || ZERO) as `0x${string}`;
}
