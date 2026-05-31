import { expect } from "chai";
import { ethers } from "hardhat";

// 11 distinct non-zero ids starting at `base`; captain defaults to the first.
const xi = (base = 1): [number,number,number,number,number,number,number,number,number,number,number] =>
  [base,base+1,base+2,base+3,base+4,base+5,base+6,base+7,base+8,base+9,base+10] as
    [number,number,number,number,number,number,number,number,number,number,number];

describe("OnzePool — tie-breaking determinism", () => {
  it("picks one of the tied users when scores are equal", async () => {
    const [admin, oracle, alice, bob, charlie] = await ethers.getSigners();
    const Usdt = await ethers.getContractFactory("MockUSDT");
    const usdt = await Usdt.deploy();
    const AUsdt = await ethers.getContractFactory("MockAUsdt");
    const aUsdt = await AUsdt.deploy();
    const Aave = await ethers.getContractFactory("MockAavePool");
    const aave = await Aave.deploy(await usdt.getAddress(), await aUsdt.getAddress());

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const lockTime = now + 1000;
    const endTime = lockTime + 100_000;
    const Impl = await ethers.getContractFactory("OnzePool");
    const impl = await Impl.deploy();
    const FactoryC = await ethers.getContractFactory("Pick5PoolFactory");
    const factory = await FactoryC.deploy(
      await impl.getAddress(),
      await usdt.getAddress(),
      await aave.getAddress(),
      await aUsdt.getAddress(),
      oracle.address,   // oracle
      admin.address,    // coach (unused by the pool)
    );
    await factory.createTournament(lockTime, endTime, 1_000_000n, "TEST");
    const pool = await ethers.getContractAt("OnzePool", await factory.tournamentBy(0));

    for (const u of [alice, bob, charlie]) {
      await usdt.mint(u.address, 5_000_000n);
      await usdt.connect(u).approve(await pool.getAddress(), 5_000_000n);
    }
    await pool.connect(alice).joinTournament(xi(1), 1);
    await pool.connect(bob).joinTournament(xi(20), 20);
    await pool.connect(charlie).joinTournament(xi(40), 40);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);

    const seed = "0x" + "11".repeat(32);
    await expect(
      pool.connect(oracle).submitScores(
        [alice.address, bob.address, charlie.address],
        [50, 50, 50],
        seed
      )
    ).to.emit(pool, "TieBreak");

    const winner = await pool.winner();
    expect([alice.address, bob.address, charlie.address]).to.include(winner);
    expect(await pool.winningScore()).to.equal(50n);
  });
});
