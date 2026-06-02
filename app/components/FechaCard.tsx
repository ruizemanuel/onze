import Link from "next/link";
import type { Route } from "next";
import type { FechaStatus } from "@/lib/tournaments/fechaStatus";

const PILL: Record<FechaStatus, { label: string; cls: string }> = {
  joining: { label: "Joining", cls: "text-[#00DF7C] bg-[#00DF7C]/13 border-[#00DF7C]/35" },
  scoring: { label: "Scoring", cls: "text-[#5AA9FF] bg-[#5AA9FF]/12 border-[#5AA9FF]/35" },
  settled: { label: "Settled", cls: "text-[#F5C842] bg-[#F5C842]/12 border-[#F5C842]/32" },
  soon: { label: "Soon", cls: "text-white/40 bg-white/5 border-white/10" },
};

export type FechaCardProps = {
  tournamentId: number;
  fechaNumber: number; // 1-based position in the season
  round: number; // FPL GW
  status: FechaStatus;
  sub: string; // status-specific subtitle (already formatted by the server)
  label?: string; // human phase label (e.g. "Fase de grupos"); when set, replaces "Fecha N" + hides GW line
};

export function FechaCard({ tournamentId, fechaNumber, round, status, sub, label }: FechaCardProps) {
  const pill = PILL[status];
  const dim = status === "soon" ? "opacity-60 pointer-events-none" : "";
  const inner = (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition hover:bg-white/5 ${dim}`}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none tracking-[0.04em]">{label ?? `Fecha ${fechaNumber}`}</span>
          {!label && <span className="text-[11px] uppercase tracking-[0.08em] text-white/40">GW{round}</span>}
        </div>
        <div className="mt-1.5 text-xs text-white/50">{sub}</div>
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] ${pill.cls}`}>{pill.label}</span>
    </div>
  );
  if (status === "soon") return inner;
  return <Link href={`/play/${tournamentId}` as Route}>{inner}</Link>;
}
