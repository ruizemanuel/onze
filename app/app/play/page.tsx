import type { Route } from "next";
import { redirect } from "next/navigation";
import { getActiveSeason } from "@/lib/tournaments/seasons";

export const dynamic = "force-dynamic";

// Home tab → the active (newest) fecha of the active season.
export default function PlayIndex() {
  const fechas = getActiveSeason().fechas;
  const activeTid = fechas.length
    ? Math.max(...fechas.map((f) => f.tournamentId))
    : 0;
  redirect(`/play/${activeTid}` as Route);
}
