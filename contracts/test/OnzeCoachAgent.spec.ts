import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

// 11 distinct non-zero ids starting at `base`.
const xi = (base = 1): [number,number,number,number,number,number,number,number,number,number,number] =>
  [base,base+1,base+2,base+3,base+4,base+5,base+6,base+7,base+8,base+9,base+10] as
    [number,number,number,number,number,number,number,number,number,number,number];

describe("OnzeCoachAgent", () => {
  async function deploy() {
    const [admin, coach, intruder] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("OnzeCoachAgent");
    const ca = await Factory.deploy(coach.address);
    return { admin, coach, intruder, ca };
  }

  it("constructor sets coachWallet", async () => {
    const { coach, ca } = await deploy();
    expect(await ca.coachWallet()).to.equal(coach.address);
  });

  it("constructor rejects zero coach", async () => {
    const Factory = await ethers.getContractFactory("OnzeCoachAgent");
    await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("zero coach");
  });

  it("publishCommitment by coach succeeds and emits", async () => {
    const { coach, ca } = await deploy();
    const hash = "0x" + "aa".repeat(32);
    await expect(ca.connect(coach).publishCommitment(37, hash))
      .to.emit(ca, "PicksCommitted").withArgs(37, hash, anyValue);
    expect(await ca.commitments(37)).to.equal(hash);
  });

  it("publishCommitment rejects non-coach", async () => {
    const { intruder, ca } = await deploy();
    await expect(ca.connect(intruder).publishCommitment(37, "0x" + "00".repeat(32)))
      .to.be.revertedWithCustomError(ca, "NotCoach");
  });

  it("publishCommitment rejects double-publish", async () => {
    const { coach, ca } = await deploy();
    await ca.connect(coach).publishCommitment(37, "0x" + "aa".repeat(32));
    await expect(ca.connect(coach).publishCommitment(37, "0x" + "bb".repeat(32)))
      .to.be.revertedWithCustomError(ca, "AlreadyCommitted");
  });

  it("revealPicks verifies hash and stores", async () => {
    const { coach, ca } = await deploy();
    const picks = xi(1);
    const accuracy = 80;
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint16[11]"], [picks]
    );
    const hash = ethers.keccak256(encoded);
    await ca.connect(coach).publishCommitment(37, hash);
    await expect(ca.connect(coach).revealPicks(37, picks, accuracy))
      .to.emit(ca, "PicksRevealed").withArgs(37, picks, accuracy);
    const stored = await ca.getRevealed(37);
    expect(stored.map((x) => Number(x))).to.deep.equal(xi(1));
    expect(await ca.accuracy(37)).to.equal(accuracy);
  });

  it("revealPicks rejects mismatched hash", async () => {
    const { coach, ca } = await deploy();
    const picks = xi(1);
    const wrong = "0x" + "00".repeat(32);
    await ca.connect(coach).publishCommitment(37, wrong);
    await expect(ca.connect(coach).revealPicks(37, picks, 80))
      .to.be.revertedWithCustomError(ca, "HashMismatch");
  });

  it("revealPicks rejects without prior commitment", async () => {
    const { coach, ca } = await deploy();
    const picks = xi(1);
    await expect(ca.connect(coach).revealPicks(38, picks, 80))
      .to.be.revertedWithCustomError(ca, "NotCommitted");
  });

  it("revealPicks rejects double-reveal", async () => {
    const { coach, ca } = await deploy();
    const picks = xi(1);
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["uint16[11]"], [picks]);
    const hash = ethers.keccak256(encoded);
    await ca.connect(coach).publishCommitment(37, hash);
    await ca.connect(coach).revealPicks(37, picks, 80);
    await expect(ca.connect(coach).revealPicks(37, picks, 80))
      .to.be.revertedWithCustomError(ca, "AlreadyRevealed");
  });

  it("revealPicks rejects accuracy > 100", async () => {
    const { coach, ca } = await deploy();
    const picks = xi(1);
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["uint16[11]"], [picks]);
    const hash = ethers.keccak256(encoded);
    await ca.connect(coach).publishCommitment(37, hash);
    await expect(ca.connect(coach).revealPicks(37, picks, 101))
      .to.be.revertedWithCustomError(ca, "InvalidAccuracy");
  });

  it("publishCommitment rejects non-coach with intruder", async () => {
    const { intruder, ca } = await deploy();
    await expect(ca.connect(intruder).publishCommitment(38, "0x" + "ff".repeat(32)))
      .to.be.revertedWithCustomError(ca, "NotCoach");
  });
});
