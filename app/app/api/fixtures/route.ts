import { NextResponse } from "next/server";
import { getFifaRounds } from "@/lib/worldcup/client";
import { mapRounds } from "@/lib/fixtures/fixtures";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const rounds = mapRounds(await getFifaRounds(60));
    return NextResponse.json({ rounds });
  } catch (e) {
    console.error("fixtures endpoint failed", e);
    return NextResponse.json({ rounds: [] }, { status: 200 });
  }
}
