import Link from "next/link";
import type { Route } from "next";
import { createPublicClient, http } from "viem";
import { celo, celoAlfajores, celoSepolia } from "viem/chains";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { FechaCard } from "@/components/FechaCard";
import { pick5PoolAbi, pick5SeasonAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolvePoolById, resolveSeasonPool } from "@/lib/contracts/factory";
import { getActiveSeason } from "@/lib/tournaments/seasons";
import { fechaStatus, type FechaStatus } from "@/lib/tournaments/fechaStatus";

export const revalidate = 60;
export const dynamic = "force-dynamic";

function getChain(n: string) {
  if (n === "celo") return celo;
  if (n === "celo-sepolia") return celoSepolia;
  return celoAlfajores;
}
const usd = (n: bigint) => `$${(Number(n) / 1_000_000).toFixed(2)}`;
const trunc = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

type Row = { tournamentId: number; fechaNumber: number; round: number; status: FechaStatus; sub: string };

async function load() {
  const season = getActiveSeason();
  const network = DEFAULT_NETWORK;
  const now = Math.floor(Date.now() / 1000);
  let seedAmount = BigInt(0);
  let seasonFinalized = false;
  const rows: Row[] = [];
  try {
    const client = createPublicClient({ chain: getChain(network), transport: http() });
    const seasonPool = await resolveSeasonPool(client, network, season.seasonId);
    if (seasonPool) {
      seedAmount = (await client.readContract({ address: seasonPool, abi: pick5SeasonAbi, functionName: "seedAmount" })) as bigint;
      seasonFinalized = (await client.readContract({ address: seasonPool, abi: pick5SeasonAbi, functionName: "finalized" })) as boolean;
    }
    for (let i = 0; i < season.fechas.length; i++) {
      const f = season.fechas[i];
      const pool = await resolvePoolById(client, network, f.tournamentId);
      if (!pool) {
        rows.push({ tournamentId: f.tournamentId, fechaNumber: i + 1, round: f.round, status: "soon", sub: "Opens once created on-chain" });
        continue;
      }
      const [lockTime, deposit, participants, finalized, winner, seed, scoresSubmitted] = await Promise.all([
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "lockTime" }) as Promise<bigint>,
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "deposit" }) as Promise<bigint>,
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "participantsLength" }) as Promise<bigint>,
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "finalized" }) as Promise<boolean>,
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "winner" }) as Promise<`0x${string}`>,
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "seedAmount" }) as Promise<bigint>,
        client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "scoresSubmitted" }) as Promise<boolean>,
      ]);
      const status = fechaStatus({ poolExists: true, lockTime: Number(lockTime), finalized, now });
      let sub: string;
      if (status === "joining") sub = `Open · ${usd(deposit)} entry · ${Number(participants)} in`;
      else if (status === "scoring") sub = `${scoresSubmitted ? "Scores in" : "Live"} · ${Number(participants)} players`;
      else sub = winner && winner !== "0x0000000000000000000000000000000000000000" ? `Winner ${trunc(winner)} · prize ${usd(seed)}` : "Settled";
      rows.push({ tournamentId: f.tournamentId, fechaNumber: i + 1, round: f.round, status, sub });
    }
  } catch {
    // fall through with whatever rows we have
  }
  return { season, rows, seedAmount, seasonFinalized };
}

export default async function TournamentsPage() {
  const { season, rows, seedAmount, seasonFinalized } = await load();
  return (
    <main className="min-h-dvh bg-[#08070D] text-white">
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24">
        <header className="flex items-center justify-between">
          <span className="font-display text-2xl tracking-[0.2em] text-white">PICK<span className="text-[#00DF7C]">5</span></span>
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">{season.label}</div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">Fechas</h1>
          <p className="mt-2 text-sm text-white/50">Play any matchday. Your points across all fechas decide the season champion.</p>
        </section>

        <div className="pt-6">
          <Link href={"/leaderboard" as Route} className="block">
            <div className="relative overflow-hidden rounded-2xl border border-[#F5C842]/30 bg-gradient-to-br from-[#F5C842]/10 to-[#F5C842]/[0.02] p-5 shadow-[0_8px_30px_rgba(245,200,66,0.10)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5C842]">Season prize · growing in Aave</div>
              <div className="font-display mt-1.5 text-5xl leading-none text-white [text-shadow:0_0_24px_rgba(245,200,66,0.25)]">{usd(seedAmount)}<span className="ml-1.5 text-lg tracking-wide text-[#F5C842]">+ yield</span></div>
              <div className="mt-1.5 text-xs font-medium text-[#F5C842]/85">{seasonFinalized ? "Champion crowned" : "Goes to the season champion"} · View Tabla General →</div>
            </div>
          </Link>
        </div>

        <div className="pt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Matchdays</div>
        <div className="mt-3 space-y-2.5">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/50">No fechas yet · check back soon.</div>
          ) : (
            rows.map((r) => <FechaCard key={r.tournamentId} {...r} />)
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
