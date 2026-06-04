"use client";
import type { ReactNode } from "react";
import { getActiveSeason } from "@/lib/tournaments/seasons";

export function Topbar({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center justify-between border-b border-white/10 bg-[#08070D]/80 px-8 backdrop-blur">
      <div className="text-sm font-semibold text-white">
        {title ?? <span>{getActiveSeason().label}</span>}
      </div>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}
