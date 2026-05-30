import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http } from "viem";
import { celo, celoAlfajores, celoSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { coachPicks } from "@/lib/db/schema";
import { FplScoreProvider } from "@/lib/scoring/fpl-provider";
import { coachAgentAbi } from "@/lib/contracts/abi";
import { coachAddress, DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { isConfiguredRound } from "@/lib/tournaments/seasons";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getChain(network: string) {
  if (network === "celo") return celo;
  if (network === "celo-sepolia") return celoSepolia;
  return celoAlfajores;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const mw = Number(req.nextUrl.searchParams.get("mw"));
  if (!Number.isInteger(mw) || !isConfiguredRound(mw)) {
    return NextResponse.json({ ok: false, reason: "invalid mw (not a configured season round)" }, { status: 400 });
  }

  const db = getDb();

  const settled = await FplScoreProvider.isRoundSettled(mw).catch(() => false);
  if (!settled) return NextResponse.json({ ok: false, reason: "not settled" });

  const rows = await db.select().from(coachPicks).where(eq(coachPicks.mw, mw));
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, reason: "no commitment for this mw" }, { status: 404 });
  }
  const row = rows[0];
  if (row.revealedAt) {
    return NextResponse.json({ ok: true, reason: "already revealed", txHash: row.revealTxHash });
  }

  // Fetch actual MW points via the provider (playerId -> points).
  const pointsByPlayer = await FplScoreProvider.getRoundPoints(mw);

  // Compute accuracy: coachPickPoints / sum(top5 actual points league-wide)
  const coachPickPoints = row.playerIds.reduce(
    (sum: number, pid: number) => sum + (pointsByPlayer.get(pid) ?? 0),
    0
  );
  const top5Pts = [...pointsByPlayer.values()]
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((sum, v) => sum + v, 0);
  const accuracy = Math.max(
    0,
    Math.min(100, Math.round((coachPickPoints / Math.max(top5Pts, 1)) * 100))
  );

  if (!process.env.COACH_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, reason: "COACH_PRIVATE_KEY not set" }, { status: 500 });
  }

  const network = DEFAULT_NETWORK;
  const chain = getChain(network);
  const account = privateKeyToAccount(process.env.COACH_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ chain, account, transport: http() });

  const coachAddr = coachAddress(network);
  if (coachAddr === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ ok: false, reason: `coach contract not configured for ${network}` }, { status: 500 });
  }

  // Cast playerIds to the tuple expected by the contract.
  // The publish-picks route enforces exactly 5 elements at insert time; the double cast is safe.
  const picksTuple = row.playerIds as unknown as readonly [number, number, number, number, number];

  try {
    const txHash = await walletClient.writeContract({
      address: coachAddr,
      abi: coachAgentAbi,
      functionName: "revealPicks",
      args: [mw, picksTuple, accuracy],
    });

    await db
      .update(coachPicks)
      .set({ revealedAt: new Date(), revealTxHash: txHash, accuracy })
      .where(eq(coachPicks.id, row.id));

    return NextResponse.json({ ok: true, mw, accuracy, txHash, coachPickPoints, top5Pts });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
