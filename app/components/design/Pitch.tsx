"use client";

import type { ReactNode } from "react";
import { PitchSVG } from "./PitchSVG";
import { PlayerSlot, type PlayerSlotProps } from "./PlayerSlot";
import type { PitchPosition } from "@/lib/lineup/formations";

export type PitchSlot = (PlayerSlotProps & { empty?: false }) | { empty: true };

const PENTAGON_POSITIONS: PitchPosition[] = [
  { top: "17%", left: "50%" },
  { top: "39%", left: "22%" },
  { top: "39%", left: "78%" },
  { top: "67%", left: "32%" },
  { top: "67%", left: "68%" },
];

export type PitchProps = {
  slots: PitchSlot[];
  positions?: PitchPosition[];     // defaults to the 5-slot pentagon
  captainIndex?: number | null;    // slot index to badge as captain
  onSlotClick?: (index: number) => void;
  emptyLabel?: string;
};

export function Pitch({ slots, positions = PENTAGON_POSITIONS, captainIndex = null, onSlotClick, emptyLabel = "Pick" }: PitchProps) {
  return (
    <div
      className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl"
      style={{
        background:
          "radial-gradient(ellipse at top, #1A6B3E 0%, #0A2818 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -40px 80px rgba(0,0,0,0.6), 0 16px 40px rgba(0,0,0,0.4)",
      }}
    >
      <PitchSVG />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)",
        }}
        aria-hidden
      />

      {positions.map((p, i) => {
        const slot = slots[i];
        const interactive = !!onSlotClick;
        const content: ReactNode = !slot || slot.empty ? (
          <EmptyPitchSlot label={emptyLabel} />
        ) : (
          <PlayerSlot {...slot} size={slot.size ?? "lg"} captain={i === captainIndex} />
        );
        const wrapperCls =
          "absolute -translate-x-1/2 -translate-y-1/2" +
          (interactive ? " cursor-pointer active:scale-[0.98] transition" : "");
        return (
          <div
            key={i}
            className={wrapperCls}
            style={{ top: p.top, left: p.left }}
            onClick={interactive ? () => onSlotClick(i) : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSlotClick(i);
                    }
                  }
                : undefined
            }
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

function EmptyPitchSlot({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="size-20 rounded-full border border-dashed border-white/30 bg-white/5 backdrop-blur flex items-center justify-center animate-pulse motion-reduce:animate-none"
        aria-label="Empty slot"
      >
        <span className="text-2xl text-white/40 leading-none">+</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-white/50 font-medium">
        {label}
      </span>
    </div>
  );
}
