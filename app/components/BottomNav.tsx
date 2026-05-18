"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { IconHome2, IconChartBar, IconSparkle2, IconUser } from "@tabler/icons-react";

const tabs = [
  { href: "/play" as Route, label: "Home", Icon: IconHome2 },
  { href: "/leaderboard" as Route, label: "Ranking", Icon: IconChartBar },
  { href: "/coach" as Route, label: "Coach", Icon: IconSparkle2 },
  { href: "/profile" as Route, label: "Profile", Icon: IconUser },
] as const;

export function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#08070D]/90 backdrop-blur"
      aria-label="Primary navigation"
    >
      <ul className="mx-auto flex max-w-[440px] items-center justify-around p-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = path?.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={
                  "flex flex-col items-center gap-1 rounded-md px-4 py-2 text-[11px] uppercase tracking-wider transition " +
                  (active ? "text-[#00DF7C]" : "text-white/50 hover:text-white/80")
                }
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
