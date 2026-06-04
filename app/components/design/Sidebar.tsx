"use client";
import Link from "next/link";
import type { Route } from "next";
import { IconHome2, IconTrophy, IconChartBar, IconSparkle2, IconUser } from "@tabler/icons-react";
import { Wordmark } from "./Wordmark";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";

export type NavKey = "home" | "tournaments" | "ranking" | "coach" | "profile";

const ITEMS: { key: NavKey; href: Route; label: string; Icon: typeof IconHome2 }[] = [
  { key: "home", href: "/play" as Route, label: "Home", Icon: IconHome2 },
  { key: "tournaments", href: "/tournaments" as Route, label: "Tournaments", Icon: IconTrophy },
  { key: "ranking", href: "/leaderboard" as Route, label: "Ranking", Icon: IconChartBar },
  { key: "coach", href: "/coach" as Route, label: "Coach", Icon: IconSparkle2 },
  { key: "profile", href: "/profile" as Route, label: "Profile", Icon: IconUser },
];

export function Sidebar({ active }: { active: NavKey }) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col gap-1 border-r border-white/10 bg-white/[0.03] px-4 py-6 backdrop-blur">
      <div className="px-2 pb-4"><Wordmark /></div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {ITEMS.map(({ key, href, label, Icon }) => {
          const on = active === key;
          return (
            <Link key={key} href={href}
              className={"flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition " +
                (on ? "bg-[#00DF7C]/12 text-[#00DF7C]" : "text-white/55 hover:bg-white/5 hover:text-white/85")}
              aria-current={on ? "page" : undefined}>
              <Icon size={20} aria-hidden /><span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-1"><ConnectedWalletPill /></div>
    </aside>
  );
}
