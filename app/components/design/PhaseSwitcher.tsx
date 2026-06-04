"use client";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { getActiveSeason, fechaLabel } from "@/lib/tournaments/seasons";

/** Dropdown of the active season's phases; selecting one navigates to `hrefFor(tid)`.
 * Renders nothing for single-phase seasons (e.g. Premier). */
export function PhaseSwitcher({ currentTid, hrefFor }: { currentTid?: number; hrefFor: (tid: number) => string }) {
  const router = useRouter();
  const fechas = getActiveSeason().fechas;
  if (fechas.length < 2) return null;
  return (
    <select
      aria-label="Switch phase"
      value={currentTid ?? ""}
      onChange={(e) => router.push(hrefFor(Number(e.target.value)) as Route)}
      className="rounded-full border border-white/14 bg-white/5 px-3 py-1 text-sm text-white/80"
    >
      <option value="" hidden disabled>Phase…</option>
      {fechas.map((f) => (
        <option key={f.tournamentId} value={f.tournamentId} className="bg-[#0F0E14]">
          {fechaLabel(f.tournamentId)}
        </option>
      ))}
    </select>
  );
}
