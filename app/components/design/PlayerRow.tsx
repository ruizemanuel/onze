"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useFallbackPhoto } from "@/hooks/useFallbackPhoto";

export type PlayerRowProps = {
  photoUrl?: string;
  initials?: string;
  teamColor?: string;
  name: string;
  team?: string;
  position?: string;
  meta?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
  kitUrl?: string;
};

export function PlayerRow({
  photoUrl,
  initials,
  teamColor = "#00DF7C",
  name,
  team,
  position,
  meta,
  right,
  onClick,
  className = "",
  kitUrl,
}: PlayerRowProps) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "div";
  const interactiveCls = interactive
    ? "transition cursor-pointer hover:bg-white/[0.06] active:scale-[0.99] motion-reduce:active:scale-100"
    : "";
  const { src: resolvedSrc, onError: onPhotoError } = useFallbackPhoto(photoUrl);
  const showPhoto = !!resolvedSrc;
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left " +
        interactiveCls +
        " " +
        className
      }
    >
      {kitUrl ? (
        <div className="relative size-12 shrink-0">
          <Image src={kitUrl} alt={name} fill sizes="48px" className="object-contain" unoptimized />
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
                {initials ?? "?"}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        {(position || team || meta) && (
          <div className="text-[11px] text-white/50">
            {position && (
              <span className="font-display tracking-wider">{position}</span>
            )}
            {position && team && <span className="mx-1.5 text-white/25">·</span>}
            {team && <span>{team}</span>}
            {meta && (
              <>
                {(position || team) && (
                  <span className="mx-1.5 text-white/25">·</span>
                )}
                {meta}
              </>
            )}
          </div>
        )}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </Tag>
  );
}
