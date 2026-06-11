"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { PlayerRow } from "@/components/design/PlayerRow";
import { kitUrl } from "@/lib/players/kit";
import type { UiPlayer } from "@/lib/players/uiPlayer";

const POSITIONS = ["", "GK", "DEF", "MID", "FWD"] as const;

export type PlayerPoolContentProps = {
  players: UiPlayer[];
  excludeIds: number[];
  onPick: (id: number) => void;
  onClear?: () => void;
  onCaptain?: () => void;
  position?: string;
  budgetRemaining?: number;
};

export function PlayerPoolContent({
  players,
  excludeIds,
  onPick,
  onClear,
  onCaptain,
  position,
  budgetRemaining,
}: PlayerPoolContentProps) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("");

  const filtered = useMemo(() => {
    return players
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) =>
        position != null ? p.position === position : !pos || p.position === pos,
      )
      // Most expensive first (standard fantasy UX); points break ties. The WC
      // provider leaves `form` at 0, so the old form-sort left the list in the
      // feed's team order — sort by price instead.
      .sort((a, b) => b.cost - a.cost || b.points - a.points)
      .slice(0, 100);
  }, [players, q, pos, position, excludeIds]);

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search players"
        className="h-10 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:border-[#00DF7C]/50 focus-visible:ring-[#00DF7C]/20"
      />
      {position == null && (
        <div
          className="flex gap-2 overflow-x-auto"
          role="tablist"
          aria-label="Filter by position"
        >
          {POSITIONS.map((p) => {
            const active = pos === p;
            return (
              <button
                key={p || "all"}
                type="button"
                onClick={() => setPos(p)}
                className={
                  "font-display shrink-0 rounded-full border px-3 py-1 text-sm tracking-[0.15em] transition cursor-pointer " +
                  (active
                    ? "border-[#00DF7C] bg-[#00DF7C] text-black"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
                }
                role="tab"
                aria-selected={active}
              >
                {p || "All"}
              </button>
            );
          })}
        </div>
      )}

      {(onCaptain || onClear) && (
        <div className="flex flex-col gap-2">
          {onCaptain && (
            <button
              type="button"
              onClick={onCaptain}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#F5C842]/40 bg-[#F5C842]/10 px-3 py-2 text-xs font-semibold text-[#F5C842] transition cursor-pointer hover:bg-[#F5C842]/20"
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-[#F5C842] text-[9px] font-bold text-black">
                C
              </span>
              Make captain · 2× points
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition cursor-pointer hover:bg-white/10"
            >
              Remove from this slot
            </button>
          )}
        </div>
      )}

      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {filtered.map((p) => {
          const unaffordable =
            budgetRemaining != null && p.cost > budgetRemaining;
          return (
            <div
              key={p.id}
              className={unaffordable ? "opacity-40 pointer-events-none" : ""}
              aria-disabled={unaffordable || undefined}
            >
              <PlayerRow
                photoUrl={p.photoUrl}
                initials={p.initials}
                teamColor={p.teamColor}
                name={p.name}
                team={p.team}
                position={p.position}
                kitUrl={kitUrl(p.teamId)}
                meta={
                  <>
                    <span>{p.cost.toFixed(1)}M</span>
                    <span className="mx-1.5 text-white/25">·</span>
                    <span className="tabular-nums">
                      form {p.form.toFixed(1)}
                    </span>
                  </>
                }
                right={
                  <>
                    <div className="font-display text-base text-white tabular-nums">
                      {p.points}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-white/40">
                      pts
                    </div>
                  </>
                }
                onClick={() => onPick(p.id)}
              />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-white/50">
            No players match.
          </p>
        )}
      </div>
    </div>
  );
}
