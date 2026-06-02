"use client";

import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { PlayerRow } from "@/components/design/PlayerRow";
import { PrimaryCTA } from "@/components/design/PrimaryCTA";
import { Wordmark } from "@/components/design/Wordmark";
import { useLineupDraft } from "@/stores/lineupDraft";
import { useFechaPool } from "@/hooks/useFechaPool";
import { usePool } from "@/hooks/usePool";
import { posthog } from "@/lib/posthog";
import type { UiPlayer } from "@/lib/players/uiPlayer";

async function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#00DF7C", "#F5C842", "#FFFFFF"],
    disableForReducedMotion: true,
  });
  setTimeout(
    () =>
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#00DF7C", "#F5C842"],
      }),
    180,
  );
  setTimeout(
    () =>
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#00DF7C", "#F5C842"],
      }),
    260,
  );
}

export default function ConfirmPage() {
  const router = useRouter();
  const params = useParams<{ tid: string }>();
  const tid = Number(params.tid);
  const { poolAddr } = useFechaPool(tid);
  const { isConnected } = useAccount();
  const { switchChain, isPending: switchPending } = useSwitchChain();
  const draft = useLineupDraft((s) => s.draftFor(tid));
  const clear = useLineupDraft((s) => s.clear);
  const pool = usePool(poolAddr);
  const [step, setStep] = useState<"approve" | "join">("approve");
  const [busy, setBusy] = useState(false);
  const [didJoin, setDidJoin] = useState(false);
  const [players, setPlayers] = useState<UiPlayer[]>([]);

  useEffect(() => {
    // Once the join tx confirms we navigate to /play/[tid] and clear the draft
    // explicitly. Don't bounce back to the build step during that transition.
    if (didJoin) return;
    if (draft.slots.some((x) => x === null) || draft.captainId == null) {
      router.replace(`/play/${tid}/build` as Route);
      return;
    }
    if (!poolAddr) return;
    setStep(pool.allowance >= parseUnits("1", 6) ? "join" : "approve");
  }, [draft, pool.allowance, router, didJoin, poolAddr, tid]);

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

  if (!isConnected) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#08070D] p-6 text-white">
        <p className="text-center text-white/70">
          Connect your wallet to continue.
        </p>
        <ConnectedWalletPill />
        <Link
          href={"/" as Route}
          className="text-xs text-white/40 underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </main>
    );
  }
  if (draft.slots.some((x) => x === null) || draft.captainId == null) return null;

  const completed: number[] = draft.slots.filter((x): x is number => x !== null);

  async function onApprove() {
    if (!poolAddr) return;
    setBusy(true);
    try {
      await pool.approve();
      toast.success("USDT approved");
      posthog.capture("usdt_approved", { amount_usdt: 1 });
      await pool.refetchAllowance();
      setStep("join");
    } catch (e) {
      console.error(e);
      toast.error("Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (!poolAddr) return;
    setBusy(true);
    try {
      await pool.join(completed, draft.captainId!);
      setDidJoin(true);
      posthog.capture("deposit_completed", { amount_usdt: 1 });
      toast.success("You're in 🎉");
      router.push(`/play/${tid}` as Route);
      void celebrate();
      clear(tid);
    } catch (e) {
      console.error(e);
      toast.error("Join failed");
      setBusy(false);
    }
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
            Final step
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            Confirm Lineup
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Revisá tu XI y tu capitán.
          </p>
        </section>

        <section className="pt-5 space-y-2">
          {completed.map((id, i) => {
            const p = playerMap.get(id);
            const isCaptain = id === draft.captainId;
            return (
              <PlayerRow
                key={`${id}-${i}`}
                photoUrl={p?.photoUrl}
                initials={p?.initials ?? `#${id}`}
                teamColor={p?.teamColor}
                name={p?.name ?? `Player #${id}`}
                team={p?.team}
                position={p?.position}
                right={isCaptain ? <span className="text-[#F5C842] font-bold text-sm">C</span> : undefined}
              />
            );
          })}
        </section>

        <section className="pt-5">
          <div className="rounded-2xl border border-[#F5C842]/30 bg-[#F5C842]/5 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
                Total
              </span>
              <span className="font-display text-3xl tracking-tight text-[#F5C842] tabular-nums">
                $1.00
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              Refundable in full after this fecha settles, regardless of outcome.
            </p>
          </div>
        </section>

        <section className="pt-5">
          {!poolAddr ? (
            <PrimaryCTA label="Loading fecha…" disabled />
          ) : pool.hasJoined ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/70">
              You already joined this fecha.
              <Link
                href={`/play/${tid}` as Route}
                className="ml-1 text-[#00DF7C] underline-offset-4 hover:underline"
              >
                Go to your team →
              </Link>
            </div>
          ) : pool.isLocked ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/70">
              Entries closed — this fecha has locked. New lineups can
              no longer be submitted.
              <Link
                href={"/leaderboard" as Route}
                className="ml-1 text-[#00DF7C] underline-offset-4 hover:underline"
              >
                See the standings →
              </Link>
            </div>
          ) : pool.wrongNetwork ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#F5C842]/30 bg-[#F5C842]/5 p-4 text-center text-sm text-[#F5C842]">
                Your wallet is on the wrong network. Onze runs on Celo
                {pool.chainId === 42220 ? " mainnet" : ` (chain ${pool.chainId})`}.
              </div>
              <PrimaryCTA
                label="Switch to Celo"
                onClick={() => switchChain({ chainId: pool.chainId })}
                loading={switchPending}
              />
            </div>
          ) : step === "approve" ? (
            <PrimaryCTA
              label="Approve · $1 USDT"
              onClick={onApprove}
              loading={busy}
            />
          ) : (
            <PrimaryCTA
              label="Submit Lineup"
              onClick={onJoin}
              loading={busy}
            />
          )}
          <p className="mt-3 text-center text-[11px] text-white/40">
            Two-step: approve once, then submit your lineup on-chain.
          </p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
