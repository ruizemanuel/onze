import { expect } from "chai";
import { ethers } from "hardhat";

const DEPOSIT = 1_000_000n;

async function deployFactoryFixture() {
  const [admin, oracle, coach, alice, bob] = await ethers.getSigners();

  const Usdt = await ethers.getContractFactory("MockUSDT");
  const usdt = await Usdt.deploy();
  const AUsdt = await ethers.getContractFactory("MockAUsdt");
  const aUsdt = await AUsdt.deploy();
  const Aave = await ethers.getContractFactory("MockAavePool");
  const aave = await Aave.deploy(await usdt.getAddress(), await aUsdt.getAddress());

  const Impl = await ethers.getContractFactory("Pick5Pool");
  const impl = await Impl.deploy();

  const FactoryC = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await FactoryC.deploy(
    await impl.getAddress(),
    await usdt.getAddress(),
    await aave.getAddress(),
    await aUsdt.getAddress(),
    oracle.address,
    coach.address,
  );

  await usdt.mint(alice.address, 50_000_000n);
  await usdt.mint(bob.address, 50_000_000n);

  const base = (await ethers.provider.getBlock("latest"))!.timestamp;
  const lockTime = base + 1000;
  const endTime = lockTime + 100_000;

  return { admin, oracle, coach, alice, bob, usdt, aUsdt, aave, impl, factory, lockTime, endTime };
}

describe("Pick5PoolFactory — creation + registry", () => {
  it("createTournament clones a pool, initializes it, records it, emits the event", async () => {
    const { factory, oracle, admin, lockTime, endTime } = await deployFactoryFixture();
    await expect(factory.createTournament(lockTime, endTime, DEPOSIT, "PL MW39-40"))
      .to.emit(factory, "TournamentCreated");

    expect(await factory.tournamentsLength()).to.equal(1n);
    const poolAddr = await factory.tournamentBy(0);
    expect(poolAddr).to.not.equal(ethers.ZeroAddress);

    const pool = await ethers.getContractAt("Pick5Pool", poolAddr);
    expect(await pool.label()).to.equal("PL MW39-40");
    expect(await pool.deposit()).to.equal(DEPOSIT);
    expect(await pool.lockTime()).to.equal(BigInt(lockTime));
    expect(await pool.endTime()).to.equal(BigInt(endTime));
    expect(await pool.tournamentId()).to.equal(0n);
    expect(await pool.factory()).to.equal(await factory.getAddress());
    expect(await pool.owner()).to.equal(admin.address);
    expect(await pool.oracle()).to.equal(oracle.address);
  });

  it("only the owner can create tournaments", async () => {
    const { factory, alice, lockTime, endTime } = await deployFactoryFixture();
    await expect(
      factory.connect(alice).createTournament(lockTime, endTime, DEPOSIT, "X")
    ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
  });

  it("two tournaments coexist with independent state and addresses", async () => {
    const { factory, usdt, alice, bob, lockTime, endTime } = await deployFactoryFixture();
    await factory.createTournament(lockTime, endTime, DEPOSIT, "A");
    await factory.createTournament(lockTime, endTime, DEPOSIT, "B");
    expect(await factory.tournamentsLength()).to.equal(2n);

    const poolA = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(0));
    const poolB = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(1));
    expect(await poolA.getAddress()).to.not.equal(await poolB.getAddress());

    await usdt.connect(alice).approve(await poolA.getAddress(), DEPOSIT);
    await poolA.connect(alice).joinTournament([1, 2, 3, 4, 5]);
    await usdt.connect(bob).approve(await poolB.getAddress(), DEPOSIT);
    await poolB.connect(bob).joinTournament([6, 7, 8, 9, 10]);

    expect(await poolA.participantsLength()).to.equal(1n);
    expect(await poolB.participantsLength()).to.equal(1n);
    expect(await poolA.hasJoined(bob.address)).to.equal(false);
    expect(await poolB.hasJoined(alice.address)).to.equal(false);
  });
});

describe("Pick5PoolFactory — initialize guard", () => {
  it("a created pool cannot be re-initialized", async () => {
    const { factory, usdt, aave, aUsdt, admin, lockTime, endTime } = await deployFactoryFixture();
    await factory.createTournament(lockTime, endTime, DEPOSIT, "A");
    const pool = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(0));
    await expect(
      pool.initialize(
        await factory.getAddress(),
        admin.address,
        await usdt.getAddress(),
        await aave.getAddress(),
        await aUsdt.getAddress(),
        lockTime,
        endTime,
        DEPOSIT,
        0,
        "X"
      )
    ).to.be.revertedWithCustomError(pool, "InvalidInitialization");
  });

  it("the implementation itself cannot be initialized", async () => {
    const { impl, factory, usdt, aave, aUsdt, admin, lockTime, endTime } = await deployFactoryFixture();
    await expect(
      impl.initialize(
        await factory.getAddress(),
        admin.address,
        await usdt.getAddress(),
        await aave.getAddress(),
        await aUsdt.getAddress(),
        lockTime,
        endTime,
        DEPOSIT,
        0,
        "X"
      )
    ).to.be.revertedWithCustomError(impl, "InvalidInitialization");
  });
});

describe("Pick5PoolFactory — oracle rotation (B.1)", () => {
  it("setOracle changes which key can submit scores", async () => {
    const { factory, oracle, coach, usdt, alice, lockTime, endTime } = await deployFactoryFixture();
    const newOracle = coach;
    await factory.createTournament(lockTime, endTime, DEPOSIT, "A");
    const pool = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(0));

    await usdt.connect(alice).approve(await pool.getAddress(), DEPOSIT);
    await pool.connect(alice).joinTournament([1, 2, 3, 4, 5]);

    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(factory.setOracle(newOracle.address)).to.emit(factory, "OracleUpdated");
    expect(await pool.oracle()).to.equal(newOracle.address);

    await expect(
      pool.connect(oracle).submitScores([alice.address], [10], 1n)
    ).to.be.revertedWithCustomError(pool, "NotOracle");

    await expect(
      pool.connect(newOracle).submitScores([alice.address], [10], 1n)
    ).to.emit(pool, "ScoresSubmitted");
  });

  it("only the owner can rotate the oracle", async () => {
    const { factory, alice, bob } = await deployFactoryFixture();
    await expect(factory.connect(alice).setOracle(bob.address))
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
  });

  it("setOracle rejects the zero address", async () => {
    const { factory } = await deployFactoryFixture();
    await expect(factory.setOracle(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(factory, "ZeroAddress");
  });
});

describe("Pick5Pool — pause (D.5)", () => {
  it("owner can pause joins; unpausing re-enables them", async () => {
    const { factory, admin, usdt, alice, lockTime, endTime } = await deployFactoryFixture();
    await factory.createTournament(lockTime, endTime, DEPOSIT, "A");
    const pool = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(0));

    await pool.connect(admin).pause();
    await usdt.connect(alice).approve(await pool.getAddress(), DEPOSIT);
    await expect(pool.connect(alice).joinTournament([1, 2, 3, 4, 5]))
      .to.be.revertedWithCustomError(pool, "EnforcedPause");

    await pool.connect(admin).unpause();
    await expect(pool.connect(alice).joinTournament([1, 2, 3, 4, 5]))
      .to.emit(pool, "Joined");
  });

  it("only the owner can pause", async () => {
    const { factory, alice, lockTime, endTime } = await deployFactoryFixture();
    await factory.createTournament(lockTime, endTime, DEPOSIT, "A");
    const pool = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(0));
    await expect(pool.connect(alice).pause())
      .to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
  });

  it("widened IDs: a lineup with high uint16 ids joins successfully", async () => {
    const { factory, usdt, alice, lockTime, endTime } = await deployFactoryFixture();
    await factory.createTournament(lockTime, endTime, DEPOSIT, "A");
    const pool = await ethers.getContractAt("Pick5Pool", await factory.tournamentBy(0));
    await usdt.connect(alice).approve(await pool.getAddress(), DEPOSIT);
    await expect(pool.connect(alice).joinTournament([1000, 1248, 50000, 65535, 7]))
      .to.emit(pool, "Joined");
  });
});

describe("Pick5PoolFactory — createSeason + registry", () => {
  async function deployWithSeasonImpl() {
    const f = await deployFactoryFixture();
    const SeasonImpl = await ethers.getContractFactory("SeasonPool");
    const seasonImpl = await SeasonImpl.deploy();
    return { ...f, seasonImpl };
  }

  it("createSeason reverts until the season implementation is set", async () => {
    const { factory, endTime } = await deployWithSeasonImpl();
    await expect(factory.createSeason(endTime, "S0"))
      .to.be.revertedWithCustomError(factory, "ZeroAddress");
  });

  it("setSeasonImplementation rejects zero and is owner-only", async () => {
    const { factory, alice, seasonImpl } = await deployWithSeasonImpl();
    await expect(factory.setSeasonImplementation(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(factory, "ZeroAddress");
    await expect(factory.connect(alice).setSeasonImplementation(await seasonImpl.getAddress()))
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
  });

  it("createSeason clones + initializes a SeasonPool, records it, emits the event", async () => {
    const { factory, admin, oracle, seasonImpl, endTime } = await deployWithSeasonImpl();
    await factory.setSeasonImplementation(await seasonImpl.getAddress());
    await expect(factory.createSeason(endTime, "Premier League 2026/27"))
      .to.emit(factory, "SeasonCreated");

    expect(await factory.seasonsLength()).to.equal(1n);
    const seasonAddr = await factory.seasonBy(0);
    expect(seasonAddr).to.not.equal(ethers.ZeroAddress);

    const season = await ethers.getContractAt("SeasonPool", seasonAddr);
    expect(await season.label()).to.equal("Premier League 2026/27");
    expect(await season.endTime()).to.equal(BigInt(endTime));
    expect(await season.seasonId()).to.equal(0n);
    expect(await season.factory()).to.equal(await factory.getAddress());
    expect(await season.owner()).to.equal(admin.address);
    expect(await season.oracle()).to.equal(oracle.address);
  });

  it("only the owner can create seasons", async () => {
    const { factory, alice, seasonImpl, endTime } = await deployWithSeasonImpl();
    await factory.setSeasonImplementation(await seasonImpl.getAddress());
    await expect(factory.connect(alice).createSeason(endTime, "X"))
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
  });
});
