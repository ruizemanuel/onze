"use client";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { getActiveSeason, fechaLabel } from "@/lib/tournaments/seasons";

/** Custom (non-native) dropdown of the active season's phases; selecting one
 * navigates to `hrefFor(tid)`. We don't use a native <select> because its option
 * popup can't be reliably themed across browsers (renders white on Windows).
 * Renders nothing for single-phase seasons (e.g. Premier). */
export function PhaseSwitcher({
  currentTid,
  hrefFor,
  overallHref,
  overallLabel = "Overall",
}: {
  currentTid?: number;
  hrefFor: (tid: number) => string;
  overallHref?: string;
  overallLabel?: string;
}) {
  const router = useRouter();
  const fechas = getActiveSeason().fechas;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (fechas.length < 2) return null;

  const hasOverall = overallHref !== undefined;
  const isOverall = hasOverall && currentTid == null;
  const currentLabel = isOverall
    ? overallLabel
    : currentTid != null
      ? fechaLabel(currentTid)
      : "Phase…";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch phase"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-3 py-1 text-sm text-white/80 transition cursor-pointer hover:bg-white/10"
      >
        <span>{currentLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={"transition-transform " + (open ? "rotate-180" : "")}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-white/10 bg-[#13121A] py-1 shadow-xl shadow-black/50"
        >
          {hasOverall && (
            <li role="option" aria-selected={isOverall}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(overallHref as Route);
                }}
                className={
                  "block w-full px-3 py-2 text-left text-sm transition cursor-pointer " +
                  (isOverall ? "bg-[#00DF7C]/15 text-[#00DF7C]" : "text-white/80 hover:bg-white/10")
                }
              >
                {overallLabel}
              </button>
            </li>
          )}
          {fechas.map((f) => {
            const selected = f.tournamentId === currentTid;
            return (
              <li key={f.tournamentId} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(hrefFor(f.tournamentId) as Route);
                  }}
                  className={
                    "block w-full px-3 py-2 text-left text-sm transition cursor-pointer " +
                    (selected
                      ? "bg-[#00DF7C]/15 text-[#00DF7C]"
                      : "text-white/80 hover:bg-white/10")
                  }
                >
                  {fechaLabel(f.tournamentId)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
