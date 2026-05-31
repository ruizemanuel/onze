import { describe, it, expect } from "vitest";
import { fechaStatus } from "../fechaStatus";

const base = { poolExists: true, lockTime: 1000, finalized: false, now: 500 };

describe("fechaStatus", () => {
  it("soon when the pool isn't created yet", () => {
    expect(fechaStatus({ ...base, poolExists: false })).toBe("soon");
  });
  it("joining before lockTime", () => {
    expect(fechaStatus({ ...base, now: 500 })).toBe("joining");
  });
  it("scoring once locked but not finalized", () => {
    expect(fechaStatus({ ...base, now: 1500 })).toBe("scoring");
  });
  it("settled when finalized (overrides time)", () => {
    expect(fechaStatus({ ...base, now: 1500, finalized: true })).toBe("settled");
  });
});
