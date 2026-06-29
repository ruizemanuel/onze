import { Suspense } from "react";
import { createPublicClient, http } from "viem";
import { chainForNetwork } from "@/lib/contracts/chain";
import { Leaderboard } from "@/components/Leaderboard";
import { SeasonPrizeBanner } from "@/components/SeasonPrizeBanner";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Wordmark } from "@/components/design/Wordmark";
import { LeaderboardPhaseSwitcher } from "@/components/LeaderboardPhaseSwitcher";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolvePoolById } from "@/lib/contracts/factory";
import { fechaLabel, getActiveSeason } from "@/lib/tournaments/seasons";
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

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  // ?t=<tid> → single-phase standings; no/invalid ?t → Overall (season aggregate).
  const raw = sp.t !== undefined && sp.t !== "" ? Number(sp.t) : undefined;
  const tid =
    raw !== undefined && Number.isInteger(raw) && getActiveSeason().fechas.some((f) => f.tournamentId === raw)
      ? raw
      : undefined;
  const isOverall = tid === undefined;

  const { settled, total } = isOverall ? await countSettled() : { settled: 0, total: 0 };

  const eyebrow = isOverall ? "Season · Standings" : "Phase · Standings";
  const title = isOverall ? "Overall Standings" : `${fechaLabel(tid)} Standings`;
  const subtitle = isOverall
    ? "Aggregate points across every phase. The leader after the final phase wins the season pot."
    : `Points for the ${fechaLabel(tid)} phase.`;

  const switcher = <LeaderboardPhaseSwitcher tid={tid} />;

  return (
    <AppShell active="ranking" topbarTitle={getActiveSeason().label} topbarRight={switcher}>
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-3xl lg:px-0 lg:pt-0 lg:pb-0">
        <header className="flex items-center justify-between lg:hidden">
          <Wordmark />
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">{eyebrow}</div>
              <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-white/50">{subtitle}</p>
            </div>
            {/* Inline selector so phase-switching works on mobile too (the topbar one is lg:only). */}
            <div className="shrink-0 pt-1 lg:hidden">{switcher}</div>
          </div>
        </section>

        {isOverall && (
          <div className="pt-6">
            <SeasonPrizeBanner fechasSettled={settled} fechasTotal={total} />
          </div>
        )}

        <div className="pt-6">
          <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/50">Loading…</div>}>
            <Leaderboard tid={tid} />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}
