"use client";

import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Pitch, type PitchSlot } from "@/components/design/Pitch";
import { PlayerRow } from "@/components/design/PlayerRow";
import { PrimaryCTALink } from "@/components/design/PrimaryCTA";
import { Stat } from "@/components/design/Stat";
import { useFechaPool } from "@/hooks/useFechaPool";
import { useLineup } from "@/hooks/useLineup";
import { usePool } from "@/hooks/usePool";
import { fechaNumber, fechaRound } from "@/lib/tournaments/seasons";
import type { FplPlayerSummary } from "@/lib/fpl/types";

type LiveStats = {
  mw: number;
  stats: Record<
    number,
    { points: number; minutes: number; goals: number; assists: number }
  >;
};

type MeRow = {
  wallet: string;
  rank: number | null;
  total: number;
};

function partsBetween(target: Date, now: Date) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  return {
    expired: ms === 0,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    mins: Math.floor((ms % 3_600_000) / 60_000),
  };
}

export default function MyTeamPage() {
  const params = useParams<{ tid: string }>();
  const tid = Number(params.tid);
  const round = fechaRound(tid);
  const { poolAddr } = useFechaPool(tid);
  const { address, isConnected } = useAccount();
  const { lineup, refetch: refetchLineup } = useLineup(poolAddr);
  const pool = usePool(poolAddr);
  const [players, setPlayers] = useState<FplPlayerSummary[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [live, setLive] = useState<LiveStats | null>(null);
  const [me, setMe] = useState<MeRow | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Force a fresh chain read on mount — wagmi may otherwise serve a stale
  // empty lineup from cache (e.g., the user looked at /play before joining,
  // wagmi cached zeros, then they joined and landed back here). Block the
  // empty-state branch until the refetch resolves so we never flash
  // "No Lineup Yet" against stale cache.
  useEffect(() => {
    if (!address) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    refetchLineup().finally(() => setRefreshing(false));
  }, [address, refetchLineup]);

  useEffect(() => {
    fetch("/api/fpl/players")
      .then((r) => r.json())
      .then((d: { players: FplPlayerSummary[] }) => setPlayers(d.players))
      .catch(() => setPlayers([]))
      .finally(() => setPlayersLoaded(true));
  }, []);

  useEffect(() => {
    if (round === undefined) {
      setLive(null);
      return;
    }
    fetch(`/api/fpl/live?mw=${round}`)
      .then((r) => r.json())
      .then((d: LiveStats) => setLive(d))
      .catch(() => setLive(null));
  }, [round]);

  useEffect(() => {
    if (!address) {
      setMe(null);
      return;
    }
    fetch(`/api/leaderboard/me?wallet=${address.toLowerCase()}`)
      .then((r) => r.json())
      .then((d: MeRow) => setMe(d))
      .catch(() => setMe(null));
  }, [address]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const playerMap = useMemo(() => {
    const m = new Map<number, FplPlayerSummary>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const ids = useMemo(() => {
    if (!lineup) return [] as number[];
    return lineup.map((x) => Number(x)).filter((id) => id !== 0);
  }, [lineup]);

  const hasLineup = ids.length === 5;
  const allMapped = hasLineup && ids.every((id) => playerMap.has(id));
  const haveChainResult = lineup !== undefined && !refreshing;
  const showLoadingState =
    !haveChainResult || (hasLineup && (!playersLoaded || !allMapped));
  const showNoLineupState = haveChainResult && playersLoaded && !hasLineup;

  const pitchSlots: PitchSlot[] = useMemo(() => {
    if (!lineup) return Array(5).fill({ empty: true } as const);
    return lineup.map((idBn) => {
      const id = Number(idBn);
      if (id === 0) return { empty: true };
      const p = playerMap.get(id);
      if (!p) {
        return {
          empty: false,
          initials: `#${id}`,
          teamColor: "#00DF7C",
          showLabel: false,
        };
      }
      return {
        empty: false,
        photoUrl: p.photoUrl,
        initials: p.initials,
        teamColor: p.teamColor,
        name: p.name,
        team: p.team,
        position: p.position,
      };
    });
  }, [lineup, playerMap]);

  const finalized = pool.isFinalized;
  const lockMs =
    pool.lockTime !== undefined ? Number(pool.lockTime) * 1000 : undefined;
  const isLocked = pool.isLocked;
  const lockParts = lockMs
    ? partsBetween(new Date(lockMs), now)
    : { expired: false, days: 0, hours: 0, mins: 0 };
  const fechaNo = fechaNumber(tid) ?? tid + 1;
  const fechaLabel =
    round !== undefined ? `Fecha ${fechaNo} · GW${round}` : `Fecha ${fechaNo}`;
  const statusLabel = finalized ? "FINAL" : isLocked ? "LIVE" : "LOCKS IN";
  const statusValue = finalized
    ? "Settled"
    : isLocked
      ? "Live"
      : `${String(lockParts.days).padStart(2, "0")}d ${String(lockParts.hours).padStart(2, "0")}h ${String(lockParts.mins).padStart(2, "0")}m`;
  const statusSub = finalized
    ? "This fecha settled"
    : isLocked
      ? "This fecha is live"
      : "Until kickoff";

  const currentMwPoints = useMemo(() => {
    if (!live || ids.length === 0) return 0;
    return ids.reduce((sum, id) => sum + (live.stats[id]?.points ?? 0), 0);
  }, [live, ids]);

  // `me.total` is the cron-cached, post-settlement total — it stays 0 while a
  // matchweek is still mid-flight, so `?? ` would never fall through (0 is a
  // valid value). During a live MW use the FPL live feed instead.
  const cachedTotal = me?.total ?? 0;
  const totalScore = cachedTotal > 0 ? cachedTotal : currentMwPoints;

  // `/api/leaderboard/me` returns rank: null until the wallet has points, so a
  // non-null rank is already real (no need to second-guess #1 ties here).
  const showRank = me?.rank != null;
  const rankLabel = showRank ? `#${me!.rank}` : "—";

  if (!isConnected) {
    return (
      <main className="min-h-dvh bg-[#08070D] text-white">
        <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 px-5 pb-24">
          <span className="font-display text-3xl tracking-[0.2em] text-white">
            PICK<span className="text-[#00DF7C]">5</span>
          </span>
          <p className="text-center text-white/70">
            Connect your wallet to see your lineup.
          </p>
          <ConnectedWalletPill />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#08070D] text-white">
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24">
        <header className="flex items-center justify-between">
          <span className="font-display text-2xl tracking-[0.2em] text-white">
            PICK<span className="text-[#00DF7C]">5</span>
          </span>
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div
            className={
              "flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] " +
              (finalized ? "text-[#F5C842]" : "text-[#00DF7C]")
            }
          >
            <span
              className={
                "size-1.5 rounded-full " +
                (finalized
                  ? "bg-[#F5C842] shadow-[0_0_8px_#F5C842]"
                  : "bg-[#00DF7C] shadow-[0_0_8px_#00DF7C]")
              }
              aria-hidden
            />
            <span>
              {finalized
                ? `${fechaLabel} settled`
                : isLocked
                  ? `${fechaLabel} live`
                  : fechaLabel}
            </span>
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            My Team
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {finalized
              ? hasLineup
                ? "This fecha settled. Your final lineup is below."
                : "This fecha settled. You didn't join it."
              : isLocked
                ? hasLineup
                  ? "This fecha is live. Your lineup is locked."
                  : "This fecha is live. Entries are closed."
                : `This fecha kicks off in ${lockParts.days}d ${lockParts.hours}h. Lineup locked.`}
          </p>
          <Link
            href={"/tournaments" as Route}
            className="mt-4 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
          >
            ← Todas las fechas
          </Link>
        </section>

        {showLoadingState && (
          <section className="pt-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/50">
              Loading lineup…
            </div>
          </section>
        )}

        {showNoLineupState && (
          <section className="pt-6 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <div className="font-display text-2xl text-white">
                No Lineup Yet
              </div>
              <p className="mt-2 text-sm text-white/50">
                You haven&apos;t joined this tournament. Pick your 5 to enter.
              </p>
            </div>
            <PrimaryCTALink href={`/play/${tid}/build` as Route} label="Build Lineup" />
          </section>
        )}

        {hasLineup && allMapped && (
          <>
            {pool.isFinalized && (
              <section className="pt-5">
                <Link
                  href={"/results" as Route}
                  className="group relative block overflow-hidden rounded-2xl border border-[#F5C842]/40 bg-gradient-to-r from-[#F5C842]/15 to-[#F5C842]/[0.02] px-4 py-4 transition hover:from-[#F5C842]/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F5C842]">
                        Tournament settled
                      </div>
                      <div className="font-display mt-1 text-xl text-white">
                        See full results →
                      </div>
                    </div>
                    <span
                      className="font-display rounded-full border border-[#F5C842]/40 bg-[#F5C842]/10 px-2.5 py-1 text-[10px] tracking-wider text-[#F5C842]"
                    >
                      FINAL
                    </span>
                  </div>
                </Link>
              </section>
            )}

            <section className="pt-5">
              <Pitch slots={pitchSlots} />
            </section>

            <section className="pt-5">
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="Score"
                  value={String(totalScore)}
                  sub={
                    finalized
                      ? "Fecha final"
                      : !isLocked
                        ? "yet to play"
                        : cachedTotal > 0
                          ? "Season total"
                          : "This fecha live"
                  }
                />
                <Stat
                  label="Rank"
                  value={rankLabel}
                  sub={showRank ? "of all players" : "after first points"}
                />
                <Stat
                  label={statusLabel}
                  value={statusValue}
                  sub={statusSub}
                />
              </div>
            </section>

            <section className="pt-6">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
                How your players are doing
              </div>
              <div className="mt-2 space-y-2">
                {ids.map((id, i) => {
                  const p = playerMap.get(id);
                  const pts = live?.stats[id]?.points ?? 0;
                  const mins = live?.stats[id]?.minutes ?? 0;
                  const goals = live?.stats[id]?.goals ?? 0;
                  const assists = live?.stats[id]?.assists ?? 0;
                  const subline = finalized
                    ? mins === 0
                      ? "Did not play"
                      : `${mins}'  ·  ${goals}G ${assists}A`
                    : !isLocked
                      ? "Yet to start"
                      : mins === 0
                        ? "Yet to play"
                        : `${mins}'  ·  ${goals}G ${assists}A`;
                  return (
                    <PlayerRow
                      key={`${id}-${i}`}
                      photoUrl={p?.photoUrl}
                      initials={p?.initials ?? `#${id}`}
                      teamColor={p?.teamColor}
                      name={p?.name ?? `Player #${id}`}
                      team={p?.team}
                      position={p?.position}
                      meta={subline}
                      right={
                        <>
                          <div className="font-display text-base text-white tabular-nums">
                            {pts}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-white/40">
                            {round !== undefined ? `GW${round}` : "pts"}
                          </div>
                        </>
                      }
                    />
                  );
                })}
              </div>
            </section>

            <section className="pt-6">
              <Link
                href={"/leaderboard" as Route}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/70 transition hover:bg-white/10"
              >
                See full leaderboard →
              </Link>
            </section>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
