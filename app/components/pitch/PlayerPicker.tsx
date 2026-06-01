"use client";

import { useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { PlayerRow } from "@/components/design/PlayerRow";
import type { UiPlayer } from "@/lib/players/uiPlayer";

const POSITIONS = ["", "GK", "DEF", "MID", "FWD"] as const;

export type PlayerPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: UiPlayer[];
  excludeIds: number[];
  onPick: (id: number) => void;
  onClear?: () => void;
  position?: string;
  budgetRemaining?: number;
};

export function PlayerPicker({
  open,
  onOpenChange,
  players,
  excludeIds,
  onPick,
  onClear,
  position,
  budgetRemaining,
}: PlayerPickerProps) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("");

  const filtered = useMemo(() => {
    return players
      .filter((p) => !excludeIds.includes(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) =>
        position != null ? p.position === position : !pos || p.position === pos,
      )
      .sort((a, b) => b.form - a.form)
      .slice(0, 100);
  }, [players, q, pos, position, excludeIds]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-[#0F0E14] text-white">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-display text-2xl tracking-[0.18em] text-white">
            Pick a Player
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-6">
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

          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition cursor-pointer hover:bg-white/10"
            >
              Remove from this slot
            </button>
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
                    meta={
                      <>
                        <span>£{p.cost.toFixed(1)}</span>
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
                    onClick={() => {
                      onPick(p.id);
                      onOpenChange(false);
                    }}
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
      </DrawerContent>
    </Drawer>
  );
}
