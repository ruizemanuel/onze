import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const ADDRESSES = {
  celo: {
    USDT:      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    AAVE_POOL: "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402",
    AUSDT:     "0xDeE98402A302e4D707fB9bf2bac66fAEEc31e8Df",
  },
};

// 1 USDT (6 decimals). Per-tournament deposit, passed to createTournament.
const DEPOSIT = 1_000_000n;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isHardhat = network.chainId === 31337n;
  const isCelo = network.chainId === 42220n || isHardhat; // hardhat forks Celo mainnet
  const isAlfa = network.chainId === 44787n;
  const isSepolia = network.chainId === 11142220n;
  const isTestnet = isAlfa || isSepolia;
  const testnetName = isAlfa ? "Alfajores" : isSepolia ? "Celo Sepolia" : "";
  const testnetSuffix = isAlfa ? "ALFAJORES" : isSepolia ? "SEPOLIA" : "";

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, network.chainId.toString());
  console.log("Balance (CELO):", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // First Onze tournament window — the World Cup GROUP STAGE. Adjust before deploying.
  const lockTime = Math.floor(new Date("2026-06-11T15:00:00Z").getTime() / 1000);
  const endTime  = Math.floor(new Date("2026-06-28T23:00:00Z").getTime() / 1000);
  const label = process.env.TOURNAMENT_LABEL ?? "WC Group Stage";

  // Season window — the whole World Cup. Adjust before deploying.
  const seasonEndTime = Math.floor(new Date("2026-07-20T03:00:00Z").getTime() / 1000);
  const seasonLabel = process.env.SEASON_LABEL ?? "World Cup 2026";

  let usdt: string, aavePool: string, aUsdt: string;

  if (isTestnet) {
    console.log(`\n[${testnetName}] Deploying mocks first...`);
    const Mock = await ethers.getContractFactory("MockUSDT");
    const mockUsdt = await Mock.deploy();
    await mockUsdt.waitForDeployment();
    const MockAU = await ethers.getContractFactory("MockAUsdt");
    const mockAU = await MockAU.deploy();
    await mockAU.waitForDeployment();
    const MockA = await ethers.getContractFactory("MockAavePool");
    const mockA = await MockA.deploy(await mockUsdt.getAddress(), await mockAU.getAddress());
    await mockA.waitForDeployment();
    usdt = await mockUsdt.getAddress();
    aavePool = await mockA.getAddress();
    aUsdt = await mockAU.getAddress();
    console.log("MockUSDT:", usdt);
    console.log("MockAavePool:", aavePool);
    console.log("MockAUsdt:", aUsdt);
  } else if (isCelo) {
    console.log("\n[Celo Mainnet] Using real Aave V3 + USDT...");
    usdt = ADDRESSES.celo.USDT;
    aavePool = ADDRESSES.celo.AAVE_POOL;
    aUsdt = ADDRESSES.celo.AUSDT;
  } else {
    throw new Error(`Unsupported network chainId: ${network.chainId}`);
  }

  const oracleAddr = process.env.ORACLE_ADDRESS;
  const coachAddr = process.env.COACH_ADDRESS;
  if (!oracleAddr || !coachAddr) {
    throw new Error("Set ORACLE_ADDRESS and COACH_ADDRESS in env");
  }

  console.log("\nOracle:", oracleAddr);
  console.log("Coach:", coachAddr);
  console.log("Label:", label);
  console.log("Lock time:", new Date(lockTime * 1000).toISOString());
  console.log("End time:", new Date(endTime * 1000).toISOString());

  // 1) OnzePool implementation (clone target)
  console.log("\nDeploying OnzePool implementation...");
  const Impl = await ethers.getContractFactory("OnzePool");
  const impl = await Impl.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("OnzePool (impl):", implAddr);

  // 2) Factory (pool-agnostic; cloning the OnzePool impl)
  console.log("\nDeploying Pick5PoolFactory (Onze)...");
  const Factory = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await Factory.deploy(implAddr, usdt, aavePool, aUsdt, oracleAddr, coachAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("Factory:", factoryAddr);

  // 3) First tournament (World Cup group stage)
  console.log("\nCreating first tournament (group stage)...");
  await (await factory.createTournament(lockTime, endTime, DEPOSIT, label)).wait();
  const poolAddr = await factory.tournamentBy(0);
  console.log("Tournament #0 pool:", poolAddr);

  // 3b) SeasonPool implementation + the World Cup season
  console.log("\nDeploying SeasonPool implementation...");
  const SeasonImpl = await ethers.getContractFactory("SeasonPool");
  const seasonImpl = await SeasonImpl.deploy();
  await seasonImpl.waitForDeployment();
  const seasonImplAddr = await seasonImpl.getAddress();
  console.log("SeasonPool (impl):", seasonImplAddr);

  await (await factory.setSeasonImplementation(seasonImplAddr)).wait();
  console.log("Factory.seasonImplementation set");

  console.log("\nCreating the World Cup season...");
  await (await factory.createSeason(seasonEndTime, seasonLabel)).wait();
  const seasonAddr = await factory.seasonBy(0);
  console.log("Season #0 pool:", seasonAddr);

  // 4) OnzeCoachAgent (NEW ERC-8004 identity; #9056 stays the Premier coach)
  console.log("\nDeploying OnzeCoachAgent...");
  const Coach = await ethers.getContractFactory("OnzeCoachAgent");
  const coach = await Coach.deploy(coachAddr);
  await coach.waitForDeployment();
  const coachAddrDeployed = await coach.getAddress();
  console.log("OnzeCoachAgent:", coachAddrDeployed);

  console.log("\n=== Deployment summary ===");
  const suffix = isCelo ? "CELO" : testnetSuffix;
  console.log(`NEXT_PUBLIC_PICK5_FACTORY_${suffix}=${factoryAddr}`);
  console.log(`NEXT_PUBLIC_COACH_AGENT_${suffix}=${coachAddrDeployed}`);
  console.log(`NEXT_PUBLIC_SEASON_POOL_${suffix}=${seasonAddr}`);
  if (isTestnet) {
    console.log(`NEXT_PUBLIC_USDT_${testnetSuffix}=${usdt}`);
  }
  const verifyNet = isCelo ? "celo" : isAlfa ? "alfajores" : "celo-sepolia";
  console.log("\nNext steps (verify):");
  console.log(`  npx hardhat verify --network ${verifyNet} ${implAddr}`);
  console.log(`  npx hardhat verify --network ${verifyNet} ${factoryAddr} ${implAddr} ${usdt} ${aavePool} ${aUsdt} ${oracleAddr} ${coachAddr}`);
  console.log(`  npx hardhat verify --network ${verifyNet} ${seasonImplAddr}`);
  console.log(`  npx hardhat verify --network ${verifyNet} ${coachAddrDeployed} ${coachAddr}`);
  console.log("\nNote: seed the group-stage pool AND the season pool separately (owner calls seedPool on each).");
  console.log("Note: knockout-stage pools are created later (one createTournament per phase as the WC progresses).");
}

main().catch((e) => { console.error(e); process.exit(1); });
