import { expect } from "chai";
import { ethers } from "hardhat";

// 11 distinct non-zero ids starting at `base`; captain defaults to the first.
const xi = (base = 1): [number,number,number,number,number,number,number,number,number,number,number] =>
  [base,base+1,base+2,base+3,base+4,base+5,base+6,base+7,base+8,base+9,base+10] as
    [number,number,number,number,number,number,number,number,number,number,number];

async function deploy() {
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
  const Impl = await ethers.getContractFactory("OnzePool");
  const impl = await Impl.deploy();
  const FactoryC = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await FactoryC.deploy(
    await impl.getAddress(),
    await usdt.getAddress(),
    await aave.getAddress(),
    await aUsdt.getAddress(),
    oracle.address,   // oracle (rotatable)
    admin.address,    // coach (unused by the pool; any address is fine for tests)
  );
  await factory.createTournament(lockTime, endTime, 1_000_000n, "TEST");
  const pool = await ethers.getContractAt("OnzePool", await factory.tournamentBy(0));

  await usdt.mint(admin.address, 100_000_000n);
  await usdt.mint(alice.address, 50_000_000n);
  await usdt.mint(bob.address, 50_000_000n);

  return { admin, oracle, alice, bob, usdt, aave, aUsdt, pool, lockTime, endTime };
}

describe("OnzePool — attack vectors", () => {
  describe("Access control", () => {
    it("rejects unauthorized seedPool caller", async () => {
      const { alice, usdt, pool } = await deploy();
      await usdt.connect(alice).approve(await pool.getAddress(), 100_000_000n);
      await expect(pool.connect(alice).seedPool(10_000_000n))
        .to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    });

    it("rejects unauthorized emergencyAdminWithdraw", async () => {
      const { alice, pool } = await deploy();
      await expect(pool.connect(alice).emergencyAdminWithdraw())
        .to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    });

    it("rejects submitScores from non-oracle", async () => {
      const { alice, pool, endTime } = await deploy();
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        pool.connect(alice).submitScores([alice.address], [1], "0x" + "00".repeat(32))
      ).to.be.revertedWithCustomError(pool, "NotOracle");
    });

    it("admin cannot call submitScores (oracle is separate from owner)", async () => {
      const { admin, pool, endTime } = await deploy();
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        pool.connect(admin).submitScores([], [], "0x" + "00".repeat(32))
      ).to.be.revertedWithCustomError(pool, "NotOracle");
    });

    it("oracle cannot seedPool (oracle is not owner)", async () => {
      const { oracle, usdt, pool } = await deploy();
      await usdt.mint(oracle.address, 100_000_000n);
      await usdt.connect(oracle).approve(await pool.getAddress(), 10_000_000n);
      await expect(pool.connect(oracle).seedPool(10_000_000n))
        .to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    });
  });

  describe("State integrity", () => {
    it("user cannot call claimPrize before being declared winner", async () => {
      const { admin, oracle, alice, bob, usdt, pool, endTime } = await deploy();
      await usdt.connect(admin).approve(await pool.getAddress(), 10_000_000n);
      await pool.connect(admin).seedPool(10_000_000n);
      await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
      await usdt.connect(bob).approve(await pool.getAddress(), 5_000_000n);
      await pool.connect(alice).joinTournament(xi(1), 1);
      await pool.connect(bob).joinTournament(xi(20), 20);
      // try to claim before submitScores or finalize
      await expect(pool.connect(alice).claimPrize())
        .to.be.revertedWithCustomError(pool, "ScoresNotSubmitted");
    });

    it("user cannot withdraw before scores are submitted", async () => {
      const { admin, alice, usdt, pool } = await deploy();
      await usdt.connect(admin).approve(await pool.getAddress(), 10_000_000n);
      await pool.connect(admin).seedPool(10_000_000n);
      await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
      await pool.connect(alice).joinTournament(xi(1), 1);
      await expect(pool.connect(alice).withdrawDeposit())
        .to.be.revertedWithCustomError(pool, "ScoresNotSubmitted");
    });

    it("admin cannot withdraw seed early when participants exist", async () => {
      const { admin, alice, usdt, pool, endTime } = await deploy();
      await usdt.connect(admin).approve(await pool.getAddress(), 10_000_000n);
      await pool.connect(admin).seedPool(10_000_000n);
      await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
      await pool.connect(alice).joinTournament(xi(1), 1);
      await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 7 * 86400 + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(pool.connect(admin).emergencyAdminWithdraw())
        .to.be.revertedWithCustomError(pool, "HasParticipants");
    });

    it("user cannot join after lockTime even if approved", async () => {
      const { alice, usdt, pool, lockTime } = await deploy();
      await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
      await ethers.provider.send("evm_setNextBlockTimestamp", [lockTime + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(pool.connect(alice).joinTournament(xi(1), 1))
        .to.be.revertedWithCustomError(pool, "TournamentLocked");
    });

    it("user cannot bypass lineup validation with all-same IDs", async () => {
      const { alice, usdt, pool } = await deploy();
      await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
      await expect(pool.connect(alice).joinTournament([7,7,7,7,7,7,7,7,7,7,7] as any, 7))
        .to.be.revertedWithCustomError(pool, "InvalidLineup");
    });

    it("accepts high player IDs (widened uint16 range)", async () => {
      const { alice, usdt, pool } = await deploy();
      await usdt.connect(alice).approve(await pool.getAddress(), 5_000_000n);
      await expect(pool.connect(alice).joinTournament([65535,1,2,3,4,5,6,7,8,9,10] as any, 65535))
        .to.emit(pool, "Joined");
    });
  });
});
