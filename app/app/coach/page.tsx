import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { coachPicks } from "@/lib/db/schema";
import { CoachPickCard } from "@/components/CoachPickCard";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { getActiveProvider } from "@/lib/scoring/providers";
import { initialsFor, teamColorFor } from "@/lib/players/uiPlayer";
import { Wordmark } from "@/components/design/Wordmark";
import { AppShell } from "@/components/design/AppShell";

export const revalidate = 300;
export const dynamic = "force-dynamic";

// On-chain trust identifiers — registered on Celo mainnet.
const ERC8004_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const COACH_AGENT_ID = process.env.NEXT_PUBLIC_COACH_AGENT_ID ?? "9056";

type PlayerSummary = {
  name: string;
  team: string;
  photoUrl: string;
  initials: string;
  teamColor: string;
  teamId?: number;
};

async function buildPlayerMap(): Promise<Map<number, PlayerSummary>> {
  try {
    const players = await getActiveProvider().getPlayers();
    const m = new Map<number, PlayerSummary>();
    for (const p of players) {
      m.set(p.id, {
        name: p.name,
        team: p.team,
        photoUrl: "",
        initials: initialsFor(p.name),
        teamColor: teamColorFor(p.team),
        teamId: p.teamId,
      });
    }
    return m;
  } catch {
    return new Map();
  }
}

async function loadRows() {
  try {
    const db = getDb();
    return await db.select().from(coachPicks).orderBy(desc(coachPicks.mw));
  } catch {
    return [];
  }
}

export default async function CoachPage() {
  const [rows, players] = await Promise.all([loadRows(), buildPlayerMap()]);

  const revealed = rows.filter((r) => r.accuracy !== null);
  const repScore =
    revealed.length === 0
      ? null
      : Math.round(
          revealed.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) /
            revealed.length,
        );

  return (
    <AppShell active="coach">
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 pb-24 lg:max-w-5xl lg:px-0 lg:pt-0 lg:pb-0">
        <header className="flex items-center justify-between lg:hidden">
          <Wordmark />
          <ConnectedWalletPill />
        </header>

        <section className="pt-6">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
            <span
              className="size-1.5 rounded-full bg-[#00DF7C] shadow-[0_0_8px_#00DF7C]"
              aria-hidden
            />
            <span>Verified agent</span>
          </div>
          <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">
            Onze Coach
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Picks are committed onchain before each matchweek and revealed
            after. The Coach&apos;s accuracy is tracked via ERC-8004
            reputation.
          </p>

          <div className="mt-4 flex items-stretch gap-2">
            <div className="flex-1 rounded-2xl border border-[#00DF7C]/30 bg-[#00DF7C]/5 px-3 py-2.5">
              <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
                Onchain identity
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-xs text-white/80">
                <a
                  href={`https://celoscan.io/token/${ERC8004_IDENTITY_REGISTRY}?a=${COACH_AGENT_ID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:text-[#00DF7C] hover:underline"
                >
                  ERC-8004 #{COACH_AGENT_ID}
                </a>
              </div>
            </div>
            <div
              className={
                "rounded-2xl border px-3 py-2.5 text-right " +
                (repScore !== null
                  ? "border-[#F5C842]/40 bg-[#F5C842]/5"
                  : "border-white/10 bg-white/[0.03]")
              }
            >
              <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/50">
                Rep score
              </div>
              <div
                className={
                  "font-display text-2xl leading-none tabular-nums " +
                  (repScore !== null ? "text-[#F5C842]" : "text-white/40")
                }
              >
                {repScore !== null ? `${repScore}%` : "—"}
              </div>
            </div>
          </div>
        </section>

        <div className="pt-6 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
          {rows.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center lg:col-span-2">
              <p className="text-sm text-white/60">No picks yet.</p>
              <p className="mt-1 text-[11px] text-white/40">
                The Coach will publish picks before the next matchweek.
              </p>
            </div>
          )}
          {rows.map((row) => (
            <CoachPickCard
              key={row.id}
              row={{
                mw: row.mw,
                playerIds: row.playerIds,
                playerNames: row.playerIds.map(
                  (id) => players.get(id)?.name ?? null,
                ),
                playerTeams: row.playerIds.map(
                  (id) => players.get(id)?.team ?? null,
                ),
                playerPhotos: row.playerIds.map(
                  (id) => players.get(id)?.photoUrl ?? null,
                ),
                playerInitials: row.playerIds.map(
                  (id) => players.get(id)?.initials ?? null,
                ),
                playerTeamColors: row.playerIds.map(
                  (id) => players.get(id)?.teamColor ?? null,
                ),
                playerTeamIds: row.playerIds.map(
                  (id) => players.get(id)?.teamId ?? null,
                ),
                reasoning: row.reasoning ?? [],
                commitmentHash: row.commitmentHash,
                publishTxHash: row.publishTxHash,
                revealTxHash: row.revealTxHash,
                accuracy: row.accuracy,
              }}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
