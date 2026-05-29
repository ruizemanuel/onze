// Deploy a SHORT-LIFETIME instance for end-to-end dry-runs.
// lockTime = now + 10 min, endTime = now + 15 min
// USE ONLY ON TESTNET. The production deploy.ts uses real tournament dates.

import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const DEPOSIT = 1_000_000n;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  if (chainId !== 11142220n && chainId !== 44787n) {
    throw new Error(`deploy-test only supported on testnets (got chainId ${chainId})`);
  }

  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, chainId.toString());
  console.log("Balance (CELO):", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const now = Math.floor(Date.now() / 1000);
  const lockTime = now + 10 * 60; // 10 min from now
  const endTime  = now + 15 * 60; // 5 min after lock

  console.log("\nDeploying mocks...");
  const Mock = await ethers.getContractFactory("MockUSDT");
  const mockUsdt = await Mock.deploy();
  await mockUsdt.waitForDeployment();
  const MockAU = await ethers.getContractFactory("MockAUsdt");
  const mockAU = await MockAU.deploy();
  await mockAU.waitForDeployment();
  const MockA = await ethers.getContractFactory("MockAavePool");
  const mockA = await MockA.deploy(await mockUsdt.getAddress(), await mockAU.getAddress());
  await mockA.waitForDeployment();
  const usdt = await mockUsdt.getAddress();
  const aavePool = await mockA.getAddress();
  const aUsdt = await mockAU.getAddress();
  console.log("MockUSDT:", usdt);
  console.log("MockAavePool:", aavePool);
  console.log("MockAUsdt:", aUsdt);

  const oracleAddr = process.env.ORACLE_ADDRESS;
  const coachAddr = process.env.COACH_ADDRESS;
  if (!oracleAddr || !coachAddr) throw new Error("Set ORACLE_ADDRESS and COACH_ADDRESS in env");

  console.log("\nOracle:", oracleAddr, "Coach:", coachAddr);
  console.log("Lock time:", new Date(lockTime * 1000).toISOString());
  console.log("End time: ", new Date(endTime * 1000).toISOString());

  const Impl = await ethers.getContractFactory("Pick5Pool");
  const impl = await Impl.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("Pick5Pool (impl):", implAddr);

  const Factory = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await Factory.deploy(implAddr, usdt, aavePool, aUsdt, oracleAddr, coachAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("Pick5PoolFactory:", factoryAddr);

  const tx = await factory.createTournament(lockTime, endTime, DEPOSIT, "TEST DRY-RUN");
  await tx.wait();
  const poolAddr = await factory.tournamentBy(0);
  console.log("Tournament #0 pool:", poolAddr);

  const Coach = await ethers.getContractFactory("CoachAgent");
  const coach = await Coach.deploy(coachAddr);
  await coach.waitForDeployment();
  const coachAddrDeployed = await coach.getAddress();
  console.log("CoachAgent:", coachAddrDeployed);

  console.log("\n=== TEST DEPLOY SUMMARY ===");
  console.log(`NEXT_PUBLIC_PICK5_FACTORY_SEPOLIA=${factoryAddr}`);
  console.log(`NEXT_PUBLIC_COACH_AGENT_SEPOLIA=${coachAddrDeployed}`);
  console.log(`NEXT_PUBLIC_USDT_SEPOLIA=${usdt}`);
  console.log(`# tournament #0 pool=${poolAddr}`);
  console.log(`# lockTime=${lockTime} (${new Date(lockTime * 1000).toISOString()})`);
  console.log(`# endTime=${endTime}  (${new Date(endTime * 1000).toISOString()})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
