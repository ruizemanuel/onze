"use client";
import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { RoundFixtures } from "@/lib/fixtures/fixtures";
import { groupMatchesByDay, shortDate } from "@/lib/fixtures/fixtures";
import { MatchRow } from "./MatchRow";

export function RoundSection({ round, defaultOpen }: { round: RoundFixtures; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const range =
    round.startDate && round.endDate ? `${shortDate(round.startDate)} – ${shortDate(round.endDate)}` : "";

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">{round.stageLabel}</span>
          {range && <span className="text-xs text-white/40">{range}</span>}
        </span>
        <IconChevronDown
          size={18}
          className={"text-white/40 transition " + (open ? "rotate-180" : "")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-white/5 px-3 pb-3 pt-1">
          {round.matches.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-white/40">Bracket set after the group stage.</p>
          ) : (
            groupMatchesByDay(round.matches).map(({ day, matches }) => (
              <div key={day} className="pt-3">
                <h3 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  {shortDate(day)}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {matches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
