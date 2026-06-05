"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { AppShell } from "@/components/design/AppShell";
import { Wordmark } from "@/components/design/Wordmark";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { PrimaryCTA } from "@/components/design/PrimaryCTA";
import { SecondaryCTA } from "@/components/design/SecondaryCTA";
import { usePool } from "@/hooks/usePool";
import { posthog } from "@/lib/posthog";

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type TimelineEvent = {
  label: string;
  status: "done" | "available" | "pending";
  hint?: string;
};

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const pool = usePool();
  const [claimBusy, setClaimBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  // Local guards: reflect a successful tx immediately so a late chain-refetch
  // (wagmi + Celo RPC nodes can lag a tick after a write) doesn't (a) leave
  // a CTA visible+enabled and trigger a second tx that reverts AlreadyClaimed,
  // or (b) leave the timeline entry stuck on the pre-tx label until the user
  // refreshes the page.
  const [claimedLocally, setClaimedLocally] = useState(false);
  const [withdrawnLocally, setWithdrawnLocally] = useState(false);
  const claimed = pool.prizeClaimed || claimedLocally;
  const withdrawn = pool.depositWithdrawn || withdrawnLocally;

  async function onClaim() {
    setClaimBusy(true);
    try {
      await pool.claimPrize();
      setClaimedLocally(true);
      toast.success("Prize claimed 🏆");
      posthog.capture("prize_claimed");
      await pool.refetchPrizeClaimed();
    } catch (e) {
      console.error(e);
      toast.error("Claim failed");
    } finally {
      setClaimBusy(false);
    }
  }

  async function onWithdraw() {
    setWithdrawBusy(true);
    try {
      await pool.withdrawDeposit();
      setWithdrawnLocally(true);
      toast.success("Deposit withdrawn");
      posthog.capture("withdraw_completed", { amount_usdt: 1 });
      await pool.refetchDepositWithdrawn();
    } catch (e) {
      console.error(e);
      toast.error("Withdrawal failed");
    } finally {
      setWithdrawBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <AppShell active="profile">
        <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 px-5 pb-24 lg:min-h-[70vh]">
          <Wordmark className="text-3xl lg:hidden" />
          <p className="text-center text-white/70">
            Connect to view your status.
          </p>
          <ConnectedWalletPill />
        </div>
      </AppShell>
    );
  }

  const timeline: TimelineEvent[] = [];
  if (pool.hasJoined) {
    timeline.push({
      label: "Joined tournament",
      status: "done",
      hint: "$1 USDT staked into Aave V3",
    });
  } else {
    timeline.push({
      label: "Not yet joined",
      status: "pending",
      hint: "Build a lineup to enter",
    });
  }
  if (pool.hasJoined) {
    timeline.push({
      label: pool.isFinalized ? "Tournament settled" : "Tournament in progress",
      status: pool.isFinalized ? "done" : "pending",
      hint: pool.isFinalized
        ? "Prize awarded on-chain"
        : "Settles after MW38",
    });
  }
  if (pool.isWinner) {
    timeline.push({
      label: claimed ? "Prize claimed" : "Prize unclaimed",
      status: claimed ? "done" : "available",
      hint: claimed ? "Winnings sent to wallet" : "Tap Claim to receive",
    });
  }
  if (pool.hasJoined && pool.isFinalized) {
    timeline.push({
      label: withdrawn ? "Deposit withdrawn" : "Deposit refundable",
      status: withdrawn ? "done" : "available",
      hint: withdrawn ? "$1 USDT returned" : "Tap Withdraw to receive $1",
    });
  }

  const showClaim = pool.isWinner && pool.isFinalized && !claimed;
  const showWithdraw = pool.hasJoined && pool.isFinalized && !withdrawn;

  return (
    <AppShell active="profile">
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-2xl lg:px-0 lg:pt-0 lg:pb-0">
        <header className="flex items-center justify-between lg:hidden">
          <Wordmark />
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
            Your wallet
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            Profile
          </h1>
        </section>

        <section className="pt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
                  Address
                </div>
                <div className="font-display mt-1 text-2xl tracking-[0.1em] text-white">
                  {address ? truncate(address) : "—"}
                </div>
              </div>
              <span
                className="font-display rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-wider text-white/50"
                title="Self identity verification — coming in V2"
              >
                Self · soon
              </span>
            </div>
            {address && (
              <div className="mt-2 break-all font-mono text-[10px] text-white/40">
                {address}
              </div>
            )}
          </div>
        </section>

        <section className="pt-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
            Tournament history
          </div>
          <ol className="mt-2 space-y-0.5">
            {timeline.map((ev, i) => (
              <TimelineItem key={i} event={ev} last={i === timeline.length - 1} />
            ))}
          </ol>
        </section>

        {(showClaim || showWithdraw) && (
          <section className="pt-6 space-y-3">
            {showClaim && (
              <PrimaryCTA
                variant="gold"
                label={`Claim Prize`}
                onClick={onClaim}
                loading={claimBusy}
              />
            )}
            {showWithdraw && (
              <SecondaryCTA
                label="Withdraw $1 Deposit"
                onClick={onWithdraw}
                loading={withdrawBusy}
              />
            )}
          </section>
        )}

        {pool.hasJoined && !pool.isFinalized && (
          <p className="pt-4 text-center text-[11px] text-white/40">
            Withdraw available once the tournament settles after MW38.
          </p>
        )}

        <section className="pt-8">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">
            Legal
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            <Link
              href={"/terms" as Route}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75 transition hover:bg-white/5"
            >
              Terms of Service →
            </Link>
            <Link
              href={"/privacy" as Route}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75 transition hover:bg-white/5"
            >
              Privacy Policy →
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function TimelineItem({
  event,
  last,
}: {
  event: TimelineEvent;
  last: boolean;
}) {
  const dotCls =
    event.status === "done"
      ? "bg-[#00DF7C] shadow-[0_0_8px_#00DF7C]"
      : event.status === "available"
      ? "bg-[#F5C842] shadow-[0_0_8px_#F5C842]"
      : "bg-white/30";
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <div className="relative flex flex-col items-center">
        <span className={"mt-1.5 size-2.5 rounded-full " + dotCls} />
        {!last && <span className="mt-1 w-px flex-1 bg-white/10" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-sm font-medium text-white">{event.label}</div>
        {event.hint && (
          <div className="text-[11px] text-white/40">{event.hint}</div>
        )}
      </div>
    </li>
  );
}
