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
};

const SIZE_PX: Record<PlayerSlotSize, number> = {
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
}: PlayerSlotProps) {
  const px = SIZE_PX[size];
  const labelInitialsCls =
    size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-xs";
  const { src: resolvedSrc, onError: onPhotoError } = useFallbackPhoto(photoUrl);
  const showPhoto = !!resolvedSrc;

  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))" }}
    >
      <div className="relative" style={{ width: px, height: px }}>
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
        {captain && (
          <span
            className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#F5C842] text-[10px] font-bold text-black"
            aria-label="Capitán"
          >
            C
          </span>
        )}
      </div>
      {showLabel && (name || team || position) && (
        <div className="flex flex-col items-center gap-0.5 text-center">
          {name && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
              {name}
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
