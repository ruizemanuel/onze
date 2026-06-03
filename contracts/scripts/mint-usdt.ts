// Mint mock USDT (testnet only) so a wallet can join via the app.
// Set USDT_ADDRESS=0x... (the deployed MockUSDT) — falls back to NEXT_PUBLIC_USDT_SEPOLIA.
// Mints to the deployer by default; set MINT_TO=0x... to mint to another address.
//   USDT_ADDRESS=0x... cd contracts && pnpm exec hardhat run scripts/mint-usdt.ts --network celo-sepolia
import { ethers } from "hardhat";

const AMOUNT = 100_000_000n; // 100 USDT (6 decimals)

async function main() {
  const usdtAddr = process.env.USDT_ADDRESS ?? process.env.NEXT_PUBLIC_USDT_SEPOLIA;
  if (!usdtAddr) throw new Error("Set USDT_ADDRESS (the deployed MockUSDT address) in env");
  const [deployer] = await ethers.getSigners();
  const to = (process.env.MINT_TO ?? deployer.address) as string;
  const usdt = await ethers.getContractAt("MockUSDT", usdtAddr);
  await (await usdt.mint(to, AMOUNT)).wait();
  // retry the read (forno read-after-write lag)
  let bal = 0n;
  for (let i = 0; i < 8; i++) {
    bal = await usdt.balanceOf(to);
    if (bal >= AMOUNT) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`Minted ${ethers.formatUnits(AMOUNT, 6)} mock USDT to ${to}`);
  console.log(`Balance: ${ethers.formatUnits(bal, 6)} USDT`);
}

main().catch((e) => { console.error(e); process.exit(1); });
