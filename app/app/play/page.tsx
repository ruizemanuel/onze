"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Pitch, type PitchSlot } from "@/components/design/Pitch";
import { PlayerRow } from "@/components/design/PlayerRow";
import { PrimaryCTALink } from "@/components/design/PrimaryCTA";
import { Stat } from "@/components/design/Stat";
import { useLineup } from "@/hooks/useLineup";
import { usePool } from "@/hooks/usePool";
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
  mw37: number;
  mw38: number;
  total: number;
};

const LOCK_DATE = new Date("2026-05-16T14:00:00Z");
// MW37 ran Fri 15 May → Tue 19 May 2026; MW38 picks publish Wed 21 May and
// the final fixtures play Sun 24 May. Flip CURRENT_MW from 37 → 38 once MW37
// is done settling — Wed 20 May 00:00 UTC is the clean cutoff (after MW37's
// last kickoff at 19:00 UTC on Tue 19, and before MW38 picks publish).
const MW38_START = new Date("2026-05-20T00:00:00Z");
const CURRENT_MW: 37 | 38 = Date.now() >= MW38_START.getTime() ? 38 : 37;
const MW_END_LABEL: Record<37 | 38, string> = {
  37: "Through Tue 19 May",
  38: "Through Sun 24 May",
};
const MW_ENDED_LABEL: Record<37 | 38, string> = {
  37: "Ended Tue 19 May",
  38: "Ended Sun 24 May",
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
  const { address, isConnected } = useAccount();
  const { lineup, refetch: refetchLineup } = useLineup();
  const pool = usePool();
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
    fetch(`/api/fpl/live?mw=${CURRENT_MW}`)
      .then((r) => r.json())
      .then((d: LiveStats) => setLive(d))
      .catch(() => setLive(null));
  }, []);

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

  const lockParts = partsBetween(LOCK_DATE, now);
  const isLocked = lockParts.expired;
  const finalized = pool.isFinalized;
  const statusLabel = finalized
    ? `MW${CURRENT_MW} FINAL`
    : isLocked
      ? `MW${CURRENT_MW} LIVE`
      : "LOCKS IN";
  const statusValue = finalized
    ? "Settled"
    : isLocked
      ? "Live"
      : `${String(lockParts.days).padStart(2, "0")}d ${String(lockParts.hours).padStart(2, "0")}h ${String(lockParts.mins).padStart(2, "0")}m`;
  const statusSub = finalized
    ? MW_ENDED_LABEL[CURRENT_MW]
    : MW_END_LABEL[CURRENT_MW];

  const currentMwPoints = useMemo(() => {
    if (!live || ids.length === 0) return 0;
    return ids.reduce((sum, id) => sum + (live.stats[id]?.points ?? 0), 0);
  }, [live, ids]);

  // `me.total` is the cron-cached, post-settlement total — it stays 0 while a
  // matchweek is still mid-flight, so `?? ` would never fall through (0 is a
  // valid value). During a live MW use the FPL live feed instead.
  const cachedTotal = me?.total ?? 0;
  const totalScore = cachedTotal > 0 ? cachedTotal : currentMwPoints;

  // The cache ranks every wallet #1 while all totals are 0 (RANK() over a flat
  // table ties them). Only treat the rank as real once standings have actually
  // differentiated: the user has cached points, or sits below #1.
  const showRank = me?.rank != null && (cachedTotal > 0 || me.rank > 1);
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
                ? "Tournament settled"
                : isLocked
                  ? "Tournament Live"
                  : "Pre-tournament"}
            </span>
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            My Team
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {finalized
              ? hasLineup
                ? `MW${CURRENT_MW} settled. Your final lineup is below.`
                : `MW${CURRENT_MW} settled. You didn't join this tournament.`
              : isLocked
                ? hasLineup
                  ? `MW${CURRENT_MW} is in progress. Your lineup is locked.`
                  : `MW${CURRENT_MW} is in progress. Entries are closed.`
                : `MW${CURRENT_MW} kicks off in ${lockParts.days}d ${lockParts.hours}h. Lineup locked.`}
          </p>
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
            <PrimaryCTALink href="/play/build" label="Build Lineup" />
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
                      ? "Tournament final"
                      : !isLocked
                        ? "yet to play"
                        : cachedTotal > 0
                          ? `Through MW${CURRENT_MW}`
                          : `MW${CURRENT_MW} live`
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
                      ? `MW${CURRENT_MW} yet to start`
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
                            mw{CURRENT_MW}
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
