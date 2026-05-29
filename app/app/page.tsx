import Link from "next/link";
import type { Route } from "next";
import { createPublicClient, http } from "viem";
import { celo, celoAlfajores, celoSepolia } from "viem/chains";
import { BottomNav } from "@/components/BottomNav";
import { ConnectedWalletPill } from "@/components/ConnectedWalletPill";
import { DesktopTicketCTA } from "@/components/DesktopTicketCTA";
import { LandingCTA } from "@/components/LandingCTA";
import { Pitch, type PitchSlot } from "@/components/design/Pitch";
import { Stat } from "@/components/design/Stat";
import { pick5PoolAbi } from "@/lib/contracts/abi";
import { DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { resolveActivePool } from "@/lib/contracts/factory";

export const revalidate = 60; // refresh on-chain stats once per minute

function getChain(network: string) {
  if (network === "celo") return celo;
  if (network === "celo-sepolia") return celoSepolia;
  return celoAlfajores;
}

async function readPoolStats() {
  const client = createPublicClient({ chain: getChain(DEFAULT_NETWORK), transport: http() });
  try {
    const pool = await resolveActivePool(client, DEFAULT_NETWORK);
    if (!pool) {
      return { players: 0, poolUsd: 0, prizeUsd: 0 };
    }
    const [deposit, seedAmount, participants] = await Promise.all([
      client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "deposit" }) as Promise<bigint>,
      client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "seedAmount" }) as Promise<bigint>,
      client.readContract({ address: pool, abi: pick5PoolAbi, functionName: "participantsLength" }) as Promise<bigint>,
    ]);
    const players = Number(participants);
    const poolTotal = seedAmount + deposit * participants;
    const poolUsd = Number(poolTotal) / 1_000_000;
    const prizeUsd = Number(seedAmount) / 1_000_000;
    return { players, poolUsd, prizeUsd };
  } catch {
    return { players: 0, poolUsd: 0, prizeUsd: 0 };
  }
}

const FPL_PHOTO = (code: number) =>
  `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;

const PREVIEW_LINEUP: PitchSlot[] = [
  {
    photoUrl: FPL_PHOTO(223094),
    initials: "EH",
    name: "Haaland",
    team: "MCI",
    position: "FWD",
    teamColor: "#6CABDD",
  },
  {
    photoUrl: FPL_PHOTO(223340),
    initials: "BS",
    name: "Saka",
    team: "ARS",
    position: "MID",
    teamColor: "#EF0107",
  },
  {
    photoUrl: FPL_PHOTO(244851),
    initials: "CP",
    name: "Palmer",
    team: "CHE",
    position: "MID",
    teamColor: "#034694",
  },
  {
    photoUrl: FPL_PHOTO(221820),
    initials: "LM",
    name: "Martinez",
    team: "MUN",
    position: "DEF",
    teamColor: "#DA291C",
  },
  {
    photoUrl: FPL_PHOTO(462424),
    initials: "WS",
    name: "Saliba",
    team: "ARS",
    position: "DEF",
    teamColor: "#EF0107",
  },
];

const LOCK_DATE = new Date("2026-05-16T14:00:00Z");

function timeUntil(target: Date): string {
  const ms = Math.max(0, target.getTime() - Date.now());
  if (ms === 0) return "Locked";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h`;
}

const DESKTOP_TICKER = [
  { kind: "head", text: "KICKS OFF · SAT 16 MAY · 14:00 UTC" },
  { kind: "price", html: "<b>$1</b> USDT TO PLAY" },
  { kind: "price", html: "<b>$10</b> + YIELD TO WIN" },
  { kind: "head", text: "WINNER TAKES ALL · NO-LOSS · CELO + AAVE V3" },
  { kind: "head", text: "PICK5-BETA.VERCEL.APP" },
] as const;

export default async function LandingPage() {
  const locksIn = timeUntil(LOCK_DATE);
  const { players, poolUsd, prizeUsd } = await readPoolStats();
  const fmt = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

  return (
    <main className="min-h-dvh bg-[#08070D] text-white">
      {/* ===================== MOBILE LAYOUT (<1024px) ===================== */}
      <div className="mx-auto flex max-w-[440px] flex-col px-5 pt-5 lg:hidden">
        <header className="flex items-center justify-between">
          <span className="font-display text-2xl tracking-[0.2em] text-white">
            PICK<span className="text-[#00DF7C]">5</span>
          </span>
          <ConnectedWalletPill />
        </header>

        <section className="pt-10">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#00DF7C]">
            Tournament Live
          </div>
          <h1 className="font-display mt-2 text-[44px] leading-[0.95] tracking-tight">
            Pick 5.<br />
            Win the pool.<br />
            <span className="text-[#00DF7C]">Lose nothing.</span>
          </h1>
          <p className="mt-3 max-w-[34ch] text-sm text-white/60">
            Deposit $1 USDT, pick 5 Premier League players for the final 2
            matchweeks. Your stake earns yield in Aave V3 — top scorer takes the
            entire prize pool. Withdraw your $1 anytime after.
          </p>
        </section>

        <section className="pt-6">
          <Pitch slots={PREVIEW_LINEUP} />
        </section>

        <section className="pt-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Pool"
              value={fmt(poolUsd)}
              sub={`${players} player${players === 1 ? "" : "s"}`}
            />
            <Stat label="Prize" value={fmt(prizeUsd)} sub="seed + yield" highlight />
            <Stat
              label="Locks in"
              value={locksIn}
              sub="Sat · 16 May · 14:00 UTC"
            />
          </div>
        </section>

        <section className="pt-8">
          <LandingCTA />
          <p className="mt-3 text-center text-[11px] text-white/40">
            Built on Celo · ERC-8004 verified Coach
          </p>
          <p className="mt-1.5 text-center text-[10px] text-white/30">
            <Link
              href={"/terms" as Route}
              className="underline-offset-2 hover:text-white/60 hover:underline"
            >
              Terms
            </Link>
            <span className="mx-2">·</span>
            <Link
              href={"/privacy" as Route}
              className="underline-offset-2 hover:text-white/60 hover:underline"
            >
              Privacy
            </Link>
          </p>
        </section>

        <div className="h-24" />
      </div>

      {/* ===================== DESKTOP LAYOUT (≥1024px) ===================== */}
      <div className="hidden lg:block lp-root">
        <div className="lp-grain" aria-hidden />
        <div className="lp-stage">
          <header className="lp-top-stripe lp-anim lp-anim-d1">
            <div className="lp-brand">
              PICK<b>5</b>
            </div>
            <div className="lp-stamp">
              <b>PREMIER LEAGUE</b>
              <span>FINAL · GW 37+38</span>
            </div>
            <div aria-hidden />
          </header>

          <div className="lp-wordmark" aria-hidden>
            PICK FIVE
          </div>

          <div className="lp-pitch-svg" aria-hidden>
            <svg viewBox="0 0 1200 800" preserveAspectRatio="none">
              <rect
                x="2"
                y="2"
                width="1196"
                height="796"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <line
                x1="2"
                y1="400"
                x2="1198"
                y2="400"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <circle
                cx="600"
                cy="400"
                r="90"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <circle cx="600" cy="400" r="3" fill="rgba(255,255,255,0.55)" />
              <rect
                x="400"
                y="2"
                width="400"
                height="120"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <rect
                x="490"
                y="2"
                width="220"
                height="50"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <rect
                x="400"
                y="678"
                width="400"
                height="120"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <rect
                x="490"
                y="748"
                width="220"
                height="50"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <path
                d="M 540 122 A 70 70 0 0 0 660 122"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <path
                d="M 540 678 A 70 70 0 0 1 660 678"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
            </svg>
          </div>

          <section className="lp-composition">
            <div className="lp-anim lp-anim-d4">
              <div className="lp-dossier lp-dossier-accent">
                <div className="lp-dossier-ref">PRIZE</div>
                <div className="lp-dossier-label">WINNER · TAKES · ALL</div>
                <div className="lp-dossier-value">
                  {fmt(prizeUsd)}
                  <span className="lp-dossier-unit">+ YIELD</span>
                </div>
                <div className="lp-dossier-sub">SEED · ALL AAVE V3 INTEREST</div>
              </div>
            </div>

            <div className="lp-hero">
              <h1 className="lp-h1">
                <span className="lp-h1-row lp-anim lp-anim-d3">PICK FIVE.</span>
                <span className="lp-h1-row lp-anim lp-anim-d4">
                  <span className="lp-h1-pop">WIN THE POOL.</span>
                </span>
                <span className="lp-h1-row lp-anim lp-anim-d5">
                  <span className="lp-h1-strike">LOSE NOTHING.</span>
                </span>
              </h1>
              <p className="lp-tagline lp-anim lp-anim-d6">
                <b>$1 USDT</b> to play. Top scorer takes the entire Aave V3 yield plus a{" "}
                <b>{fmt(prizeUsd)} seed</b>. Everyone else gets their dollar back when the
                whistle blows.
              </p>
              <DesktopTicketCTA />
            </div>

            <div className="lp-anim lp-anim-d4">
              <div className="lp-dossier lp-dossier-flip">
                <div className="lp-dossier-live">
                  <span className="lp-dossier-live-txt">LIVE</span>
                </div>
                <div className="lp-dossier-ref">POOL</div>
                <div className="lp-dossier-label">CURRENT BALANCE</div>
                <div className="lp-dossier-value">
                  {fmt(poolUsd)}
                  <span className="lp-dossier-unit">USDT</span>
                </div>
                <div className="lp-dossier-sub">
                  {Number(prizeUsd).toFixed(0)} SEED · {players} DEPOSIT
                  {players === 1 ? "" : "S"}
                </div>
              </div>
            </div>
          </section>

          <div className="lp-ticker">
            <div className="lp-ticker-track">
              {DESKTOP_TICKER.map((item, i) =>
                item.kind === "head" ? (
                  <span key={i} className="lp-ticker-it lp-ticker-head">
                    {item.text}
                  </span>
                ) : (
                  <span
                    key={i}
                    className="lp-ticker-it"
                    dangerouslySetInnerHTML={{ __html: item.html }}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      {/* Desktop landing CSS — scoped under .lp-root so the mobile layout is untouched */}
      <style>{`
        .lp-root {
          --lp-bg: #050708;
          --lp-pitch-1: #1A6B3E;
          --lp-pitch-2: #082015;
          --lp-green: #00DF7C;
          --lp-ink: #F5F5F0;
          --lp-ink-mute: rgba(245, 245, 240, 0.55);
          --lp-ink-faint: rgba(245, 245, 240, 0.22);
          --lp-hairline: rgba(245, 245, 240, 0.14);
          background: var(--lp-bg);
          color: var(--lp-ink);
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 400;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          min-height: 100vh;
        }

        .lp-grain {
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 200;
          opacity: 0.7;
        }

        .lp-stage {
          position: relative;
          min-height: 1100px;
          overflow: hidden;
        }
        .lp-stage::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 8% -10%, rgba(255, 158, 59, 0.16) 0%, transparent 28%),
            radial-gradient(circle at 92% -10%, rgba(255, 158, 59, 0.12) 0%, transparent 28%),
            radial-gradient(ellipse 90% 80% at 50% 60%, var(--lp-pitch-1) 0%, var(--lp-pitch-2) 55%, var(--lp-bg) 100%),
            var(--lp-bg);
          z-index: 0;
        }
        .lp-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 90px,
            rgba(255, 255, 255, 0.022) 90px,
            rgba(255, 255, 255, 0.022) 180px
          );
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 1;
        }

        .lp-pitch-svg {
          position: absolute;
          inset: 120px 8% 200px 8%;
          z-index: 2;
          pointer-events: none;
          transform: perspective(1800px) rotateX(8deg);
          transform-origin: 50% 100%;
          opacity: 0.95;
        }
        .lp-pitch-svg svg { width: 100%; height: 100%; }

        .lp-top-stripe {
          position: relative;
          z-index: 10;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 28px 56px 22px;
          border-bottom: 1px solid var(--lp-hairline);
          gap: 32px;
        }
        .lp-brand {
          font-family: var(--font-anton), 'Anton', sans-serif;
          font-size: 42px;
          letter-spacing: 0.18em;
          line-height: 1;
        }
        .lp-brand b { color: var(--lp-green); font-weight: 400; }

        .lp-stamp {
          justify-self: center;
          display: inline-flex;
          align-items: baseline;
          gap: 14px;
          padding: 8px 18px;
          border: 2px solid var(--lp-ink-faint);
          border-radius: 3px;
          transform: rotate(-2deg);
          font-family: var(--font-mono-jb), 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--lp-ink-mute);
          position: relative;
        }
        .lp-stamp::before,
        .lp-stamp::after {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--lp-ink-faint);
        }
        .lp-stamp b {
          font-family: var(--font-anton), 'Anton', sans-serif;
          font-size: 16px;
          letter-spacing: 0.06em;
          color: var(--lp-ink);
        }

        .lp-wordmark {
          position: absolute;
          left: -120px;
          top: 50%;
          transform: translateY(-50%) rotate(-90deg);
          transform-origin: center;
          font-family: var(--font-anton), 'Anton', sans-serif;
          font-size: 380px;
          line-height: 0.78;
          letter-spacing: -0.025em;
          color: transparent;
          -webkit-text-stroke: 2px rgba(245, 245, 240, 0.085);
          white-space: nowrap;
          z-index: 3;
          pointer-events: none;
          user-select: none;
        }

        .lp-composition {
          position: relative;
          z-index: 5;
          display: grid;
          grid-template-columns: 1fr 1.4fr 1fr;
          align-items: center;
          gap: 48px;
          padding: 120px 96px 160px;
          min-height: 1000px;
        }

        .lp-dossier {
          position: relative;
          background: rgba(5, 7, 8, 0.62);
          border: 1px solid var(--lp-hairline);
          backdrop-filter: blur(14px) saturate(120%);
          -webkit-backdrop-filter: blur(14px) saturate(120%);
          padding: 26px 28px 30px;
          border-radius: 4px;
          transform: rotate(-1.2deg);
        }
        .lp-dossier::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 24px;
          height: 24px;
          border-top: 1px solid var(--lp-green);
          border-right: 1px solid var(--lp-green);
        }
        .lp-dossier-flip { transform: rotate(1.2deg); }
        .lp-dossier-ref {
          font-family: var(--font-mono-jb), 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.32em;
          color: var(--lp-green);
          margin-bottom: 6px;
        }
        .lp-dossier-label {
          font-family: var(--font-anton), 'Anton', sans-serif;
          font-size: 18px;
          letter-spacing: 0.22em;
          color: var(--lp-ink);
          margin-bottom: 14px;
          line-height: 1;
        }
        .lp-dossier-value {
          font-family: var(--font-shoulders), 'Big Shoulders Display', sans-serif;
          font-weight: 900;
          font-size: 92px;
          line-height: 0.82;
          letter-spacing: -0.02em;
          color: var(--lp-ink);
          font-variant-numeric: tabular-nums;
        }
        .lp-dossier-unit {
          font-size: 22px;
          color: var(--lp-ink-mute);
          margin-left: 4px;
          letter-spacing: 0.02em;
        }
        .lp-dossier-accent { border-color: rgba(0, 223, 124, 0.4); }
        .lp-dossier-accent .lp-dossier-value { color: var(--lp-green); }
        .lp-dossier-accent::before { border-color: var(--lp-green); }
        .lp-dossier-sub {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px dashed var(--lp-hairline);
          font-family: var(--font-mono-jb), 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--lp-ink-mute);
          line-height: 1.55;
        }
        .lp-dossier-sub b { color: var(--lp-ink); font-weight: 500; }
        .lp-dossier-live {
          position: absolute;
          top: 12px;
          right: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono-jb), 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.24em;
          color: var(--lp-green);
        }
        .lp-dossier-live::before {
          content: '';
          width: 6px;
          height: 6px;
          background: var(--lp-green);
          border-radius: 50%;
          animation: lp-blink 1.4s ease-in-out infinite;
        }
        .lp-dossier-live-txt {
          position: relative;
          top: 1px;
        }
        @keyframes lp-blink { 50% { opacity: 0.35; } }

        .lp-hero {
          text-align: center;
          position: relative;
          z-index: 6;
        }
        .lp-h1 {
          font-family: var(--font-shoulders), 'Big Shoulders Display', sans-serif;
          font-weight: 900;
          font-size: clamp(96px, 11vw, 168px);
          line-height: 0.84;
          letter-spacing: -0.025em;
          color: var(--lp-ink);
          text-shadow: 0 8px 36px rgba(0, 0, 0, 0.6);
          margin: 0;
        }
        .lp-h1-row {
          display: block;
          position: relative;
        }
        .lp-h1-pop {
          display: inline-block;
          color: var(--lp-green);
          transform: rotate(-1.6deg);
          text-shadow: 0 8px 36px rgba(0, 223, 124, 0.22);
        }
        .lp-h1-strike {
          display: inline-block;
          position: relative;
          color: var(--lp-ink);
        }
        .lp-h1-strike::after {
          content: '';
          position: absolute;
          left: -6%;
          right: -6%;
          top: 54%;
          height: 6px;
          background: var(--lp-green);
          transform: rotate(-1.5deg);
          box-shadow: 0 0 18px rgba(0, 223, 124, 0.5);
        }

        .lp-tagline {
          margin-top: 32px;
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 400;
          font-size: 22px;
          line-height: 1.45;
          color: var(--lp-ink-mute);
          max-width: 44ch;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-tagline b { color: var(--lp-ink); font-weight: 600; }

        .lp-ticket-cta {
          margin-top: 42px;
          display: inline-flex;
          align-items: stretch;
          color: var(--lp-bg);
          cursor: pointer;
          border: none;
          text-decoration: none;
          font-family: inherit;
          position: relative;
          filter: drop-shadow(0 22px 40px rgba(0, 223, 124, 0.45));
          transition: filter 0.32s ease;
        }
        .lp-ticket-cta:hover {
          filter: drop-shadow(0 28px 56px rgba(0, 223, 124, 0.65));
        }
        .lp-cta-stub,
        .lp-cta-body {
          background: var(--lp-green);
          transition: transform 0.42s cubic-bezier(0.2, 0.7, 0.2, 1);
          will-change: transform;
        }
        .lp-cta-stub {
          position: relative;
          padding: 20px 22px;
          text-align: left;
          font-family: var(--font-mono-jb), 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          line-height: 1.6;
          color: rgba(8, 7, 13, 0.7);
          clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);
        }
        .lp-cta-stub b { color: var(--lp-bg); font-weight: 600; display: block; }
        /* perforation hint that sits on the stub's right edge */
        .lp-cta-stub::after {
          content: '';
          position: absolute;
          top: 10px;
          bottom: 10px;
          right: 0;
          border-right: 2px dashed rgba(8, 7, 13, 0.32);
        }
        .lp-cta-body {
          padding: 18px 36px 18px 28px;
          display: inline-flex;
          align-items: center;
          font-family: var(--font-anton), 'Anton', sans-serif;
          font-size: 36px;
          letter-spacing: 0.12em;
          line-height: 1;
          clip-path: polygon(
            0 0,
            100% 0,
            100% calc(100% - 14px),
            calc(100% - 14px) 100%,
            0 100%
          );
        }
        .lp-ticket-cta:hover .lp-cta-stub {
          transform: translateX(-8px) rotate(-0.6deg);
        }
        .lp-ticket-cta:hover .lp-cta-body {
          transform: translateX(8px) rotate(0.6deg);
        }

        .lp-ticker {
          position: relative;
          z-index: 10;
          border-top: 1px solid var(--lp-hairline);
          background: rgba(5, 7, 8, 0.6);
          padding: 16px 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .lp-ticker-track {
          display: inline-block;
          animation: lp-scroll 38s linear infinite;
          padding-left: 100%;
          font-family: var(--font-anton), 'Anton', sans-serif;
          font-size: 18px;
          letter-spacing: 0.16em;
          color: var(--lp-ink-mute);
        }
        .lp-ticker-it { margin-right: 56px; }
        .lp-ticker-it b { color: var(--lp-green); font-weight: 400; }
        .lp-ticker-head { color: var(--lp-green); }
        .lp-ticker-head::before {
          content: '';
          display: inline-block;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 5px 0 5px 8px;
          border-color: transparent transparent transparent currentColor;
          vertical-align: middle;
          margin-right: 10px;
          transform: translateY(-1px);
        }
        @keyframes lp-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }

        @keyframes lp-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-anim {
          opacity: 0;
          animation: lp-fadeUp 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .lp-anim-d1 { animation-delay: 0.08s; }
        .lp-anim-d2 { animation-delay: 0.18s; }
        .lp-anim-d3 { animation-delay: 0.28s; }
        .lp-anim-d4 { animation-delay: 0.38s; }
        .lp-anim-d5 { animation-delay: 0.5s; }
        .lp-anim-d6 { animation-delay: 0.65s; }
        .lp-anim-d7 { animation-delay: 0.85s; }
      `}</style>
    </main>
  );
}
