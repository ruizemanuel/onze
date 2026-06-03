// Full-system Onze smoke test on a real testnet (Celo Sepolia). Exercises the WHOLE
// money + score + season + coach flow against freshly deployed contracts:
//   - deploy mocks + OnzePool impl + factory(oracle=ORACLE, coach=COACH) + SeasonPool impl + OnzeCoachAgent
//   - OnzePool: seed, 2 participants join (11 + captain each), oracle submitScores (winner by max),
//     finalize, both withdraw deposits, winner claims prize
//   - SeasonPool: seed, oracle submitFinalStandings (champion by max), finalize, champion claims
//   - OnzeCoachAgent: coach publishCommitment + revealPicks(11) with hash check
// Uses the REAL oracle/coach keys (funded from the deployer) to validate role separation.
//
// All read-back assertions RETRY (okEq) because forno load-balances across independently
// syncing nodes, so a read right after a write can hit a node that hasn't seen the block yet.
// TESTNET ONLY.  cd contracts && pnpm exec hardhat run scripts/smoke-onze-cycle.ts --network celo-sepolia

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const DEPOSIT = 1_000_000n;        // 1 mock USDT
const SEED_POOL = 10_000_000n;     // 10 mock USDT (fecha prize)
const SEED_SEASON = 20_000_000n;   // 20 mock USDT (season prize)
const LOCK_OFFSET = 90;            // join window after deploys (s)
const END_OFFSET = 150;            // submit allowed after this (s)
const GAS_FUND = ethers.parseEther("0.1");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let passed = 0;

const norm = (v: unknown): string =>
  Array.isArray(v) ? JSON.stringify(v.map((x) => String(x)))
  : typeof v === "string" ? v.toLowerCase()
  : String(v);

// Retry the read until it matches (tolerates load-balanced-RPC read lag after a write).
async function okEq(getter: () => Promise<unknown>, expected: unknown, msg: string) {
  const exp = norm(expected);
  let last = "";
  for (let i = 0; i < 8; i++) {
    last = norm(await getter());
    if (last === exp) { passed++; console.log("  ✓ " + msg); return; }
    await sleep(2500);
  }
  throw new Error(`ASSERT FAILED: ${msg} (got ${last}, expected ${exp})`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 11142220n && net.chainId !== 44787n) {
    throw new Error(`smoke is testnet-only (got chainId ${net.chainId})`);
  }
  const oraclePk = process.env.ORACLE_PRIVATE_KEY;
  const coachPk = process.env.COACH_PRIVATE_KEY;
  if (!oraclePk || !coachPk) throw new Error("Set ORACLE_PRIVATE_KEY and COACH_PRIVATE_KEY in env");
  const oracle = new ethers.Wallet(oraclePk, ethers.provider);
  const coach = new ethers.Wallet(coachPk, ethers.provider);
  const p2 = ethers.Wallet.createRandom().connect(ethers.provider);

  const bal0 = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address, "| balance:", ethers.formatEther(bal0), "CELO");
  console.log("Oracle:", oracle.address, "| Coach:", coach.address, "| P2:", p2.address);

  console.log("\n[1/6] Deploying stack...");
  const mockUsdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  await mockUsdt.waitForDeployment();
  const mockAU = await (await ethers.getContractFactory("MockAUsdt")).deploy();
  await mockAU.waitForDeployment();
  const mockA = await (await ethers.getContractFactory("MockAavePool")).deploy(await mockUsdt.getAddress(), await mockAU.getAddress());
  await mockA.waitForDeployment();
  const usdt = await mockUsdt.getAddress();
  const impl = await (await ethers.getContractFactory("OnzePool")).deploy();
  await impl.waitForDeployment();
  const factory = await (await ethers.getContractFactory("Pick5PoolFactory")).deploy(
    await impl.getAddress(), usdt, await mockA.getAddress(), await mockAU.getAddress(), oracle.address, coach.address,
  );
  await factory.waitForDeployment();
  const seasonImpl = await (await ethers.getContractFactory("SeasonPool")).deploy();
  await seasonImpl.waitForDeployment();
  await (await factory.setSeasonImplementation(await seasonImpl.getAddress())).wait();
  const coachAgent = await (await ethers.getContractFactory("OnzeCoachAgent")).deploy(coach.address);
  await coachAgent.waitForDeployment();
  console.log("  factory:", await factory.getAddress(), "| coachAgent:", await coachAgent.getAddress());

  console.log("\n[2/6] Funding oracle / coach / p2 with gas...");
  for (const w of [oracle.address, coach.address, p2.address]) {
    await (await deployer.sendTransaction({ to: w, value: GAS_FUND })).wait();
  }

  const now = Math.floor(Date.now() / 1000);
  const lockTime = now + LOCK_OFFSET;
  const endTime = now + END_OFFSET;
  console.log(`\n[3/6] Creating tournament + season (lock=+${LOCK_OFFSET}s, end=+${END_OFFSET}s)...`);
  await (await factory.createTournament(lockTime, endTime, DEPOSIT, "SMOKE WC Group Stage")).wait();
  await (await factory.createSeason(endTime, "SMOKE World Cup 2026")).wait();
  const pool = await ethers.getContractAt("OnzePool", await factory.tournamentBy(0));
  const season = await ethers.getContractAt("SeasonPool", await factory.seasonBy(0));
  console.log("  pool:", await pool.getAddress(), "| season:", await season.getAddress());

  console.log("\n[4/6] Mint + seed + join (2 XIs)...");
  await (await mockUsdt.mint(deployer.address, SEED_POOL + SEED_SEASON + DEPOSIT)).wait();
  await (await mockUsdt.mint(p2.address, DEPOSIT)).wait();
  await (await mockUsdt.approve(await pool.getAddress(), SEED_POOL + DEPOSIT)).wait();
  await (await mockUsdt.approve(await season.getAddress(), SEED_SEASON)).wait();
  await (await pool.seedPool(SEED_POOL)).wait();
  await (await season.seedPool(SEED_SEASON)).wait();
  await okEq(() => pool.seedAmount(), SEED_POOL, "pool seedAmount stored");
  await okEq(() => season.seedAmount(), SEED_SEASON, "season seedAmount stored");

  const xi1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const xi2 = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  await (await pool.joinTournament(xi1, 5)).wait();
  await (await mockUsdt.connect(p2).approve(await pool.getAddress(), DEPOSIT)).wait();
  await (await pool.connect(p2).joinTournament(xi2, 25)).wait();
  await okEq(() => pool.captainOf(deployer.address), 5, "p1 captainOf = 5");
  await okEq(() => pool.captainOf(p2.address), 25, "p2 captainOf = 25");
  await okEq(() => pool.getLineup(p2.address), xi2, "p2 getLineup = 11 ids in order");
  await okEq(() => pool.participantsLength(), 2, "participantsLength = 2");

  console.log("\n[5/6] Coach commit + reveal (11 picks)...");
  const picks = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
  const hash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint16[11]"], [picks]));
  await (await coachAgent.connect(coach).publishCommitment(1, hash)).wait();
  await (await coachAgent.connect(coach).revealPicks(1, picks, 80)).wait();
  await okEq(() => coachAgent.hasRevealed(1), true, "coach reveal recorded");
  await okEq(() => coachAgent.getRevealed(1), picks, "coach revealed 11 picks match");
  await okEq(() => coachAgent.accuracy(1), 80, "coach accuracy = 80");

  console.log(`\n[6/6] Waiting until chain ts >= ${endTime}+3...`);
  for (;;) {
    const ts = Number((await ethers.provider.getBlock("latest"))!.timestamp);
    if (ts >= endTime + 3) break;
    console.log(`  chain ts=${ts} (need ${endTime})`);
    await sleep(8000);
  }

  console.log("Pool: oracle submitScores (p2 wins by max) + finalize + payouts...");
  await (await pool.connect(oracle).submitScores([deployer.address, p2.address], [30, 50], 777)).wait();
  await okEq(() => pool.winner(), p2.address, "pool winner = p2 (max score)");
  await okEq(() => pool.winningScore(), 50, "pool winningScore = 50");
  await (await pool.finalizeAndDistribute()).wait();
  await okEq(() => pool.prizeAmount(), SEED_POOL, "pool prize = seed (mock, no yield)");
  await (await pool.withdrawDeposit()).wait();
  await (await pool.connect(p2).withdrawDeposit()).wait();
  await (await pool.connect(p2).claimPrize()).wait();
  // p2 USDT: mint 1 - join 1 + deposit-back 1 + pool prize 10 = 11
  await okEq(() => mockUsdt.balanceOf(p2.address), DEPOSIT + SEED_POOL, "p2 balance = deposit-back + pool prize (11 USDT)");

  console.log("Season: oracle submitFinalStandings (p2 champion) + finalize + claim...");
  await (await season.connect(oracle).submitFinalStandings([deployer.address, p2.address], [30, 50], 777)).wait();
  await okEq(() => season.champion(), p2.address, "season champion = p2");
  await (await season.finalize()).wait();
  await okEq(() => season.prizeAmount(), SEED_SEASON, "season prize = seed");
  await (await season.connect(p2).claimPrize()).wait();
  // p2 USDT now: 11 + season prize 20 = 31
  await okEq(() => mockUsdt.balanceOf(p2.address), DEPOSIT + SEED_POOL + SEED_SEASON, "p2 balance = + season prize (31 USDT)");

  const balEnd = await ethers.provider.getBalance(deployer.address);
  console.log(`\n=== SMOKE PASSED (${passed} assertions) ===`);
  console.log("factory:", await factory.getAddress(), "| pool:", await pool.getAddress());
  console.log("season:", await season.getAddress(), "| coach:", await coachAgent.getAddress());
  console.log("deployer CELO spent:", ethers.formatEther(bal0 - balEnd));
}

main().catch((e) => {
  console.error("\n=== SMOKE FAILED ===");
  console.error(e);
  process.exit(1);
});
