import { describe, expect, it } from "vitest";
import { encodeAddLiquidityETHNewPool, poolPlan, tinycentToTinybars } from "@/lib/sol-pool";

// Live values read from SaucerSwap's factory and Hedera's exchange rate on mainnet.
const FEE_TINYCENT = 500_000_000_000n; // pairCreateFee()
const CENT_EQUIV = 238270; // current_rate.cent_equivalent
const HBAR_EQUIV = 30_000; // current_rate.hbar_equivalent

const word = (v: bigint) => v.toString(16).padStart(64, "0");

describe("HBAR/SOL pool costs", () => {
  it("converts SaucerSwap's creation fee into the HBAR the router actually charges", () => {
    const hbar = Number(tinycentToTinybars(FEE_TINYCENT, CENT_EQUIV, HBAR_EQUIV)) / 1e8;
    // Verified live on mainnet: a call with 629 HBAR reverts on MSG.VALUE, one with 631 HBAR gets past it.
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
    expect(plan.hbarTotal).toBeCloseTo(1310 + Number(fee) / 1e8, 6);
    expect(plan.usd).toBeCloseTo((1310 + Number(fee) / 1e8) * 0.0786, 4);
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

  it("encodes the router call with SOL, both minimums and the LP recipient, in that order", () => {
    const plan = poolPlan({ sol: "1", hbarPerSol: 1310, feeTinybars: 630n * 100_000_000n, hbarUsd: 0.08 });
    const data = encodeAddLiquidityETHNewPool({
      solUnits: plan.solUnits,
      amountTokenMin: plan.amountTokenMin,
      amountETHMin: plan.amountETHMin,
      to: "0x0000000000000000000000000000000000a6b131",
    });
    const body = [
      word(0x0a4e802n), // SOL on Hedera
      word(plan.solUnits),
      word(plan.amountTokenMin),
      word(plan.amountETHMin),
      word(0x0a6b131n), // LP tokens go to this wallet
    ].join("");
    expect(data.slice(0, 10 + body.length)).toBe(`0xf803710d${body}`);
    // A deadline word closes the call; everything else is pinned above.
    expect(data.length).toBe(10 + body.length + 64);
  });
});
