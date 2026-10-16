import * as sdk from "@hiero-ledger/sdk";
import { encodeFunctionData, decodeEventLog, type Abi } from "viem";
import art from "/dev-server/src/lib/contract-artifact-hts.json";
const abi = art.pumpAbi as Abi;
const OP = "0.0.10993141";
const key = sdk.PrivateKey.fromStringECDSA(process.env.HEDERA_TESTNET_PRIVATE_KEY!.replace(/^0x/, ""));
const client = sdk.Client.forTestnet().setOperator(OP, key);
const OP_EVM = "0xa34faa81cc0e169e4eb60cbb3c96c5bde093e752";
const longZero = (id: string) => "0x" + BigInt(id.split(".")[2]).toString(16).padStart(40, "0");
const H = (n: number) => BigInt(Math.round(n * 1e8));
const log = (...a: unknown[]) => console.log(...a);

async function call(cid: sdk.ContractId, fn: string, args: unknown[], hbar = 0, gas = 1_500_000) {
  const data = encodeFunctionData({ abi, functionName: fn, args } as never);
  const tx = await new sdk.ContractExecuteTransaction().setContractId(cid).setGas(gas)
    .setPayableAmount(sdk.Hbar.fromTinybars(Number(H(hbar)))).setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .execute(client);
  const rec = await tx.getRecord(client).catch(async (e) => { log(fn, "FAILED", String(e)); throw e; });
  const evs = rec.contractFunctionResult!.logs.map((l) => {
    try { return decodeEventLog({ abi, data: ("0x" + Buffer.from(l.data).toString("hex")) as `0x${string}`, topics: l.topics.map((t) => "0x" + Buffer.from(t).toString("hex")) as never }); } catch { return null; }
  }).filter(Boolean);
  log(fn, "OK gasUsed", rec.contractFunctionResult!.gasUsed.toString(), "fee", rec.transactionFee.toString(), JSON.stringify(evs.map((e: any) => ({ n: e.eventName, a: e.args })), (_, v) => typeof v === "bigint" ? v.toString() : v));
  return { rec, evs };
}
async function view(cid: string, fn: string, args: unknown[]) {
  const data = encodeFunctionData({ abi, functionName: fn, args } as never);
  const r = await fetch("https://testnet.mirrornode.hedera.com/api/v1/contracts/call", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: cid, data }) });
  return (await r.json()).result;
}

const step = process.argv[2];
if (step === "deploy") {
  const ctor = encodeFunctionData({ abi: [{ type: "function", name: "x", inputs: (abi as any).find((x: any) => x.type === "constructor").inputs, outputs: [] }], functionName: "x", args: [OP_EVM, H(20), H(1), longZero("0.0.19264"), longZero("0.0.9959")] } as never).slice(10);
  const r = await new sdk.ContractCreateFlow().setBytecode(art.bytecode).setGas(4_000_000)
    .setConstructorParameters(Buffer.from(ctor, "hex")).setMaxAutomaticTokenAssociations(-1).execute(client);
  const rc = await r.getReceipt(client);
  log("CONTRACT", rc.contractId!.toString());
} else {
  const cid = sdk.ContractId.fromString(process.argv[3]);
  const caddr = longZero(process.argv[3]);
  if (step === "create") {
    const { evs } = await call(cid, "createToken", ["TestPump", "TPUMP", "{}", H(1)], 40, 1_500_000);
    log("TOKEN", (evs[0] as any)?.args?.token);
  }
  if (step === "buy") await call(cid, "buy", [process.argv[4], 0n], Number(process.argv[5]), Number(process.argv[6] ?? 1_000_000));
  if (step === "sell") {
    const tok = process.argv[4];
    const tid = sdk.TokenId.fromSolidityAddress(tok);
    await (await new sdk.AccountAllowanceApproveTransaction().approveTokenAllowance(tid, OP, sdk.AccountId.fromString(process.argv[3]), Number(H(1e9))).execute(client)).getReceipt(client);
    log("allowance ok");
    await call(cid, "sell", [tok, H(Number(process.argv[5])), 0n], 0, 1_000_000);
  }
  if (step === "migrate") await call(cid, "migrate", [process.argv[4]], 0, 6_000_000);
  if (step === "state") log(await view(caddr, "curves", [process.argv[4]]));
}
process.exit(0);
