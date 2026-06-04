import { Suspense } from "react";
import { createPublicClient, http } from "viem";
import { chainForNetwork } from "@/lib/contracts/chain";
import { Leaderboard } from "@/components/Leaderboard";
import { SeasonPrizeBanner } from "@/components/SeasonPrizeBanner";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Wordmark } from "@/components/design/Wordmark";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolvePoolById } from "@/lib/contracts/factory";
import { getActiveSeason } from "@/lib/tournaments/seasons";
import { AppShell } from "@/components/design/AppShell";

export const revalidate = 60;
export const dynamic = "force-dynamic";

async function countSettled(): Promise<{ settled: number; total: number }> {
  const season = getActiveSeason();
  const total = season.fechas.length;
  try {
    const client = createPublicClient({ chain: chainForNetwork(DEFAULT_NETWORK), transport: http() });
    let settled = 0;
    for (const f of season.fechas) {
      const pool = await resolvePoolById(client, DEFAULT_NETWORK, f.tournamentId);
      if (!pool) continue;
      const fin = (await client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "finalized" })) as boolean;
      if (fin) settled++;
    }
    return { settled, total };
  } catch {
    return { settled: 0, total };
  }
}

export default async function LeaderboardPage() {
  const { settled, total } = await countSettled();
  return (
    <AppShell active="ranking" topbarTitle={getActiveSeason().label}>
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-3xl lg:px-0 lg:pt-0 lg:pb-0">
        <header className="flex items-center justify-between lg:hidden">
          <Wordmark />
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">Season · Standings</div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">Overall Standings</h1>
          <p className="mt-2 text-sm text-white/50">Aggregate points across every phase. The leader after the final phase wins the season pot.</p>
        </section>

        <div className="pt-6">
          <SeasonPrizeBanner fechasSettled={settled} fechasTotal={total} />
        </div>

        <div className="pt-6">
          <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/50">Loading…</div>}>
            <Leaderboard />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}
