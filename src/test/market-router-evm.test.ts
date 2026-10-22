import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import solc from "solc";
import { Common, Mainnet, Hardfork } from "@ethereumjs/common";
import { createVM } from "@ethereumjs/vm";
import { Account, createAddressFromString, hexToBytes } from "@ethereumjs/util";
import { concatHex, encodeAbiParameters, encodeFunctionData, type Abi } from "viem";

// Mock SaucerSwap router + token: tests fee math, slippage and refunds, NOT real Hedera execution.
const mocks = `pragma solidity ^0.8.24;
contract Tok { mapping(address=>uint) public balanceOf; mapping(address=>mapping(address=>uint)) public allowance;
 function mint(address a,uint v) external { balanceOf[a]+=v; }
 function approve(address s,uint v) external returns(bool){ allowance[msg.sender][s]=v; return true; }
 function transfer(address t,uint v) external returns(bool){ balanceOf[msg.sender]-=v; balanceOf[t]+=v; return true; }
 function transferFrom(address f,address t,uint v) external returns(bool){ allowance[f][msg.sender]-=v; balanceOf[f]-=v; balanceOf[t]+=v; return true; } }
contract MockRouter { Tok public tok; constructor(Tok t){tok=t;}
 // 1 tinybar -> 10 token units; 10 token units -> 1 tinybar
 function swapExactETHForTokens(uint minOut,address[] calldata,address to,uint) external payable returns(uint[] memory a){
  uint out=msg.value*10; require(out>=minOut,"min"); tok.mint(to,out); a=new uint[](2); a[0]=msg.value; a[1]=out; }
 function swapExactTokensForETH(uint amt,uint,address[] calldata,address to,uint) external returns(uint[] memory a){
  tok.transferFrom(msg.sender,address(this),amt); uint out=amt/10; (bool ok,)=payable(to).call{value:out}(""); require(ok);
  a=new uint[](2); a[0]=amt; a[1]=out; }
 receive() external payable {} }`;

type C = { abi: Abi; evm: { bytecode: { object: string } } };
let router: C, tok: C, mock: C;
beforeAll(() => {
  const r = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources: {
    "R.sol": { content: readFileSync("contracts/HederaPumpRouter.sol", "utf8") }, "M.sol": { content: mocks } },
    settings: { evmVersion: "cancun", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } })));
  const errs = (r.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errs.length) throw new Error(JSON.stringify(errs));
  router = r.contracts["R.sol"].HederaPumpRouter; tok = r.contracts["M.sol"].Tok; mock = r.contracts["M.sol"].MockRouter;
}, 60_000);

const user = createAddressFromString("0x0000000000000000000000000000000000100000");
const fee = createAddressFromString("0x0000000000000000000000000000000000200000");
const whbar = "0x0000000000000000000000000000000000163b5a" as const;

async function setup() {
  const vm = await createVM({ common: new Common({ chain: Mainnet, hardfork: Hardfork.Cancun }) });
  await vm.stateManager.putAccount(user, new Account(0n, 10_000_000_000n));
  const deploy = async (c: C, args = "0x") => {
    const d = await vm.evm.runCall({ caller: user, gasLimit: 10_000_000n, data: hexToBytes(concatHex([`0x${c.evm.bytecode.object}`, args as `0x${string}`])) });
    if (!d.createdAddress) throw new Error("deploy failed");
    return d.createdAddress;
  };
  const t = await deploy(tok);
  const m = await deploy(mock, encodeAbiParameters([{ type: "address" }], [t.toString() as `0x${string}`]));
  { const acc = await vm.stateManager.getAccount(m); if (!acc) throw new Error("no mock"); acc.balance = 10_000_000_000n; await vm.stateManager.putAccount(m, acc); }
  const r = await deploy(router, encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }], [m.toString() as `0x${string}`, whbar, fee.toString() as `0x${string}`]));
  const call = (to: typeof r, abi: Abi, fn: string, args: unknown[], value = 0n) =>
    vm.evm.runCall({ caller: user, to, gasLimit: 5_000_000n, value, data: hexToBytes(encodeFunctionData({ abi, functionName: fn, args })) });
  const bal = async (a: typeof r) => (await vm.stateManager.getAccount(a))?.balance ?? 0n;
  return { t, r, call, bal };
}

describe("HederaPump Markets router", () => {
  it("takes exactly 1% of a buy and swaps the other 99%", async () => {
    const { r, call, bal } = await setup();
    const res = await call(r, router.abi, "buy", [whbar, 0n, 9_999_999_999n], 1_000_000_000n);
    expect(res.execResult.exceptionError).toBeUndefined();
    expect(await bal(fee)).toBe(10_000_000n);
    expect(await bal(r)).toBe(0n);
  });

  it("reverts a buy below the slippage limit and keeps no fee", async () => {
    const { r, call, bal } = await setup();
    const res = await call(r, router.abi, "buy", [whbar, 10_000_000_000n, 9_999_999_999n], 1_000_000_000n);
    expect(res.execResult.exceptionError).toBeDefined();
    expect(await bal(fee)).toBe(0n);
  });

  it("takes exactly 1% of the HBAR a sell returns", async () => {
    const { t, r, call, bal } = await setup();
    await call(r, router.abi, "buy", [whbar, 0n, 9_999_999_999n], 1_000_000_000n); // user gets 9.9e9 units, fee 1e7
    await call(t, tok.abi, "approve", [r.toString(), 1_000_000_000n]);
    const res = await call(r, router.abi, "sell", [t.toString(), 1_000_000_000n, 0n, 9_999_999_999n]);
    expect(res.execResult.exceptionError).toBeUndefined();
    expect(await bal(fee)).toBe(10_000_000n + 1_000_000n); // 1% of 100,000,000 tinybar
    expect(await bal(r)).toBe(0n);
  });

  it("never allows a fee above 1%", async () => {
    const { r, call } = await setup();
    const res = await call(r, router.abi, "setFee", [101, fee.toString()]);
    expect(res.execResult.exceptionError).toBeDefined();
  });
});
