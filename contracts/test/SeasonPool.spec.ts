import { expect } from "chai";
import { ethers } from "hardhat";

async function deploySeasonFixture() {
  const [admin, oracle, alice, bob, carol] = await ethers.getSigners();

  const Usdt = await ethers.getContractFactory("MockUSDT");
  const usdt = await Usdt.deploy();
  const AUsdt = await ethers.getContractFactory("MockAUsdt");
  const aUsdt = await AUsdt.deploy();
  const Aave = await ethers.getContractFactory("MockAavePool");
  const aave = await Aave.deploy(await usdt.getAddress(), await aUsdt.getAddress());

  const Impl = await ethers.getContractFactory("Pick5Pool");
  const impl = await Impl.deploy();
  const SeasonImpl = await ethers.getContractFactory("SeasonPool");
  const seasonImpl = await SeasonImpl.deploy();

  const FactoryC = await ethers.getContractFactory("Pick5PoolFactory");
  const factory = await FactoryC.deploy(
    await impl.getAddress(),
    await usdt.getAddress(),
    await aave.getAddress(),
    await aUsdt.getAddress(),
    oracle.address,
    admin.address, // coach (unused here)
  );
  await factory.setSeasonImplementation(await seasonImpl.getAddress());

  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const endTime = now + 100_000;
  await factory.createSeason(endTime, "Premier League 2026/27");
  const season = await ethers.getContractAt("SeasonPool", await factory.seasonBy(0));

  await usdt.mint(admin.address, 100_000_000n);

  return { admin, oracle, alice, bob, carol, usdt, aave, aUsdt, seasonImpl, factory, season, endTime };
}

async function warpTo(ts: number) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
  await ethers.provider.send("evm_mine", []);
}

describe("SeasonPool — initialize guard", () => {
  it("a created season cannot be re-initialized", async () => {
    const { season, factory, usdt, aave, aUsdt, admin, endTime } = await deploySeasonFixture();
    await expect(
      season.initialize(
        await factory.getAddress(), admin.address,
        await usdt.getAddress(), await aave.getAddress(), await aUsdt.getAddress(),
        endTime, 0, "X"
      )
    ).to.be.revertedWithCustomError(season, "InvalidInitialization");
  });

  it("the implementation itself cannot be initialized", async () => {
    const { seasonImpl, factory, usdt, aave, aUsdt, admin, endTime } = await deploySeasonFixture();
    await expect(
      seasonImpl.initialize(
        await factory.getAddress(), admin.address,
        await usdt.getAddress(), await aave.getAddress(), await aUsdt.getAddress(),
        endTime, 0, "X"
      )
    ).to.be.revertedWithCustomError(seasonImpl, "InvalidInitialization");
  });
});

describe("SeasonPool — seedPool", () => {
  it("owner seeds, USDT goes to Aave, aUSDT to the contract", async () => {
    const { admin, usdt, season, aave, aUsdt } = await deploySeasonFixture();
    const seed = 50_000_000n;
    await usdt.connect(admin).approve(await season.getAddress(), seed);
    await expect(season.connect(admin).seedPool(seed)).to.emit(season, "Seeded").withArgs(seed);
    expect(await season.seedAmount()).to.equal(seed);
    expect(await aUsdt.balanceOf(await season.getAddress())).to.equal(seed);
    expect(await usdt.balanceOf(await aave.getAddress())).to.equal(seed);
  });

  it("only owner can seed; rejects zero; rejects double-seed", async () => {
    const { admin, alice, usdt, season } = await deploySeasonFixture();
    await usdt.connect(admin).approve(await season.getAddress(), 50_000_000n);
    await expect(season.connect(alice).seedPool(1_000_000n))
      .to.be.revertedWithCustomError(season, "OwnableUnauthorizedAccount");
    await expect(season.connect(admin).seedPool(0))
      .to.be.revertedWithCustomError(season, "ZeroAmount");
    await season.connect(admin).seedPool(10_000_000n);
    await expect(season.connect(admin).seedPool(10_000_000n))
      .to.be.revertedWithCustomError(season, "AlreadySeeded");
  });
});

describe("SeasonPool — submitFinalStandings", () => {
  it("oracle submits aggregate standings, picks champion, stores scores", async () => {
    const { oracle, alice, bob, carol, season, endTime } = await deploySeasonFixture();
    await warpTo(endTime + 1);
    const seed = "0x" + "ab".repeat(32);
    await expect(
      season.connect(oracle).submitFinalStandings(
        [alice.address, bob.address, carol.address], [120, 300, 90], seed
      )
    ).to.emit(season, "FinalStandingsSubmitted").withArgs(bob.address, 300);

    expect(await season.standingsSubmitted()).to.equal(true);
    expect(await season.champion()).to.equal(bob.address);
    expect(await season.championScore()).to.equal(300n);
    expect(await season.scores(alice.address)).to.equal(120n);
    expect(await season.scores(carol.address)).to.equal(90n);
  });

  it("rejects non-oracle, before endTime, empty, mismatched lengths, double-submit", async () => {
    const { oracle, alice, bob, season, endTime } = await deploySeasonFixture();
    const seed = "0x" + "00".repeat(32);

    // before endTime
    await expect(season.connect(oracle).submitFinalStandings([alice.address], [1], seed))
      .to.be.revertedWithCustomError(season, "SeasonNotEnded");

    await warpTo(endTime + 1);

    // non-oracle
    await expect(season.connect(alice).submitFinalStandings([alice.address], [1], seed))
      .to.be.revertedWithCustomError(season, "NotOracle");
    // empty
    await expect(season.connect(oracle).submitFinalStandings([], [], seed))
      .to.be.revertedWithCustomError(season, "NoStandings");
    // mismatched
    await expect(season.connect(oracle).submitFinalStandings([alice.address], [1, 2], seed))
      .to.be.revertedWithCustomError(season, "LengthMismatch");
    // ok, then double-submit
    await season.connect(oracle).submitFinalStandings([alice.address, bob.address], [10, 20], seed);
    await expect(season.connect(oracle).submitFinalStandings([alice.address], [99], seed))
      .to.be.revertedWithCustomError(season, "AlreadySubmitted");
  });

  it("resolves a tie deterministically and emits TieBreak", async () => {
    const { oracle, alice, bob, season, endTime } = await deploySeasonFixture();
    await warpTo(endTime + 1);
    const seed = "0x" + "cd".repeat(32);
    await expect(
      season.connect(oracle).submitFinalStandings([alice.address, bob.address], [200, 200], seed)
    ).to.emit(season, "TieBreak");
    const champ = await season.champion();
    expect([alice.address, bob.address]).to.include(champ);
    expect(await season.championScore()).to.equal(200n);
  });
});

describe("SeasonPool — finalize + claim", () => {
  it("champion claims seed + yield; non-champion cannot; no double-claim/finalize", async () => {
    const { admin, oracle, alice, bob, usdt, aave, aUsdt, season, endTime } = await deploySeasonFixture();

    const seed = 50_000_000n; // 50 USDT
    await usdt.connect(admin).approve(await season.getAddress(), seed);
    await season.connect(admin).seedPool(seed);

    // simulate yield: 5 USDT
    await aUsdt.mint(await season.getAddress(), 5_000_000n);
    await usdt.mint(await aave.getAddress(), 5_000_000n);

    await warpTo(endTime + 1);
    await season.connect(oracle).submitFinalStandings(
      [alice.address, bob.address], [120, 300], "0x" + "ab".repeat(32)
    );

    await expect(season.connect(alice).finalize()).to.emit(season, "Finalized");
    // 50 seed + 5 yield, no deposits => prize = 55 USDT
    expect(await season.prizeAmount()).to.equal(55_000_000n);

    // non-champion cannot claim
    await expect(season.connect(alice).claimPrize())
      .to.be.revertedWithCustomError(season, "NotChampion");

    // champion (bob) claims
    const before = await usdt.balanceOf(bob.address);
    await season.connect(bob).claimPrize();
    expect((await usdt.balanceOf(bob.address)) - before).to.equal(55_000_000n);

    // no double-claim, no double-finalize
    await expect(season.connect(bob).claimPrize())
      .to.be.revertedWithCustomError(season, "AlreadyClaimed");
    await expect(season.connect(alice).finalize())
      .to.be.revertedWithCustomError(season, "AlreadyFinalized");
  });

  it("cannot finalize before standings, cannot claim before finalize", async () => {
    const { admin, bob, usdt, season } = await deploySeasonFixture();
    await usdt.connect(admin).approve(await season.getAddress(), 10_000_000n);
    await season.connect(admin).seedPool(10_000_000n);
    await expect(season.connect(bob).finalize())
      .to.be.revertedWithCustomError(season, "StandingsNotSubmitted");
    await expect(season.connect(bob).claimPrize())
      .to.be.revertedWithCustomError(season, "NotFinalized");
  });
});

describe("SeasonPool — emergencyAdminWithdraw", () => {
  it("owner recovers seed if oracle never submitted and delay elapsed", async () => {
    const { admin, usdt, season, endTime } = await deploySeasonFixture();
    await usdt.connect(admin).approve(await season.getAddress(), 30_000_000n);
    await season.connect(admin).seedPool(30_000_000n);

    await warpTo(endTime + 30 * 86400 + 1);
    const before = await usdt.balanceOf(admin.address);
    await expect(season.connect(admin).emergencyAdminWithdraw()).to.emit(season, "EmergencyWithdraw");
    expect((await usdt.balanceOf(admin.address)) - before).to.equal(30_000_000n);
  });

  it("rejects before the delay, after standings submitted, and from non-owner", async () => {
    const { admin, oracle, alice, bob, usdt, season, endTime } = await deploySeasonFixture();
    await usdt.connect(admin).approve(await season.getAddress(), 30_000_000n);
    await season.connect(admin).seedPool(30_000_000n);

    // too early
    await warpTo(endTime + 1);
    await expect(season.connect(admin).emergencyAdminWithdraw())
      .to.be.revertedWithCustomError(season, "TooEarly");

    // non-owner
    await expect(season.connect(alice).emergencyAdminWithdraw())
      .to.be.revertedWithCustomError(season, "OwnableUnauthorizedAccount");

    // after standings: blocked even past the delay
    await season.connect(oracle).submitFinalStandings([alice.address, bob.address], [1, 2], "0x" + "00".repeat(32));
    await warpTo(endTime + 30 * 86400 + 2);
    await expect(season.connect(admin).emergencyAdminWithdraw())
      .to.be.revertedWithCustomError(season, "AlreadySubmitted");
  });
});
