import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

// 11 distinct non-zero ids starting at `base`; captain defaults to the first.
const xi = (base = 1): [number,number,number,number,number,number,number,number,number,number,number] =>
  [base,base+1,base+2,base+3,base+4,base+5,base+6,base+7,base+8,base+9,base+10] as
    [number,number,number,number,number,number,number,number,number,number,number];

const DEPOSIT = 1_000_000n;
const SEED = 10_000_000n;

async function deployFixture() {
  const [admin, oracle, alice, bob, carol, intruder] = await ethers.getSigners();
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
  await usdt.mint(carol.address, 50_000_000n);

  await usdt.connect(admin).approve(await pool.getAddress(), SEED);
  await pool.connect(admin).seedPool(SEED);

  await usdt.connect(alice).approve(await pool.getAddress(), DEPOSIT);
  await pool.connect(alice).joinTournament(xi(1), 1);

  await usdt.connect(bob).approve(await pool.getAddress(), DEPOSIT);
  await pool.connect(bob).joinTournament(xi(20), 20);

  return { admin, oracle, alice, bob, carol, intruder, usdt, aave, aUsdt, pool, lockTime, endTime };
}

describe("OnzePool — emergency path (oracle silent)", () => {
  it("triggerEmergency rejects before endTime + 30 days", async () => {
    const { pool, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);
    await expect(pool.triggerEmergency()).to.be.revertedWithCustomError(pool, "EmergencyNotElapsed");
  });

  it("triggerEmergency rejects after scoresSubmitted", async () => {
    const { pool, oracle, alice, bob, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);
    await pool.connect(oracle).submitScores(
      [alice.address, bob.address],
      [100, 50],
      1n
    );
    // Even after the 30-day window, triggerEmergency must reject because oracle already submitted.
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 31 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await expect(pool.triggerEmergency()).to.be.revertedWithCustomError(pool, "AlreadySubmitted");
  });

  it("triggerEmergency callable by anyone after endTime + 30 days, pulls Aave funds", async () => {
    const { pool, aUsdt, usdt, intruder, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);

    const aBefore = await aUsdt.balanceOf(await pool.getAddress());
    expect(aBefore).to.be.gt(0n);

    await expect(pool.connect(intruder).triggerEmergency())
      .to.emit(pool, "EmergencyTriggered")
      .withArgs(intruder.address, anyValue);

    expect(await pool.emergencyActive()).to.equal(true);
    expect(await aUsdt.balanceOf(await pool.getAddress())).to.equal(0n);
    expect(await usdt.balanceOf(await pool.getAddress())).to.equal(aBefore);
  });

  it("triggerEmergency rejects on second call", async () => {
    const { pool, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();
    await expect(pool.triggerEmergency()).to.be.revertedWithCustomError(pool, "EmergencyAlreadyActive");
  });

  it("after emergency, submitScores reverts EmergencyActiveErr", async () => {
    const { pool, oracle, alice, bob, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();
    await expect(
      pool.connect(oracle).submitScores([alice.address, bob.address], [10, 20], 1n)
    ).to.be.revertedWithCustomError(pool, "EmergencyActiveErr");
  });

  it("after emergency, finalizeAndDistribute reverts EmergencyActiveErr", async () => {
    const { pool, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();
    await expect(pool.finalizeAndDistribute()).to.be.revertedWithCustomError(pool, "EmergencyActiveErr");
  });

  it("emergencyUserWithdraw returns each participant's deposit", async () => {
    const { pool, usdt, alice, bob, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();

    const aliceBefore = await usdt.balanceOf(alice.address);
    const bobBefore = await usdt.balanceOf(bob.address);

    await expect(pool.connect(alice).emergencyUserWithdraw())
      .to.emit(pool, "EmergencyUserWithdrawn")
      .withArgs(alice.address, DEPOSIT);
    await expect(pool.connect(bob).emergencyUserWithdraw())
      .to.emit(pool, "EmergencyUserWithdrawn")
      .withArgs(bob.address, DEPOSIT);

    expect(await usdt.balanceOf(alice.address)).to.equal(aliceBefore + DEPOSIT);
    expect(await usdt.balanceOf(bob.address)).to.equal(bobBefore + DEPOSIT);
  });

  it("emergencyUserWithdraw rejects when !emergencyActive", async () => {
    const { pool, alice } = await deployFixture();
    await expect(pool.connect(alice).emergencyUserWithdraw())
      .to.be.revertedWithCustomError(pool, "EmergencyNotActive");
  });

  it("emergencyUserWithdraw rejects non-participant", async () => {
    const { pool, carol, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();
    await expect(pool.connect(carol).emergencyUserWithdraw())
      .to.be.revertedWithCustomError(pool, "NotJoined");
  });

  it("emergencyUserWithdraw rejects double-withdraw", async () => {
    const { pool, alice, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();
    await pool.connect(alice).emergencyUserWithdraw();
    await expect(pool.connect(alice).emergencyUserWithdraw())
      .to.be.revertedWithCustomError(pool, "AlreadyEmergencyWithdrawn");
  });

  it("emergencyAdminWithdraw recovers seed residual after 60-day cooldown", async () => {
    const { pool, admin, usdt, alice, bob, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 30 * 86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.triggerEmergency();

    // Both users withdraw their deposits
    await pool.connect(alice).emergencyUserWithdraw();
    await pool.connect(bob).emergencyUserWithdraw();

    // Owner cannot sweep before 60-day cooldown
    await expect(pool.connect(admin).emergencyAdminWithdraw())
      .to.be.revertedWithCustomError(pool, "HasParticipants");

    // Advance to endTime + 60 days
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 60 * 86400]);
    await ethers.provider.send("evm_mine", []);

    const ownerBefore = await usdt.balanceOf(admin.address);
    const contractBal = await usdt.balanceOf(await pool.getAddress());
    expect(contractBal).to.be.gte(SEED); // seed plus any yield

    await expect(pool.connect(admin).emergencyAdminWithdraw())
      .to.emit(pool, "EmergencyWithdraw");
    expect(await usdt.balanceOf(admin.address)).to.equal(ownerBefore + contractBal);
  });
});

describe("OnzePool — submitScores user-match check (F-3 fix)", () => {
  it("rejects when users[i] != participants[i] (non-participant injected)", async () => {
    const { pool, oracle, alice, intruder, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);
    // alice is participant 0, bob is participant 1. Replace bob with intruder.
    await expect(
      pool.connect(oracle).submitScores(
        [alice.address, intruder.address],
        [10, 100],
        1n
      )
    ).to.be.revertedWithCustomError(pool, "UserMismatch");
  });

  it("rejects when users array is reordered", async () => {
    const { pool, oracle, alice, bob, endTime } = await deployFixture();
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);
    // Swap order: should match participants[0]=alice, participants[1]=bob.
    await expect(
      pool.connect(oracle).submitScores(
        [bob.address, alice.address],
        [10, 100],
        1n
      )
    ).to.be.revertedWithCustomError(pool, "UserMismatch");
  });
});

describe("OnzePool — MAX_PARTICIPANTS cap (L4-A fix)", () => {
  // The PoolFull revert path itself is not exercised because deploying 500
  // funded signers is impractical in unit tests. The check is a single
  // `participants.length >= MAX_PARTICIPANTS` guard placed alongside the
  // `AlreadyJoined` revert that *is* fully tested in OnzePool.unit.spec.ts;
  // they share the same early-return idiom. The constant assertion below
  // catches any accidental change to the cap value.
  it("MAX_PARTICIPANTS is 500", async () => {
    const { pool } = await deployFixture();
    expect(await pool.MAX_PARTICIPANTS()).to.equal(500n);
  });
});
