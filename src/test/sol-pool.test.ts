import { describe, expect, it } from "vitest";
import { encodeAddLiquidityETHNewPool, poolPlan, tinycentToTinybars } from "@/lib/sol-pool";

// Live values read from SaucerSwap's factory and Hedera's exchange rate on mainnet.
const FEE_TINYCENT = 500_000_000_000n; // pairCreateFee()
const CENT_EQUIV = 238270; // current_rate.cent_equivalent
const HBAR_EQUIV = 30_000; // current_rate.hbar_equivalent

describe("HBAR/SOL pool costs", () => {
  it("converts SaucerSwap's creation fee into the HBAR the router actually charges", () => {
    const fee = tinycentToTinybars(FEE_TINYCENT, CENT_EQUIV, HBAR_EQUIV);
    const hbar = Number(fee) / 1e8;
    // Verified live: a call with 629 HBAR reverts on MSG.VALUE, one with 631 HBAR gets past it.
    expect(hbar).toBeGreaterThan(629);
    expect(hbar).toBeLessThan(631);
  });

  it("refuses a fee conversion without a usable exchange rate", () => {
    expect(() => tinycentToTinybars(FEE_TINYCENT, 0, HBAR_EQUIV)).toThrow("No Hedera exchange rate");
  });

  it("charges the creation fee on top of the liquidity, never instead of it", () => {
    const fee = tinycentToTinybars(FEE_TINYCENT, CENT_EQUIV, HBAR_EQUIV);
    const plan = poolPlan({ sol: "1", hbarPerSol: 1310, feeTinybars: fee, hbarUsd: 0.0786 });
    const oneSolInTinybars = 1310n * 100_000_000n;
    expect(plan.hbarSideTinybars).toBe(oneSolInTinybars);
    expect(plan.totalTinybars).toBe(oneSolInTinybars + fee);
    expect(plan.hbarTotal).toBeCloseTo(Number((oneSolInTinybars + fee) / 100_000n) / 1e3, 3);
  });

  it("keeps a 3% slippage floor on both sides of the new pool", () => {
    const plan = poolPlan({ sol: "2", hbarPerSol: 1300, feeTinybars: 630n * 100_000_000n, hbarUsd: 0.08 });
    expect(plan.solUnits).toBe(200_000_000n);
    expect(plan.amountTokenMin).toBe((200_000_000n * 9700n) / 10_000n);
    expect(plan.amountETHMin).toBe((260_000_000_000n * 9700n) / 10_000n);
  });

  it("rejects a pool size that is not a positive number", () => {
    const fee = tinycentToTinybars(FEE_TINYCENT, CENT_EQUIV, HBAR_EQUIV);
    expect(() => poolPlan({ sol: "0", hbarPerSol: 1310, feeTinybars: fee, hbarUsd: 0.08 })).toThrow();
    expect(() => poolPlan({ sol: "abc", hbarPerSol: 1310, feeTinybars: fee, hbarUsd: 0.08 })).toThrow();
  });

  it("encodes the router call with SOL, both minimums and the LP recipient", () => {
    const plan = poolPlan({ sol: "1", hbarPerSol: 1310, feeTinybars: 630n * 100_000_000n, hbarUsd: 0.08 });
    const data = encodeAddLiquidityETHNewPool({
      solUnits: plan.solUnits,
      amountTokenMin: plan.amountTokenMin,
      amountETHMin: plan.amountETHMin,
      to: "0x0000000000000000000000000000000000a6b131",
    });
    expect(data.startsWith("0xf803710d")).toBe(true);
    expect(data).toContain("000000000000000000000000000000000000000000000000000000000a4e802"); // SOL
    expect(data).toContain("0000000000000000000000000000000000000000000000000000000000a6b131"); // LP to
    expect(data).toContain("000000000000000000000000000000000000000000000000000000000bebc200"); // 2 SOL units
  });
});
