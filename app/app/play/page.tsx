import type { Route } from "next";
import { redirect } from "next/navigation";
import { createPublicClient, http } from "viem";
import { chainForNetwork } from "@/lib/contracts/chain";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolvePoolById } from "@/lib/contracts/factory";
import { getActiveSeason } from "@/lib/tournaments/seasons";

export const dynamic = "force-dynamic";

// Home tab → the LATEST phase whose on-chain pool exists, so it follows the season
// as phases open (Group Stage → Knockout once its pool is created). Phases are
// configured before their pool is deployed, so we can't just take the highest tid;
// we pick the highest tid that actually resolves to a pool. Falls back to the first
// phase if no pool resolves (RPC hiccup / pre-launch).
export default async function PlayIndex() {
  const fechas = getActiveSeason().fechas;
  let target = fechas[0]?.tournamentId ?? 0;
  try {
    const client = createPublicClient({ chain: chainForNetwork(DEFAULT_NETWORK), transport: http() });
    for (const f of fechas) {
      const pool = await resolvePoolById(client, DEFAULT_NETWORK, f.tournamentId);
      if (pool) target = f.tournamentId; // keep the highest configured tid that has a pool
    }
  } catch {
    // fall back to the first phase
  }
  redirect(`/play/${target}` as Route);
}
