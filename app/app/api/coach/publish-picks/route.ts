import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { chainForNetwork } from "@/lib/contracts/chain";
import { privateKeyToAccount } from "viem/accounts";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { coachPicks } from "@/lib/db/schema";
import { FplScoreProvider } from "@/lib/scoring/fpl-provider";
import { generateCoachPicks } from "@/lib/ai/coach";
import { fallbackPicks } from "@/lib/ai/fallback";
import { onzeCoachAgentAbi } from "@/lib/contracts/abi";
import { PICKS_COUNT } from "@/lib/ai/coach";
import { coachAddress, DEFAULT_NETWORK } from "@/lib/contracts/addresses";
import { isConfiguredRound } from "@/lib/tournaments/seasons";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const mwStr = req.nextUrl.searchParams.get("mw");
  const mw = Number(mwStr);
  if (!Number.isInteger(mw) || !isConfiguredRound(mw)) {
    return NextResponse.json({ ok: false, reason: `mw ${mwStr} is not a configured season round` }, { status: 400 });
  }

  const db = getDb();

  // Skip if already published
  const existing = await db.select().from(coachPicks).where(eq(coachPicks.mw, mw));
  if (existing.length > 0) {
    return NextResponse.json({
      ok: true,
      reason: "already published",
      txHash: existing[0].publishTxHash,
    });
  }

  const players = await FplScoreProvider.getPlayers();

  let picks;
  try {
    picks = await generateCoachPicks(mw, players);
  } catch (e) {
    console.error("LLM failed, using fallback", e);
    picks = fallbackPicks(players);
  }

  const playerIds = picks.picks.map((p) => p.playerId);
  const reasoning = picks.picks.map((p) => p.reasoning);

  if (playerIds.length !== PICKS_COUNT) {
    return NextResponse.json({ ok: false, reason: `expected ${PICKS_COUNT} picks, got ${playerIds.length}` }, { status: 500 });
  }

  // commitment hash matches what the Solidity contract checks: keccak256(abi.encode(picks))
  // where picks is uint16[11]
  type Uint16x11 = readonly [number, number, number, number, number, number, number, number, number, number, number];
  const commitmentHash = keccak256(
    encodeAbiParameters(parseAbiParameters("uint16[11]"), [playerIds as unknown as Uint16x11])
  );

  const [inserted] = await db
    .insert(coachPicks)
    .values({
      mw,
      playerIds,
      reasoning,
      commitmentHash,
      publishedAt: new Date(),
    })
    .returning({ id: coachPicks.id });

  if (!process.env.COACH_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, reason: "COACH_PRIVATE_KEY not set" }, { status: 500 });
  }

  const network = DEFAULT_NETWORK;
  const chain = chainForNetwork(network);
  const account = privateKeyToAccount(process.env.COACH_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ chain, account, transport: http() });

  const coachAddr = coachAddress(network);
  if (coachAddr === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ ok: false, reason: `coach contract not configured for ${network}` }, { status: 500 });
  }

  try {
    const txHash = await walletClient.writeContract({
      address: coachAddr,
      abi: onzeCoachAgentAbi,
      functionName: "publishCommitment",
      args: [mw, commitmentHash],
    });

    await db.update(coachPicks).set({ publishTxHash: txHash }).where(eq(coachPicks.id, inserted.id));

    return NextResponse.json({
      ok: true,
      mw,
      txHash,
      commitmentHash,
      picks: picks.picks,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
