"use client";

import Image from "next/image";
import { useFallbackPhoto } from "@/hooks/useFallbackPhoto";

export type PlayerSlotSize = "lg" | "md" | "sm";

export type PlayerSlotProps = {
  photoUrl?: string;
  initials?: string;
  teamColor?: string;
  name?: string;
  team?: string;
  position?: string;
  size?: PlayerSlotSize;
  showLabel?: boolean;
  captain?: boolean;
  kitUrl?: string;
};

export const SIZE_PX: Record<PlayerSlotSize, number> = {
  lg: 80,
  md: 56,
  sm: 36,
};

export function PlayerSlot({
  photoUrl,
  initials,
  teamColor = "#00DF7C",
  name,
  team,
  position,
  size = "lg",
  showLabel = true,
  captain = false,
  kitUrl,
}: PlayerSlotProps) {
  const px = SIZE_PX[size];
  const labelInitialsCls =
    size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-xs";
  // On the pitch 11 names sit close together; show the surname only and cap the
  // width so adjacent labels never overlap.
  const shortName = name ? name.trim().split(/\s+/).slice(-1)[0] : undefined;
  const { src: resolvedSrc, onError: onPhotoError } = useFallbackPhoto(photoUrl);
  const showPhoto = !!resolvedSrc;

  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))" }}
    >
      <div className="relative" style={{ width: px, height: px }}>
        {kitUrl ? (
          <Image
            src={kitUrl}
            alt={name ?? ""}
            fill
            sizes={`${px}px`}
            className="object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
            unoptimized
          />
        ) : (
          <div
            className="absolute inset-0 rounded-full p-[3px]"
            style={{
              background: `conic-gradient(from 180deg, ${teamColor}, transparent 70%, ${teamColor})`,
            }}
          >
            <div className="size-full rounded-full bg-[#13121A] overflow-hidden flex items-center justify-center relative">
              {showPhoto ? (
                <Image
                  src={resolvedSrc!}
                  alt={name ?? ""}
                  fill
                  sizes={`${px}px`}
                  className="object-cover scale-110"
                  unoptimized
                  onError={onPhotoError}
                />
              ) : initials ? (
                <span
                  className={`font-semibold text-white/90 tracking-wide ${labelInitialsCls}`}
                >
                  {initials}
                </span>
              ) : null}
            </div>
          </div>
        )}
        {captain && (
          <span
            className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#F5C842] text-[10px] font-bold text-black"
            aria-label="Captain"
          >
            C
          </span>
        )}
      </div>
      {showLabel && (name || team || position) && (
        <div className="flex flex-col items-center gap-0.5 text-center">
          {shortName && (
            <span className="max-w-[5rem] truncate text-[10px] font-semibold uppercase tracking-wide text-white">
              {shortName}
            </span>
          )}
          {(team || position) && (
            <span className="flex items-center gap-1 text-[9px] text-white/60">
              {team && (
                <>
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: teamColor }}
                  />
                  <span>{team}</span>
                </>
              )}
              {team && position && <span className="text-white/30">·</span>}
              {position && <span>{position}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
