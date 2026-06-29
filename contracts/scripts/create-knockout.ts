import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// Onze World Cup — create + seed the KNOCKOUT pool (tournament #1) on the EXISTING
// mainnet factory. Phase 7. The group pool was #0; this adds #1 (FIFA rounds 4-8).
// App wiring is already in place: seasons.ts tid 1 (rounds [4,5,6,7,8]) resolves via
// factory.tournamentBy(1) once this pool exists — no app code change needed.
//
//   pnpm -C contracts exec hardhat run scripts/create-knockout.ts --network celo
//
// Env overrides (all optional; defaults = the agreed KO window + 10 USDT seed):
//   KO_LOCK / KO_END  (unix seconds)   FACTORY_ADDRESS   KO_SEED (6-dec)   KO_LABEL

const FACTORY = process.env.FACTORY_ADDRESS ?? "0x920A592438582FB2Ee6522Bd769e2Ae2f798C9f6";
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
const ZERO = "0x0000000000000000000000000000000000000000";

const DEPOSIT = 1_000_000n; // 1 USDT join (mirrors the group pool)
const SEED = BigInt(process.env.KO_SEED ?? "10000000"); // 10 USDT (mirrors the group pool)

const LOCK = Number(
  process.env.KO_LOCK ?? Math.floor(new Date("2026-06-29T15:00:00Z").getTime() / 1000),
);
const END = Number(
  process.env.KO_END ?? Math.floor(new Date("2026-07-20T00:00:00Z").getTime() / 1000),
);
const LABEL = process.env.KO_LABEL ?? "WC Knockout";

// forno load-balances lagging nodes; a read right after a write can return zero.
async function retryNonZero(getter: () => Promise<string>, label: string): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const v = await getter();
    if (v && v !== ZERO) return v;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${label} still zero after retries (forno read lag?) — re-read before wiring`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 42220n) throw new Error(`expected Celo mainnet (42220), got ${net.chainId}`);

  console.log("Deployer:", deployer.address);
  console.log("Factory:", FACTORY);
  console.log("KO lock:", new Date(LOCK * 1000).toISOString());
  console.log("KO end: ", new Date(END * 1000).toISOString());
  console.log("Deposit:", Number(DEPOSIT) / 1e6, "USDT  |  Seed:", Number(SEED) / 1e6, "USDT");

  const factory = await ethers.getContractAt("Pick5PoolFactory", FACTORY);

  // Guard: never double-create tournament #1.
  const existing = (await factory.tournamentBy(1).catch(() => ZERO)) as string;
  if (existing && existing !== ZERO) {
    throw new Error(`tournamentBy(1) already exists: ${existing} — KO pool already created`);
  }

  // Sanity: deployer must hold enough USDT for the seed (+ gas in CELO).
  const usdt = new ethers.Contract(
    USDT,
    [
      "function approve(address,uint256) returns (bool)",
      "function balanceOf(address) view returns (uint256)",
    ],
    deployer,
  );
  const bal = (await usdt.balanceOf(deployer.address)) as bigint;
  console.log("Deployer USDT balance:", Number(bal) / 1e6);
  if (bal < SEED) throw new Error(`deployer USDT ${Number(bal) / 1e6} < seed ${Number(SEED) / 1e6}`);

  console.log("\nCreating knockout tournament (#1)...");
  await (await factory.createTournament(LOCK, END, DEPOSIT, LABEL)).wait();
  const koPool = await retryNonZero(() => factory.tournamentBy(1), "tournamentBy(1)");
  console.log("Knockout pool (#1):", koPool);

  console.log("\nApproving + seeding", Number(SEED) / 1e6, "USDT...");
  await (await usdt.approve(koPool, SEED)).wait();
  const pool = await ethers.getContractAt("OnzePool", koPool);
  await (await pool.seedPool(SEED)).wait();

  console.log("\n=== Done ===");
  console.log("Knockout pool #1:", koPool);
  console.log("Next: push cron.yml (KO crons), publish coach mw=4 before lock, verify /api/health.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
