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

  // First V2 tournament window — adjust per edition before deploying.
  const lockTime = Math.floor(new Date("2026-08-15T11:30:00Z").getTime() / 1000);
  const endTime  = Math.floor(new Date("2026-08-23T19:00:00Z").getTime() / 1000);
  const label = process.env.TOURNAMENT_LABEL ?? "PL MW1-2";

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

  // 1) Pool implementation (no constructor args; clone target)
  console.log("\nDeploying Pick5Pool implementation...");
  const Impl = await ethers.getContractFactory("Pick5Pool");
  const impl = await Impl.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("Pick5Pool (impl):", implAddr);

  // 2) Factory
  console.log("\nDeploying Pick5PoolFactory...");
  const Factory = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await Factory.deploy(implAddr, usdt, aavePool, aUsdt, oracleAddr, coachAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("Pick5PoolFactory:", factoryAddr);

  // 3) First tournament
  console.log("\nCreating first tournament...");
  const tx = await factory.createTournament(lockTime, endTime, DEPOSIT, label);
  await tx.wait();
  const poolAddr = await factory.tournamentBy(0);
  console.log("Tournament #0 pool:", poolAddr);

  // 4) CoachAgent (per-competition; unchanged from V1)
  console.log("\nDeploying CoachAgent...");
  const Coach = await ethers.getContractFactory("CoachAgent");
  const coach = await Coach.deploy(coachAddr);
  await coach.waitForDeployment();
  const coachAddrDeployed = await coach.getAddress();
  console.log("CoachAgent:", coachAddrDeployed);

  console.log("\n=== Deployment summary ===");
  const suffix = isCelo ? "CELO" : testnetSuffix;
  console.log(`NEXT_PUBLIC_PICK5_FACTORY_${suffix}=${factoryAddr}`);
  console.log(`NEXT_PUBLIC_COACH_AGENT_${suffix}=${coachAddrDeployed}`);
  if (isTestnet) {
    console.log(`NEXT_PUBLIC_USDT_${testnetSuffix}=${usdt}`);
  }
  const verifyNet = isCelo ? "celo" : isAlfa ? "alfajores" : "celo-sepolia";
  console.log("\nNext steps (verify):");
  console.log(`  npx hardhat verify --network ${verifyNet} ${implAddr}`);
  console.log(`  npx hardhat verify --network ${verifyNet} ${factoryAddr} ${implAddr} ${usdt} ${aavePool} ${aUsdt} ${oracleAddr} ${coachAddr}`);
  console.log(`  npx hardhat verify --network ${verifyNet} ${coachAddrDeployed} ${coachAddr}`);
  console.log("\nNote: seed the tournament pool separately (owner calls seedPool on the clone).");
}

main().catch((e) => { console.error(e); process.exit(1); });
