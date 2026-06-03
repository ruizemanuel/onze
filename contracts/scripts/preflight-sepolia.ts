import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// READ-ONLY preflight for a Celo Sepolia deploy. Derives PUBLIC addresses from the
// env private keys (never prints the keys), reports which env vars are set, and
// checks the deployer's testnet balance + RPC reachability. No transactions.

function presence(v?: string): string {
  return v && v.length > 0 ? "SET" : "MISSING";
}

function addrOf(pk?: string): string {
  try {
    return pk ? new ethers.Wallet(pk).address : "(no key)";
  } catch {
    return "(invalid key)";
  }
}

async function main() {
  console.log("=== env presence (values NOT printed) ===");
  for (const k of [
    "DEPLOYER_PRIVATE_KEY",
    "ORACLE_PRIVATE_KEY",
    "COACH_PRIVATE_KEY",
    "ORACLE_ADDRESS",
    "COACH_ADDRESS",
    "CELOSCAN_API_KEY",
  ]) {
    console.log(`${k}: ${presence(process.env[k])}`);
  }

  console.log("\n=== derived public addresses (from the keys) ===");
  const deployerAddr = addrOf(process.env.DEPLOYER_PRIVATE_KEY);
  const oracleAddr = addrOf(process.env.ORACLE_PRIVATE_KEY);
  const coachAddr = addrOf(process.env.COACH_PRIVATE_KEY);
  console.log("deployer:", deployerAddr);
  console.log("oracle:  ", oracleAddr);
  console.log("coach:   ", coachAddr);
  console.log("\nORACLE_ADDRESS env:", process.env.ORACLE_ADDRESS ?? "(unset -> would derive oracle above)");
  console.log("COACH_ADDRESS  env:", process.env.COACH_ADDRESS ?? "(unset -> would derive coach above)");

  console.log("\n=== network (celo-sepolia) ===");
  try {
    const net = await ethers.provider.getNetwork();
    console.log("chainId:", net.chainId.toString(), net.chainId === 11142220n ? "(Celo Sepolia ✓)" : "(NOT Sepolia ✗)");
    const [signer] = await ethers.getSigners();
    console.log("hardhat signer:", signer.address, signer.address === deployerAddr ? "(== deployer ✓)" : "(MISMATCH ✗)");
    const bal = await ethers.provider.getBalance(signer.address);
    console.log("deployer CELO balance:", ethers.formatEther(bal));
    console.log(bal === 0n ? ">> NOT FUNDED — fund the deployer with Sepolia CELO from the faucet first." : ">> funded ✓");
  } catch (e) {
    console.log("NETWORK CHECK FAILED (sandbox egress or RPC):", (e as Error).message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
