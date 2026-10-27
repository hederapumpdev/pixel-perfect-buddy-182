import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import solc from "solc";
import { Common, Mainnet, Hardfork } from "@ethereumjs/common";
import { createVM } from "@ethereumjs/vm";
import { Account, createAddressFromString, hexToBytes } from "@ethereumjs/util";
import { bytesToHex, concatHex, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, type Abi } from "viem";

// Runs the real HederaPumpPool.sol on a local network against a mock of Hedera's token service,
// so the pool's accounting, entitlements and fee split are tested, NOT real Hedera execution.
const mocks = `pragma solidity ^0.8.24;
contract MockHTS {
  mapping(address => mapping(address => uint256)) public bal;
  mapping(address => mapping(address => mapping(address => uint256))) public all;
  function mint(address t, address a, uint256 v) external { bal[t][a] += v; }
  function balanceOf(address t, address a) external view returns (uint256) { return bal[t][a]; }
  function approve(address t, address s, uint256 v) external returns (int64) { all[t][msg.sender][s] = v; return 22; }
  function transferToken(address t, address f, address r, int64 a) external returns (int64) {
    uint v = uint(int256(a));
    if (bal[t][f] < v) return 10;
    bal[t][f] -= v; bal[t][r] += v; return 22;
  }
  function transferFrom(address t, address f, address r, uint256 v) external returns (int64) {
    if (all[t][f][msg.sender] < v) return 11;
    if (bal[t][f] < v) return 10;
    all[t][f][msg.sender] -= v; bal[t][f] -= v; bal[t][r] += v; return 22;
  }
}`;

type C = { abi: Abi; evm: { bytecode: { object: string }; deployedBytecode: { object: string } } };
let pool: C, mock: C;
beforeAll(() => {
  const r = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources: {
      "P.sol": { content: readFileSync("contracts/HederaPumpPool.sol", "utf8") },
      "M.sol": { content: mocks },
    },
    settings: { evmVersion: "cancun", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } } },
  })));
  const errs = (r.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errs.length) throw new Error(JSON.stringify(errs));
  pool = r.contracts["P.sol"].HederaPumpPool;
  mock = r.contracts["M.sol"].MockHTS;
}, 120_000);

// Hedera's token service lives at 0x167; the pool calls that address directly.
const HTS_ADDR = createAddressFromString("0x0000000000000000000000000000000000000167");
const TOKEN = "0x0000000000000000000000000000000000a6cb59";
const DEADLINE = 9_999_999_999n;
const user = createAddressFromString("0x0000000000000000000000000000000000100000");
const other = createAddressFromString("0x0000000000000000000000000000000000200000");
const feeWallet = createAddressFromString("0x0000000000000000000000000000000000300000");

async function setup(open = true) {
  const vm = await createVM({ common: new Common({ chain: Mainnet, hardfork: Hardfork.Cancun }) });
  await vm.stateManager.putAccount(HTS_ADDR, new Account(0n, 0n));
  await vm.stateManager.putCode(HTS_ADDR, hexToBytes(`0x${mock.evm.deployedBytecode.object}`));
  await vm.stateManager.putAccount(user, new Account(0n, 1_000_000_000n));
  await vm.stateManager.putAccount(other, new Account(0n, 1_000_000_000n));

  const deploy = await vm.evm.runCall({
    caller: user,
    gasLimit: 10_000_000n,
    data: hexToBytes(concatHex([`0x${pool.evm.bytecode.object}`, encodeAbiParameters([{ type: "address" }], [feeWallet.toString() as `0x${string}`])])),
  });
  if (!deploy.createdAddress) throw new Error("pool deploy failed");
  const p = deploy.createdAddress;

  const call = (to: typeof p, abi: Abi, fn: string, args: unknown[], value = 0n, caller = user) =>
    vm.evm.runCall({ caller, to, gasLimit: 5_000_000n, value, data: hexToBytes(encodeFunctionData({ abi, functionName: fn, args })) });
  const read = async (to: typeof p, abi: Abi, fn: string, args: unknown[] = []) => {
    const r = await call(to, abi, fn, args);
    return decodeFunctionResult({ abi, functionName: fn, data: bytesToHex(r.execResult.returnValue) }) as unknown;
  };
  const bal = async (a: typeof p) => (await vm.stateManager.getAccount(a))?.balance ?? 0n;
  const tokenOf = async (a: `0x${string}`) => (await read(HTS_ADDR, mock.abi, "balanceOf", [TOKEN, a])) as bigint;
  const reserves = async () => (await read(p, pool.abi, "reserves", [TOKEN])) as [bigint, bigint, bigint];
  const sharesOf = async (a: `0x${string}`) => (await read(p, pool.abi, "shares", [TOKEN, a])) as bigint;

  // Give the provider coins and the allowance the pool needs, then open the pool with
  // 10_000 HBAR and 40_000 coins: 20_000 shares, 19_000 to the provider, 1_000 locked forever.
  await call(HTS_ADDR, mock.abi, "mint", [TOKEN, user.toString(), 1_000_000n]);
  await call(HTS_ADDR, mock.abi, "approve", [TOKEN, p.toString(), 1_000_000n]);
  if (open) await call(p, pool.abi, "addLiquidity", [TOKEN, 40_000n, 0n, DEADLINE], 10_000n);

  return { p, call, read, bal, tokenOf, reserves, sharesOf };
}

describe("HederaPump Pools", () => {
  it("opens a pool from the first deposit and accounts for every coin and every tinybar", async () => {
    const r = await setup(false);
    await r.call(r.p, pool.abi, "addLiquidity", [TOKEN, 40_000n, 0n, DEADLINE], 10_000n);
    expect(await r.reserves()).toEqual([10_000n, 40_000n, 20_000n]);
    expect(await r.sharesOf(user.toString() as `0x${string}`)).toBe(19_000n);
    expect(await r.sharesOf(r.p.toString() as `0x${string}`)).toBe(1_000n);
    expect(await r.bal(r.p)).toBe(10_000n); // no HBAR inside the pool that the reserves do not know about
    expect(await r.tokenOf(r.p.toString() as `0x${string}`)).toBe(40_000n);
  });

  it("mints a second provider the same share of both sides, and nothing for an unbalanced deposit", async () => {
    const r = await setup();
    await r.call(HTS_ADDR, mock.abi, "mint", [TOKEN, other.toString(), 100_000n]);
    await r.call(HTS_ADDR, mock.abi, "approve", [TOKEN, r.p.toString(), 100_000n]);
    // 1_000 HBAR and 4_000 coins is exactly the pool's ratio, so it buys 10% of 19_000 shares.
    const ok = await r.call(r.p, pool.abi, "addLiquidity", [TOKEN, 4_000n, 1_900n, DEADLINE], 1_000n, other);
    expect(ok.execResult.exceptionError).toBeUndefined();
    expect(await r.sharesOf(other.toString() as `0x${string}`)).toBe(1_900n);
    // 1 coin plus 1_000 HBAR is badly balanced: the coin side only earns 0 shares, so minShares
    // of 1 must stop the whole deposit instead of quietly minting nothing.
    const bad = await r.call(r.p, pool.abi, "addLiquidity", [TOKEN, 1n, 1n, DEADLINE], 1_000n, other);
    expect(bad.execResult.exceptionError).toBeDefined();
    expect(await r.sharesOf(other.toString() as `0x${string}`)).toBe(1_900n);
    expect(await r.bal(r.p)).toBe(11_000n);
  });

  it("charges 1% on a buy, sends the platform part out and keeps the providers' part inside", async () => {
    const r = await setup();
    // gross = 40_000 * 1_000 / (10_000 + 1_000) = 3_636; fee 36; of that 9 for the providers,
    // 27 for the platform; the trader receives 3_600 coins.
    const q = (await r.read(r.p, pool.abi, "quoteBuy", [TOKEN, 1_000n])) as [bigint, bigint];
    expect(q).toEqual([3_600n, 36n]);
    const res = await r.call(r.p, pool.abi, "swapExactHbarForTokens", [TOKEN, 3_600n, DEADLINE], 1_000n);
    expect(res.execResult.exceptionError).toBeUndefined();
    expect(await r.tokenOf(user.toString() as `0x${string}`)).toBe(3_600n);
    expect(await r.bal(feeWallet)).toBe(27n);
    expect(await r.reserves()).toEqual([10_973n, 36_373n, 20_000n]);
    expect(await r.bal(r.p)).toBe(10_973n); // the pool still holds exactly what its reserves claim
  });

  it("pays HBAR out on a sell and keeps the accounts equal", async () => {
    const r = await setup();
    await r.call(HTS_ADDR, mock.abi, "approve", [TOKEN, r.p.toString(), 1_000_000n]);
    // gross = 10_000 * 4_000 / (40_000 + 4_000) = 909; fee 9; 2 for the providers, 7 for us.
    const q = (await r.read(r.p, pool.abi, "quoteSell", [TOKEN, 4_000n])) as [bigint, bigint];
    expect(q).toEqual([900n, 9n]);
    const res = await r.call(r.p, pool.abi, "swapExactTokensForHbar", [TOKEN, 4_000n, 900n, DEADLINE]);
    expect(res.execResult.exceptionError).toBeUndefined();
    expect(await r.bal(user)).toBe(1_000_000_000n - 10_000n + 900n);
    expect(await r.bal(feeWallet)).toBe(7n);
    expect(await r.reserves()).toEqual([9_093n, 44_000n, 20_000n]);
    expect(await r.bal(r.p)).toBe(9_093n);
  });

  it("reverts a trade under its slippage limit without taking a fee", async () => {
    const r = await setup();
    const res = await r.call(r.p, pool.abi, "swapExactHbarForTokens", [TOKEN, 10_000n, DEADLINE], 1_000n);
    expect(res.execResult.exceptionError).toBeDefined();
    expect(await r.bal(feeWallet)).toBe(0n);
    expect(await r.bal(r.p)).toBe(10_000n);
    expect(await r.reserves()).toEqual([10_000n, 40_000n, 20_000n]);
  });

  it("lets a provider take everything back, and only that provider", async () => {
    const r = await setup();
    const thief = await r.call(r.p, pool.abi, "removeLiquidity", [TOKEN, 19_000n, 0n, 0n, DEADLINE], 0n, other);
    expect(thief.execResult.exceptionError).toBeDefined();
    expect(await r.bal(r.p)).toBe(10_000n);

    const out = await r.call(r.p, pool.abi, "removeLiquidity", [TOKEN, 19_000n, 9_000n, 38_000n, DEADLINE]);
    expect(out.execResult.exceptionError).toBeUndefined();
    expect(await r.bal(user)).toBe(1_000_000_000n); // the 10_000 HBAR deposit is back, untouched
    expect(await r.tokenOf(user.toString() as `0x${string}`)).toBe(1_000_000n - 40_000n + 38_000n);
    // The 1_000 locked shares still own the rest, so the pool keeps its 5% and nothing more.
    expect(await r.reserves()).toEqual([500n, 2_000n, 1_000n]);
    expect(await r.bal(r.p)).toBe(500n);
  });

  it("keeps liquidity withdrawable while swaps are paused", async () => {
    const r = await setup();
    await r.call(r.p, pool.abi, "setPaused", [true]);
    const swap = await r.call(r.p, pool.abi, "swapExactHbarForTokens", [TOKEN, 0n, DEADLINE], 1_000n);
    expect(swap.execResult.exceptionError).toBeDefined();
    const add = await r.call(r.p, pool.abi, "addLiquidity", [TOKEN, 4_000n, 0n, DEADLINE], 1_000n);
    expect(add.execResult.exceptionError).toBeDefined();
    const exit = await r.call(r.p, pool.abi, "removeLiquidity", [TOKEN, 19_000n, 0n, 0n, DEADLINE]);
    expect(exit.execResult.exceptionError).toBeUndefined();
    expect(await r.bal(user)).toBeGreaterThan(1_000_000_000n);
  });

  it("cannot be used as a plain wallet, and the owner cannot raise the fee past the cap", async () => {
    const r = await setup();
    const stray = await r.call(r.p, pool.abi, "reserves", [TOKEN], 500n); // value with no matching call
    expect(stray.execResult.exceptionError).toBeDefined();
    expect(await r.bal(r.p)).toBe(10_000n);

    expect((await r.call(r.p, pool.abi, "setFees", [301n, 25n, feeWallet.toString()])).execResult.exceptionError).toBeDefined();
    expect((await r.call(r.p, pool.abi, "setFees", [100n, 101n, feeWallet.toString()])).execResult.exceptionError).toBeDefined();
    expect((await r.call(r.p, pool.abi, "setFees", [100n, 25n, feeWallet.toString()], 0n, other)).execResult.exceptionError).toBeDefined();
    expect(await r.read(r.p, pool.abi, "feeBps")).toBe(100n);
    expect((await r.call(r.p, pool.abi, "setFees", [200n, 50n, feeWallet.toString()])).execResult.exceptionError).toBeUndefined();
    expect(await r.read(r.p, pool.abi, "feeBps")).toBe(200n);
    expect(await r.read(r.p, pool.abi, "lpFeeBps")).toBe(50n);
  });
});
