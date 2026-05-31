import { expect } from "chai";
import { ethers } from "hardhat";

const xi = (base = 1) =>
  [base, base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8, base+9, base+10] as
    [number,number,number,number,number,number,number,number,number,number,number];

async function deployFixture() {
  const [admin, oracle, alice, bob] = await ethers.getSigners();
  const Usdt = await ethers.getContractFactory("MockUSDT");
  const usdt = await Usdt.deploy();
  const AUsdt = await ethers.getContractFactory("MockAUsdt");
  const aUsdt = await AUsdt.deploy();
  const Aave = await ethers.getContractFactory("MockAavePool");
  const aave = await Aave.deploy(await usdt.getAddress(), await aUsdt.getAddress());

  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const lockTime = now + 1000;
  const endTime = lockTime + 100_000;

  // Factory cloning the OnzePool implementation.
  const Impl = await ethers.getContractFactory("OnzePool");
  const impl = await Impl.deploy();
  const FactoryC = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await FactoryC.deploy(
    await impl.getAddress(),
    await usdt.getAddress(),
    await aave.getAddress(),
    await aUsdt.getAddress(),
    oracle.address,
    admin.address,
  );
  await factory.createTournament(lockTime, endTime, 1_000_000n, "WC GROUP");
  const pool = await ethers.getContractAt("OnzePool", await factory.tournamentBy(0));

  await usdt.mint(admin.address, 100_000_000n);
  await usdt.mint(alice.address, 50_000_000n);
  await usdt.mint(bob.address, 50_000_000n);

  return { admin, oracle, alice, bob, usdt, aave, aUsdt, pool, lockTime, endTime };
}

describe("Pick5PoolFactory — cloning OnzePool", () => {
  it("clones an initialized OnzePool (factory/oracle/deposit wired)", async () => {
    const { oracle, pool } = await deployFixture();
    expect(await pool.deposit()).to.equal(1_000_000n);
    expect(await pool.oracle()).to.equal(oracle.address); // read through the factory
    expect(await pool.tournamentId()).to.equal(0n);
  });

  it("full lifecycle through the clone: seed → join XI+captain → submit → finalize → claim + withdraw", async () => {
    const { admin, oracle, alice, bob, usdt, aave, aUsdt, pool, endTime } = await deployFixture();

    await usdt.connect(admin).approve(await pool.getAddress(), 10_000_000n);
    await pool.connect(admin).seedPool(10_000_000n);

    await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
    await usdt.connect(bob).approve(await pool.getAddress(), 5_000_000n);
    await pool.connect(alice).joinTournament(xi(1), 1);
    await pool.connect(bob).joinTournament(xi(20), 20);

    // simulate yield
    await aUsdt.mint(await pool.getAddress(), 1_000_000n);
    await usdt.mint(await aave.getAddress(), 1_000_000n);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);
    await pool.connect(oracle).submitScores(
      [alice.address, bob.address], [42, 100], "0x" + "ab".repeat(32),
    );
    await pool.connect(alice).finalizeAndDistribute();

    expect(await pool.winner()).to.equal(bob.address);
    // 10 seed + 1 + 1 + 1 yield - 2 deposits = 11
    expect(await pool.prizeAmount()).to.equal(11_000_000n);

    const bobBefore = await usdt.balanceOf(bob.address);
    await pool.connect(bob).claimPrize();
    expect((await usdt.balanceOf(bob.address)) - bobBefore).to.equal(11_000_000n);

    const aliceBefore = await usdt.balanceOf(alice.address);
    await pool.connect(alice).withdrawDeposit();
    expect((await usdt.balanceOf(alice.address)) - aliceBefore).to.equal(1_000_000n);
  });
});
