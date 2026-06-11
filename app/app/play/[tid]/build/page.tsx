"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { Pitch, type PitchSlot } from "@/components/design/Pitch";
import { Wordmark } from "@/components/design/Wordmark";
import { PrimaryCTA } from "@/components/design/PrimaryCTA";
import { AppShell } from "@/components/design/AppShell";
import { PhaseSwitcher } from "@/components/design/PhaseSwitcher";
import { PlayerPicker } from "@/components/pitch/PlayerPicker";
import { PlayerPoolContent } from "@/components/pitch/PlayerPoolContent";
import { useLineupDraft } from "@/stores/lineupDraft";
import { useFechaPool } from "@/hooks/useFechaPool";
import { usePool } from "@/hooks/usePool";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { UiPlayer } from "@/lib/players/uiPlayer";
import {
  formationSlots,
  formationLayout,
  FORMATION_KEYS,
} from "@/lib/lineup/formations";
import { validateLineup, lineupBudgetSpent } from "@/lib/lineup/validate";
import { fechaBudget, priorPhaseTid, getActiveSeason, fechaLabel } from "@/lib/tournaments/seasons";
import { useLineup } from "@/hooks/useLineup";
import { buildCarryForwardDraft } from "@/lib/lineup/carry-forward";
import { kitUrl } from "@/lib/players/kit";

export default function BuildPage() {
  const router = useRouter();
  const params = useParams<{ tid: string }>();
  const tid = Number(params.tid);
  const { poolAddr, isLoading } = useFechaPool(tid);
  const pool = usePool(poolAddr);

  const priorTid = priorPhaseTid(getActiveSeason(), tid);
  const { poolAddr: priorPoolAddr } = useFechaPool(priorTid);
  const { lineup: priorLineup, captainId: priorCaptainId } = useLineup(priorPoolAddr);

  const draft = useLineupDraft((s) => s.draftFor(tid));
  const setFormation = useLineupDraft((s) => s.setFormation);
  const setSlot = useLineupDraft((s) => s.setSlot);
  const setCaptain = useLineupDraft((s) => s.setCaptain);
  const prefill = useLineupDraft((s) => s.prefill);

  const [players, setPlayers] = useState<UiPlayer[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  const isDesktop = useIsDesktop();

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d: { players: UiPlayer[] }) => { setPlayers(d.players); setPlayersLoaded(true); })
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

  // Filter eliminated players out of NEW picks only. playerMap/costById stay on the
  // full `players` list so an already-picked player whose team got knocked out (or a
  // carried-forward pick) still renders on the pitch and counts toward the budget.
  const pickablePlayers = useMemo(() => players.filter((p) => !p.eliminated), [players]);

  // Carry-forward: when the knockout draft is empty, pre-fill it from the user's
  // on-chain group XI (dropping eliminated players, resetting an eliminated captain).
  // Idempotent: only runs while this phase's draft is still empty, so it never
  // clobbers in-progress edits. Group stage has no prior phase -> priorTid undefined.
  useEffect(() => {
    // first phase: nothing to carry. Strict === undefined: tournamentId 0 is a valid id, so don't use a falsy check.
    if (priorTid === undefined) return;
    if (!priorPoolAddr) return;                             // prior pool unresolved: useLineup would read the active pool, not the prior one
    if (!draft.slots.every((s) => s === null)) return;      // don't overwrite an in-progress draft
    if (!priorLineup || !playersLoaded || playerMap.size === 0) return;
    const priorIds = priorLineup.map((x) => Number(x)).filter((id) => id !== 0);
    if (priorIds.length === 0) return;                       // user didn't play the prior phase
    const carried = buildCarryForwardDraft(
      priorIds,
      priorCaptainId ?? null,
      (id) => {
        const p = playerMap.get(id);
        return p ? { position: p.position, eliminated: p.eliminated } : undefined;
      },
    );
    // Nothing survived to carry (every prior player's team is out): leave the draft
    // empty for a fresh build. Also prevents a render loop — prefilling an all-null
    // draft keeps the "draft is empty" guard above satisfied and would re-fire forever.
    if (carried.slots.every((s) => s === null)) return;
    prefill(tid, carried);
  }, [priorTid, priorPoolAddr, priorLineup, priorCaptainId, playersLoaded, draft.slots, playerMap, prefill, tid]);

  const isKnockout = priorTid !== undefined;

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
      kitUrl: kitUrl(p.teamId),
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

  const activeSeason = getActiveSeason();

  // Gate: pool not open yet
  if (!poolAddr && !isLoading) {
    return (
      <AppShell
        active="home"
        topbarTitle={<>{activeSeason.label} · {fechaLabel(tid)}</>}
        topbarRight={<PhaseSwitcher currentTid={tid} hrefFor={(t) => `/play/${t}/build`} />}
      >
        <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-none lg:px-0 lg:pt-0 lg:pb-0">
          <header className="flex items-center justify-between lg:hidden">
            <Wordmark />
            <ConnectedWalletPill />
          </header>

          <section className="pt-6">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
              Coming soon
            </div>
            <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
              Not open yet
            </h1>
            <p className="mt-2 text-sm text-white/50">
              This phase hasn&apos;t opened yet. Come back when it starts.
            </p>
          </section>
        </div>
      </AppShell>
    );
  }

  // Gate: pool locked
  if (poolAddr && pool.isLocked) {
    return (
      <AppShell
        active="home"
        topbarTitle={<>{activeSeason.label} · {fechaLabel(tid)}</>}
        topbarRight={<PhaseSwitcher currentTid={tid} hrefFor={(t) => `/play/${t}/build`} />}
      >
        <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-none lg:px-0 lg:pt-0 lg:pb-0">
          <header className="flex items-center justify-between lg:hidden">
            <Wordmark />
            <ConnectedWalletPill />
          </header>

          <section className="pt-6">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
              Entries closed
            </div>
            <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
              Phase locked
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Entries for this phase are closed. New lineups can no longer be
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
      </AppShell>
    );
  }

  return (
    <AppShell
      active="home"
      topbarTitle={<>{activeSeason.label} · {fechaLabel(tid)}</>}
      topbarRight={<PhaseSwitcher currentTid={tid} hrefFor={(t) => `/play/${t}/build`} />}
    >
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-none lg:px-0 lg:pt-0 lg:pb-0">
        <header className="flex items-center justify-between lg:hidden">
          <Wordmark />
          <ConnectedWalletPill />
        </header>

        <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:gap-8 lg:items-start">
          <div className="min-w-0">
            <section className="pt-6">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
                Your lineup
              </div>
              <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
                Build your XI
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Pick a formation, tap a slot, and fill your team within budget.
              </p>
              {isKnockout && (
                <p className="mt-2 rounded-xl border border-[#F5C842]/30 bg-[#F5C842]/10 px-3 py-2 text-xs text-[#F5C842]">
                  Your knockout XI rides the whole bracket — players from teams that get eliminated stop scoring. Pick players (and a captain) from teams you expect to go far.
                </p>
              )}
            </section>

            {/* Formation chips */}
            <section className="pt-4">
              <div
                className="flex gap-2 overflow-x-auto"
                role="tablist"
                aria-label="Choose formation"
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
                  left
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
            <section className="pt-5 lg:max-w-[460px] lg:mx-auto">
              <Pitch
                slots={slots}
                positions={positions}
                captainIndex={draft.slots.findIndex((id) => id === draft.captainId)}
                onSlotClick={(i) => setPickerSlot(i)}
              />
            </section>

            {/* CTA */}
            <section className="pt-5 space-y-2">
              {filled === 11 && draft.captainId == null && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-[#F5C842]/40 bg-[#F5C842]/10 px-3 py-2.5 text-center text-sm font-semibold text-[#F5C842]">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#F5C842] text-[11px] font-bold text-black">
                    C
                  </span>
                  Tap a player to set your captain — they score 2× points
                </div>
              )}
              <PrimaryCTA
                label={`Continue · ${filled} / 11`}
                disabled={!v.ok}
                onClick={() => router.push(`/play/${tid}/confirm` as Route)}
              />
              {!v.ok && v.reason && !(filled === 11 && draft.captainId == null) && (
                <p className="text-center text-xs text-white/50">{v.reason}</p>
              )}
            </section>
          </div>

          <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-20 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-display mb-3 text-lg tracking-[0.15em] text-white">PLAYER POOL</h2>
            <PlayerPoolContent
              players={pickablePlayers}
              excludeIds={pickerExclude}
              position={pickerSlot !== null ? slotPositions[pickerSlot] : undefined}
              budgetRemaining={
                pickerSlot !== null
                  ? budget - spent + (draft.slots[pickerSlot] != null ? (costById.get(draft.slots[pickerSlot]!) ?? 0) : 0)
                  : budget - spent
              }
              onPick={(id) => {
                const i = pickerSlot ?? draft.slots.findIndex((s) => s === null);
                if (i >= 0) setSlot(tid, i, id);
                setPickerSlot(null);
              }}
              onCaptain={
                pickerSlot !== null && draft.slots[pickerSlot] !== null
                  ? () => { setCaptain(tid, draft.slots[pickerSlot]!); setPickerSlot(null); }
                  : undefined
              }
              onClear={
                pickerSlot !== null && draft.slots[pickerSlot] !== null
                  ? () => { setSlot(tid, pickerSlot, null); setPickerSlot(null); }
                  : undefined
              }
            />
          </aside>
        </div>
      </div>

      <PlayerPicker
        open={pickerSlot !== null && !isDesktop}
        onOpenChange={(o) => {
          if (!o) setPickerSlot(null);
        }}
        players={pickablePlayers}
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
    </AppShell>
  );
}
