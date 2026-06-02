"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Pitch, type PitchSlot } from "@/components/design/Pitch";
import { Wordmark } from "@/components/design/Wordmark";
import { PrimaryCTA } from "@/components/design/PrimaryCTA";
import { PlayerPicker } from "@/components/pitch/PlayerPicker";
import { useLineupDraft } from "@/stores/lineupDraft";
import { useFechaPool } from "@/hooks/useFechaPool";
import { usePool } from "@/hooks/usePool";
import type { UiPlayer } from "@/lib/players/uiPlayer";
import {
  formationSlots,
  formationLayout,
  FORMATION_KEYS,
} from "@/lib/lineup/formations";
import { validateLineup, lineupBudgetSpent } from "@/lib/lineup/validate";
import { fechaBudget } from "@/lib/tournaments/seasons";

export default function BuildPage() {
  const router = useRouter();
  const params = useParams<{ tid: string }>();
  const tid = Number(params.tid);
  const { poolAddr, isLoading } = useFechaPool(tid);
  const pool = usePool(poolAddr);

  const draft = useLineupDraft((s) => s.draftFor(tid));
  const setFormation = useLineupDraft((s) => s.setFormation);
  const setSlot = useLineupDraft((s) => s.setSlot);
  const setCaptain = useLineupDraft((s) => s.setCaptain);

  const [players, setPlayers] = useState<UiPlayer[]>([]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d: { players: UiPlayer[] }) => setPlayers(d.players))
      .catch(() => setPlayers([]));
  }, []);

  const playerMap = useMemo(() => {
    const m = new Map<number, UiPlayer>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const costById = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of players) m.set(p.id, p.cost);
    return m;
  }, [players]);

  const budget = fechaBudget(tid);
  const positions = formationLayout(draft.formation);
  const slotPositions = formationSlots(draft.formation);
  const spent = lineupBudgetSpent(draft.slots, costById);

  const slots: PitchSlot[] = draft.slots.map((id) => {
    if (id === null) return { empty: true };
    const p = playerMap.get(id);
    if (!p) {
      return {
        empty: false,
        initials: `#${id}`,
        teamColor: "#00DF7C",
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

  const filledIds = draft.slots.filter((id): id is number => id !== null);
  const pickerExclude =
    pickerSlot === null
      ? filledIds
      : filledIds.filter((id) => id !== draft.slots[pickerSlot]);

  const v = validateLineup({
    slots: draft.slots,
    captainId: draft.captainId,
    costById,
    budget,
  });
  const filled = draft.slots.filter((x) => x !== null).length;

  const budgetOverrun = spent > budget;
  const budgetFillPct = Math.min(100, (spent / budget) * 100);

  // Gate: pool not open yet
  if (!poolAddr && !isLoading) {
    return (
      <main className="min-h-dvh bg-[#08070D] text-white">
        <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24">
          <header className="flex items-center justify-between">
            <Wordmark />
            <ConnectedWalletPill />
          </header>

          <section className="pt-6">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
              Próximamente
            </div>
            <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
              Aún no abierto
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Esta fase todavía no abrió. Volvé cuando arranque.
            </p>
          </section>
        </div>
        <BottomNav />
      </main>
    );
  }

  // Gate: pool locked
  if (poolAddr && pool.isLocked) {
    return (
      <main className="min-h-dvh bg-[#08070D] text-white">
        <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24">
          <header className="flex items-center justify-between">
            <Wordmark />
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
          <Wordmark />
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
            Your lineup
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            Armá tu XI
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Elegí formación, tocá un slot y completá tu equipo dentro del
            presupuesto.
          </p>
        </section>

        {/* Formation chips */}
        <section className="pt-4">
          <div
            className="flex gap-2 overflow-x-auto"
            role="tablist"
            aria-label="Elegir formación"
          >
            {FORMATION_KEYS.map((key) => {
              const active = draft.formation === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormation(tid, key)}
                  className={
                    "font-display shrink-0 rounded-full border px-3 py-1 text-sm tracking-[0.15em] transition cursor-pointer " +
                    (active
                      ? "border-[#00DF7C] bg-[#00DF7C] text-black"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
                  }
                  role="tab"
                  aria-selected={active}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </section>

        {/* Budget bar */}
        <section className="pt-4">
          <div className="flex items-center justify-between text-xs text-white/60 mb-1">
            <span>
              <span className="text-white font-medium">{spent.toFixed(1)}</span>
              {" / "}
              {budget}M
            </span>
            <span>
              <span
                className={
                  budgetOverrun ? "text-[#FF6B6B]" : "text-[#00DF7C]"
                }
              >
                {(budget - spent).toFixed(1)}M
              </span>{" "}
              libre
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={
                "h-full rounded-full transition-all " +
                (budgetOverrun ? "bg-[#FF6B6B]" : "bg-[#00DF7C]")
              }
              style={{ width: `${budgetFillPct}%` }}
            />
          </div>
        </section>

        {/* Pitch */}
        <section className="pt-5">
          <Pitch
            slots={slots}
            positions={positions}
            captainIndex={draft.slots.findIndex((id) => id === draft.captainId)}
            onSlotClick={(i) => setPickerSlot(i)}
          />
        </section>

        {/* CTA */}
        <section className="pt-5 space-y-2">
          <PrimaryCTA
            label={`Continuar · ${filled} / 11`}
            disabled={!v.ok}
            onClick={() => router.push(`/play/${tid}/confirm` as Route)}
          />
          {!v.ok && v.reason && (
            <p className="text-center text-xs text-white/50">{v.reason}</p>
          )}
        </section>
      </div>

      <PlayerPicker
        open={pickerSlot !== null}
        onOpenChange={(o) => {
          if (!o) setPickerSlot(null);
        }}
        players={players}
        position={pickerSlot !== null ? slotPositions[pickerSlot] : undefined}
        excludeIds={pickerExclude}
        budgetRemaining={
          pickerSlot !== null
            ? budget -
              spent +
              (draft.slots[pickerSlot] != null
                ? (costById.get(draft.slots[pickerSlot]!) ?? 0)
                : 0)
            : undefined
        }
        onPick={(id) => {
          if (pickerSlot !== null) setSlot(tid, pickerSlot, id);
          setPickerSlot(null);
        }}
        onClear={
          pickerSlot !== null && draft.slots[pickerSlot] !== null
            ? () => {
                setSlot(tid, pickerSlot, null);
                setPickerSlot(null);
              }
            : undefined
        }
        onCaptain={
          pickerSlot !== null && draft.slots[pickerSlot] !== null
            ? () => {
                setCaptain(tid, draft.slots[pickerSlot]!);
                setPickerSlot(null);
              }
            : undefined
        }
      />

      <BottomNav />
    </main>
  );
}
