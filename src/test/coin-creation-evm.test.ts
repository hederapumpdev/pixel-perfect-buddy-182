import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import solc from "solc";
import { Common, Mainnet, Hardfork } from "@ethereumjs/common";
import { createVM } from "@ethereumjs/vm";
import { Account, createAddressFromString, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { concatHex, decodeAbiParameters, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, toFunctionSelector, type Abi } from "viem";

// A strict legacy HTS stand-in tests ABI, funds and state, NOT real Hedera execution.
const stub = `pragma solidity ^0.8.24;
contract LegacyHTS {
 struct KeyValue { bool inheritAccountKey; address contractId; bytes ed25519; bytes ECDSA_secp256k1; address delegatableContractId; }
 struct TokenKey { uint256 keyType; KeyValue key; }
 struct Expiry { int64 second; address autoRenewAccount; int64 autoRenewPeriod; }
 struct HederaToken { string name; string symbol; address treasury; string memo; bool tokenSupplyType; int64 maxSupply; bool freezeDefault; TokenKey[] tokenKeys; Expiry expiry; }
 string public memo;
 function createFungibleToken(HederaToken memory t, int64 supply, int32 decimals) external payable returns(int64,address) {
  require(msg.sig == bytes4(0x0fb65bf3), "selector");
  require(t.treasury == msg.sender && t.expiry.autoRenewAccount == msg.sender, "treasury");
  require(t.tokenKeys.length == 0 && t.tokenSupplyType && !t.freezeDefault, "keys");
  require(supply == 100000000000000000 && t.maxSupply == supply && decimals == 8, "supply");
  require(t.expiry.autoRenewPeriod == 7776000 && t.expiry.second == 0, "expiry");
  memo = t.memo;
  (bool ok,) = payable(msg.sender).call{value: msg.value - 200000000}(""); require(ok, "refund");
  return (22, address(0x123456));
 }
 function transferToken(address,address,address,int64) external pure returns(int64) { return 22; }
}
`;
type Compiled = { abi: Abi; evm: { bytecode: { object: string }; deployedBytecode: { object: string } } };
let pump: Compiled;
let service: Compiled;
beforeAll(() => {
  const result = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources: {
    "Pump.sol": { content: readFileSync("contracts/HederaPumpV4.sol", "utf8") }, "Stub.sol": { content: stub },
  }, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "cancun", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } } } })));
  expect((result.errors ?? []).filter((e: { severity: string }) => e.severity === "error")).toEqual([]);
  pump = result.contracts["Pump.sol"].HederaPumpV4;
  service = result.contracts["Stub.sol"].LegacyHTS;
}, 60_000);

const caller = createAddressFromString("0x0000000000000000000000000000000000100000");
const feeWallet = "0x0000000000000000000000000000000000200000" as const;
const hts = createAddressFromString("0x0000000000000000000000000000000000000167");
async function setup() {
  const vm = await createVM({ common: new Common({ chain: Mainnet, hardfork: Hardfork.Cancun }) });
  await vm.stateManager.putAccount(caller, new Account(0n, 100_000_000_000n));
  await vm.stateManager.putAccount(hts, new Account());
  await vm.stateManager.putCode(hts, hexToBytes(`0x${service.evm.deployedBytecode.object}`));
  const params = encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "address" }],
    [feeWallet, 2_000_000_000_000n, 1_000_000_000n, feeWallet, feeWallet]);
  const deploy = await vm.evm.runCall({ caller, gasLimit: 10_000_000n, data: hexToBytes(concatHex([`0x${pump.evm.bytecode.object}`, params])) });
  expect(deploy.execResult.exceptionError).toBeUndefined();
  const address = deploy.createdAddress;
  if (!address) throw new Error("Deployment produced no address");
  const call = (name: string, args: unknown[] = [], value = 0n) => vm.evm.runCall({ caller, to: address, gasLimit: 5_000_000n, value,
    data: hexToBytes(encodeFunctionData({ abi: pump.abi, functionName: name, args })) });
  return { vm, address, call };
}

describe("legacy v4 creation in a local EVM", () => {
  it("matches the proven legacy HTS creation selector", () => {
    const abi = service.abi.find(entry => entry.type === "function" && entry.name === "createFungibleToken");
    if (!abi || abi.type !== "function") throw new Error("Missing creation ABI");
    expect(toFunctionSelector(abi)).toBe("0x0fb65bf3");
  });

  it("creates a fixed-supply coin, stores the information URL in its memo and refunds unused budget", async () => {
    const { vm, address, call } = await setup();
    const url = "https://hederapump.dev/api/public/token-meta/0x0000000000000000000000000000000000100000/0";
    const result = await call("createToken", ["HashCat", "HCAT", "{}", url, 0n], 1_500_000_000n);
    expect(result.execResult.exceptionError).toBeUndefined();
    expect(decodeAbiParameters([{ type: "address" }], bytesToHex(result.execResult.returnValue))[0].toLowerCase()).toBe("0x0000000000000000000000000000000000123456");
    const memo = await vm.evm.runCall({ caller, to: hts, data: hexToBytes(encodeFunctionData({ abi: service.abi, functionName: "memo" })) });
    expect(decodeFunctionResult({ abi: service.abi, functionName: "memo", data: bytesToHex(memo.execResult.returnValue) })).toBe(url);
    expect((await vm.stateManager.getAccount(address))?.balance).toBe(1_000_000_000n);
    expect((await vm.stateManager.getAccount(hts))?.balance).toBe(200_000_000n);
    expect((await vm.stateManager.getAccount(caller))?.balance).toBe(98_800_000_000n);
    const count = await call("tokenCount");
    expect(decodeFunctionResult({ abi: pump.abi, functionName: "tokenCount", data: bytesToHex(count.execResult.returnValue) })).toBe(1n);
  });

  it("accepts 100 UTF-8 bytes in the memo", async () => {
    const { call } = await setup();
    const result = await call("createToken", ["Boundary", "BOUND", "{}", "é".repeat(50), 0n], 1_500_000_000n);
    expect(result.execResult.exceptionError).toBeUndefined();
  });

  it("reserves 10% of the platform fee and shares new top-ups by attributed volume without erasing earnings", async () => {
    const { call } = await setup();
    await call("createToken", ["Referral", "REF", "{}", "", 0n], 1_500_000_000n);
    const token = "0x0000000000000000000000000000000000123456";
    const a = "0x0000000000000000000000000000000000300000";
    const b = "0x0000000000000000000000000000000000400000";
    const pending = async (referrer: string) => {
      const result = await call("pendingReferralFees", [referrer]);
      return decodeFunctionResult({ abi: pump.abi, functionName: "pendingReferralFees", data: bytesToHex(result.execResult.returnValue) });
    };
    const first = await call("buy", [token, 0n, a], 10_000_000_000n);
    expect(first.execResult.exceptionError).toBeUndefined();
    // 100 HBAR buy: 1 HBAR fee, 0.7 platform, 0.07 reserved for referrals.
    expect(await pending(a)).toBe(7_000_000n);
    const second = await call("buy", [token, 0n, b], 10_000_000_000n);
    expect(second.execResult.exceptionError).toBeUndefined();
    expect(await pending(a)).toBe(10_500_000n);
    expect(await pending(b)).toBe(3_500_000n);
    const third = await call("buy", [token, 0n, a], 10_000_000_000n);
    expect(third.execResult.exceptionError).toBeUndefined();
    // A now has twice B's volume; rounding can leave at most a few tinybars.
    const earnedA = await pending(a);
    const earnedB = await pending(b);
    expect(Number(earnedA)).toBeCloseTo(15_166_666, -1);
    expect(Number(earnedB)).toBeCloseTo(5_833_333, -1);
  });

  it("rejects a memo over 100 UTF-8 bytes before spending on HTS", async () => {
    const { vm, call } = await setup();
    const result = await call("createToken", ["Boundary", "BOUND", "{}", "é".repeat(50) + "a", 0n], 1_500_000_000n);
    expect(result.execResult.exceptionError?.error).toBe("revert");
    expect((await vm.stateManager.getAccount(hts))?.balance).toBe(0n);
  });
});