"use client";
import Image from "next/image";
import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { Match, Side } from "@/lib/fixtures/fixtures";
import type { UiPlayer } from "@/lib/players/uiPlayer";
import { type Xi, tieInForMatch } from "@/lib/fixtures/tie-in";
import { kitUrl } from "@/lib/players/kit";
import { MatchDetail } from "./MatchDetail";

const EMPTY_PLAYERS = new Map<number, UiPlayer>();

function Kit({ side }: { side: Side }) {
  const url = kitUrl(side.squadId);
  return (
    <div className="relative h-7 w-7 shrink-0">
      {url ? (
        <Image src={url} alt={side.name} fill sizes="28px" className="object-contain" unoptimized />
      ) : null}
    </div>
  );
}

function kickoffTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function hasPens(m: Match): boolean {
  return m.home.penalties != null && m.away.penalties != null && (m.home.penalties > 0 || m.away.penalties > 0);
}

export function MatchRow({
  match: m,
  playersById = EMPTY_PLAYERS,
  myXi = null,
}: {
  match: Match;
  playersById?: Map<number, UiPlayer>;
  myXi?: Xi | null;
}) {
  const [open, setOpen] = useState(false);
  const played = m.status === "finished" || m.status === "live";
  const tie = tieInForMatch(m, myXi, playersById);
  const expandable = m.goals.length > 0 || tie.involved;
  const hasCaptain = tie.players.some((p) => p.isCaptain);

  const inner = (
    <>
      <div className="flex flex-1 items-center justify-end gap-2 text-right">
        <span className="text-sm font-medium text-white/85">{m.home.abbr}</span>
        <Kit side={m.home} />
      </div>

      <div className="flex w-20 flex-col items-center">
        {played ? (
          <div className="flex items-center gap-1 text-base font-semibold tabular-nums">
            <span>{m.home.score ?? 0}</span>
            <span className="text-white/40">–</span>
            <span>{m.away.score ?? 0}</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-white/70">{kickoffTime(m.kickoff)}</span>
        )}
        {m.status === "live" && (
          <span className="mt-0.5 rounded-full bg-[#00DF7C]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00DF7C]">
            LIVE
          </span>
        )}
        {m.status === "finished" && (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">FT</span>
        )}
        {hasPens(m) && (
          <span className="mt-0.5 text-[10px] text-white/50">{m.home.penalties}–{m.away.penalties} pens</span>
        )}
        {tie.involved && (
          <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-[#F5C842]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#F5C842]">
            ●{tie.players.length}{hasCaptain ? " C" : ""}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center gap-2">
        <Kit side={m.away} />
        <span className="text-sm font-medium text-white/85">{m.away.abbr}</span>
      </div>
    </>
  );

  if (!expandable) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
        {inner}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="relative flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        {inner}
        {/* Absolutely positioned so the chevron never participates in the home|center|away
            flex distribution — keeps expandable and non-expandable rows perfectly aligned. */}
        <IconChevronDown
          size={16}
          className={"pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition " + (open ? "rotate-180" : "")}
          aria-hidden
        />
      </button>
      {open && <MatchDetail match={m} playersById={playersById} myXi={myXi} />}
    </div>
  );
}
