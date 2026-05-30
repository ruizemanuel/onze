"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSeasonPool } from "@/hooks/useSeasonPool";
import { PrimaryCTA } from "@/components/design/PrimaryCTA";

function usd(amount: bigint) {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}
function truncate(a?: string) {
  return a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a ?? "");
}

/** Gold season banner: aspirational pot while running; champion + claim once finalized. */
export function SeasonPrizeBanner({ fechasSettled, fechasTotal }: { fechasSettled: number; fechasTotal: number }) {
  const s = useSeasonPool();
  const [claimedLocally, setClaimedLocally] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!s.seasonPool) return null; // season pool not created yet → render nothing

  const claimed = s.prizeClaimed || claimedLocally;

  if (!s.finalized) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#F5C842]/30 bg-gradient-to-br from-[#F5C842]/10 to-[#F5C842]/[0.02] p-5 shadow-[0_8px_30px_rgba(245,200,66,0.10)]">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5C842]">Season pot · growing in Aave</div>
        <div className="font-display mt-1.5 text-5xl leading-none text-white [text-shadow:0_0_24px_rgba(245,200,66,0.25)]">
          {usd(s.seedAmount)}<span className="ml-1.5 text-lg tracking-wide text-[#F5C842]">+ yield</span>
        </div>
        <div className="mt-1.5 text-xs font-medium text-[#F5C842]/85">
          {fechasSettled} of {fechasTotal} fechas settled · champion decided after the last fecha
        </div>
      </div>
    );
  }

  // Finalized → champion banner.
  async function onClaim() {
    setBusy(true);
    try {
      await s.claimPrize();
      setClaimedLocally(true);
      toast.success("Prize claimed 🏆");
      await s.refetchPrizeClaimed();
    } catch (e) {
      console.error(e);
      toast.error("Claim failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F5C842]/45 p-6 text-center shadow-[0_10px_40px_rgba(245,200,66,0.18)] [background:radial-gradient(120%_120%_at_50%_0,rgba(245,200,66,0.16),rgba(245,200,66,0.03)_60%,transparent)]">
      <div className="text-3xl">🏆</div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#F5C842]">Season champion</div>
      <div className="mt-2.5 font-mono text-sm text-white">{truncate(s.champion)}</div>
      <div className="font-display mt-3 text-4xl text-white [text-shadow:0_0_24px_rgba(245,200,66,0.3)]">{usd(s.prizeAmount)}</div>
      <div className="mt-0.5 text-[11px] text-[#F5C842]/85">seed + Aave yield</div>
      {s.isChampion && (
        <div className="mt-4">
          {claimed ? (
            <div className="rounded-xl border border-[#00DF7C]/30 bg-[#00DF7C]/10 py-3 text-sm font-semibold text-[#00DF7C]">Claimed ✓</div>
          ) : (
            <PrimaryCTA label={`Claim ${usd(s.prizeAmount)}`} onClick={onClaim} loading={busy} />
          )}
        </div>
      )}
    </div>
  );
}
