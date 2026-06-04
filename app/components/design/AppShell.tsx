"use client";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar, type NavKey } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Internal-page frame. At <lg it is transparent (children + BottomNav, mobile
 * unchanged). At lg: it adds the sidebar + topbar grid. AppShell is the single
 * owner of BottomNav — pages must NOT render their own. */
export function AppShell({
  active, children, topbarTitle, topbarRight,
}: { active: NavKey; children: ReactNode; topbarTitle?: ReactNode; topbarRight?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#08070D] text-white lg:pl-[240px]">
      <Sidebar active={active} />
      <Topbar title={topbarTitle} right={topbarRight} />
      <div className="lg:mx-auto lg:max-w-[1240px] lg:px-8 lg:py-6">{children}</div>
      <BottomNav />
    </div>
  );
}
