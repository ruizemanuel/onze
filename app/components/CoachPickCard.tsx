"use client";

import Image from "next/image";
import { useState } from "react";
import { useFallbackPhoto } from "@/hooks/useFallbackPhoto";
import { kitUrl } from "@/lib/players/kit";
import { roundPhaseLabel } from "@/lib/tournaments/seasons";

export type CoachPickRow = {
  mw: number;
  playerIds: number[];
  playerNames: (string | null)[];
  playerTeams: (string | null)[];
  playerPhotos: (string | null)[];
  playerInitials: (string | null)[];
  playerTeamColors: (string | null)[];
  playerTeamIds: (number | null)[];
  reasoning: string[];
  commitmentHash: string;
  publishTxHash: string | null;
  revealTxHash: string | null;
  accuracy: number | null;
};

const EXPLORER_BY_NETWORK: Record<string, string> = {
  celo: "https://celoscan.io/tx/",
  alfajores: "https://alfajores.celoscan.io/tx/",
  "celo-sepolia": "https://celo-sepolia.blockscout.com/tx/",
};

export function CoachPickCard({ row }: { row: CoachPickRow }) {
  const network = process.env.NEXT_PUBLIC_NETWORK ?? "celo-sepolia";
  const explorerBase = EXPLORER_BY_NETWORK[network] ?? EXPLORER_BY_NETWORK.celo;
  const revealed = row.revealTxHash !== null;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none text-white">
            {roundPhaseLabel(row.mw)}
          </span>
          {/* Reveal status indicator. Uses the gold accent (matches the
              "X% ACCURATE" badge on the right) instead of the primary green,
              so it doesn't read as "this phase is currently active"
              after the tournament has settled. */}
          <span
            className={
              "ml-1 size-1.5 rounded-full " +
              (revealed
                ? "bg-[#F5C842] shadow-[0_0_6px_#F5C842]"
                : "bg-white/30")
            }
            aria-label={revealed ? "Revealed" : "Pending reveal"}
          />
        </div>
        {row.accuracy !== null ? (
          <span className="font-display rounded-full border border-[#F5C842]/40 bg-[#F5C842]/10 px-2.5 py-1 text-xs tracking-wider text-[#F5C842] tabular-nums">
            {row.accuracy}% ACCURATE
          </span>
        ) : (
          <span className="font-display rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-wider text-white/50">
            PENDING
          </span>
        )}
      </header>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-px-4">
        <div className="flex gap-3" style={{ width: "max-content" }}>
          {row.playerIds.map((id, i) => (
            <PickCard
              key={`${id}-${i}`}
              id={id}
              name={row.playerNames[i] ?? `#${id}`}
              team={row.playerTeams[i] ?? ""}
              photoUrl={row.playerPhotos[i]}
              initials={row.playerInitials[i] ?? "?"}
              teamColor={row.playerTeamColors[i] ?? "#00DF7C"}
              reasoning={row.reasoning[i] ?? ""}
              kitUrl={kitUrl(row.playerTeamIds[i] ?? undefined)}
            />
          ))}
        </div>
      </div>

      <footer className="mt-3 flex flex-wrap gap-2">
        {row.publishTxHash && (
          <a
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/70 transition hover:bg-white/10"
            href={`${explorerBase}${row.publishTxHash}`}
            target="_blank"
            rel="noreferrer"
          >
            Commit tx ↗
          </a>
        )}
        {row.revealTxHash && (
          <a
            className="rounded-full border border-[#00DF7C]/30 bg-[#00DF7C]/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#00DF7C] transition hover:bg-[#00DF7C]/15"
            href={`${explorerBase}${row.revealTxHash}`}
            target="_blank"
            rel="noreferrer"
          >
            Reveal tx ↗
          </a>
        )}
      </footer>
    </article>
  );
}

function PickCard({
  id,
  name,
  team,
  photoUrl,
  initials,
  teamColor,
  reasoning,
  kitUrl: kitUrlProp,
}: {
  id: number;
  name: string;
  team: string;
  photoUrl: string | null;
  initials: string;
  teamColor: string;
  reasoning: string;
  kitUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const { src: resolvedSrc, onError: onPhotoError } = useFallbackPhoto(
    photoUrl ?? undefined,
  );
  const hasReasoning = reasoning && reasoning.length > 0;
  const showPhoto = !!resolvedSrc;

  return (
    <div className="w-[200px] shrink-0 snap-start rounded-xl border border-white/10 bg-[#0F0E14] p-3">
      <div className="flex items-center gap-3">
        {kitUrlProp ? (
          <div className="relative size-12 shrink-0">
            <Image src={kitUrlProp} alt={name} fill sizes="48px" className="object-contain" unoptimized />
          </div>
        ) : (
          <div
            className="relative size-12 shrink-0 rounded-full p-[2px]"
            style={{
              background: `conic-gradient(from 180deg, ${teamColor}, transparent 70%, ${teamColor})`,
            }}
          >
            <div className="size-full overflow-hidden rounded-full bg-[#13121A] flex items-center justify-center relative">
              {showPhoto ? (
                <Image
                  src={resolvedSrc!}
                  alt={name}
                  fill
                  sizes="48px"
                  className="object-cover scale-110"
                  unoptimized
                  onError={onPhotoError}
                />
              ) : (
                <span className="text-xs font-semibold text-white/80">
                  {initials}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{name}</div>
          <div className="text-[10px] text-white/50">
            {team || `#${id}`}
          </div>
        </div>
      </div>

      {hasReasoning && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] text-white/60 transition cursor-pointer hover:bg-white/5"
          aria-expanded={open}
        >
          <span className="flex items-center justify-between">
            <span className="font-display tracking-wider">
              {open ? "Hide reasoning" : "Why this pick"}
            </span>
            <span aria-hidden>{open ? "−" : "+"}</span>
          </span>
        </button>
      )}
      {open && hasReasoning && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/70">
          {reasoning}
        </p>
      )}
    </div>
  );
}
