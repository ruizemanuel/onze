"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Pitch, type PitchSlot } from "@/components/design/Pitch";
import { PrimaryCTA } from "@/components/design/PrimaryCTA";
import { SecondaryCTA } from "@/components/design/SecondaryCTA";
import { PlayerPicker } from "@/components/pitch/PlayerPicker";
import { useLineupDraft } from "@/stores/lineupDraft";
import { useFechaPool } from "@/hooks/useFechaPool";
import { usePool } from "@/hooks/usePool";
import type { FplPlayerSummary } from "@/lib/fpl/types";

export default function BuildPage() {
  const router = useRouter();
  const params = useParams<{ tid: string }>();
  const tid = Number(params.tid);
  const { poolAddr } = useFechaPool(tid);
  const pool = usePool(poolAddr);
  const { lineupFor, setSlot, randomFill } = useLineupDraft();
  const lineup = lineupFor(tid);
  const [players, setPlayers] = useState<FplPlayerSummary[]>([]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/fpl/players")
      .then((r) => r.json())
      .then((d: { players: FplPlayerSummary[] }) => setPlayers(d.players))
      .catch(() => setPlayers([]));
  }, []);

  const playerMap = useMemo(() => {
    const m = new Map<number, FplPlayerSummary>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const filled = lineup.filter((id) => id !== null).length;
  const allIds = useMemo(() => players.map((p) => p.id), [players]);

  const slots: PitchSlot[] = lineup.map((id) => {
    if (id === null) return { empty: true };
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

  const excludeIds = lineup.filter((id): id is number => id !== null);
  const pickerExclude =
    pickerSlot === null
      ? excludeIds
      : excludeIds.filter((id) => id !== lineup[pickerSlot]);

  // `joinTournament` reverts once the pool locks — don't let users build a
  // lineup they can never submit. Joined users still have a team to view.
  if (pool.isLocked) {
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
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
              Entries closed
            </div>
            <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
              Fecha locked
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Entries for this fecha are closed. New lineups can no longer be
              submitted.
            </p>
          </section>

          <section className="pt-6">
            <Link
              href={(pool.hasJoined ? `/play/${tid}` : "/leaderboard") as Route}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/70 transition hover:bg-white/10"
            >
              {pool.hasJoined ? "See your team →" : "See the live standings →"}
            </Link>
          </section>
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
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
            Your lineup
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            Build your 5
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Tap a slot to pick a player. Each player can only be chosen once.
          </p>
        </section>

        <section className="pt-5">
          <Pitch slots={slots} onSlotClick={(i) => setPickerSlot(i)} />
        </section>

        <section className="pt-5 space-y-3">
          <SecondaryCTA
            label="Random fill"
            onClick={() => randomFill(tid, allIds)}
            disabled={!allIds.length}
          />
          <PrimaryCTA
            label={filled === 5 ? "Continue · 5 / 5" : `Continue · ${filled} / 5`}
            disabled={filled < 5}
            onClick={() => router.push(`/play/${tid}/confirm` as Route)}
          />
        </section>
      </div>

      <PlayerPicker
        open={pickerSlot !== null}
        onOpenChange={(o) => {
          if (!o) setPickerSlot(null);
        }}
        excludeIds={pickerExclude}
        players={players}
        onPick={(id) => {
          if (pickerSlot !== null) setSlot(tid, pickerSlot, id);
          setPickerSlot(null);
        }}
        onClear={
          pickerSlot !== null && lineup[pickerSlot] !== null
            ? () => {
                setSlot(tid, pickerSlot, null);
                setPickerSlot(null);
              }
            : undefined
        }
      />

      <BottomNav />
    </main>
  );
}
