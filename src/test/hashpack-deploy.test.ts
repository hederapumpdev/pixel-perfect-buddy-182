import * as sdk from "@hiero-ledger/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deployWithHashPack } from "@/lib/hashpack-deploy";

afterEach(() => vi.unstubAllGlobals());

describe("HashPack contract deployment", () => {
  it("uploads chunks and creates a contract without calling getAccountKey", async () => {
    const transactions: sdk.Transaction[] = [];
    const getAccountKey = vi.fn(() => { throw new Error("Method not implemented."); });
    const signer = {
      getAccountKey,
      getAccountId: () => sdk.AccountId.fromString("0.0.1234"),
      getNetwork: () => ({ "node:50211": sdk.AccountId.fromString("0.0.3") }),
      populateTransaction: async (tx: sdk.Transaction) => tx.setTransactionId(sdk.TransactionId.generate("0.0.1234")),
      call: async (tx: sdk.Transaction) => {
        transactions.push(tx);
        expect(tx.toBytes().length).toBeGreaterThan(0);
        return { getReceiptWithSigner: async () => ({
          status: sdk.Status.Success,
          fileId: sdk.FileId.fromString("0.0.5678"),
          contractId: tx instanceof sdk.ContractCreateTransaction ? sdk.ContractId.fromString("0.0.9999") : null,
        }) };
      },
    } as unknown as sdk.Signer;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
      key: { _type: "ED25519", key: "016206cce27f19c21933357cdaa83790cf06f85ef850572055ad5e5d0fadfc6b" },
    }) })));
    const bytecode = "ab".repeat(4530);
    const id = await deployWithHashPack(sdk, signer, "https://mirror.example", { bytecode: `0x${bytecode}`, constructorParams: "0x1234", gas: 4000000 });
    expect(id).toBe("0.0.9999");
    expect(getAccountKey).not.toHaveBeenCalled();
    expect(transactions[0]).toBeInstanceOf(sdk.FileCreateTransaction);
    expect(transactions.filter((tx) => tx instanceof sdk.FileAppendTransaction)).toHaveLength(4);
    const uploaded = transactions.flatMap((tx) => tx instanceof sdk.FileCreateTransaction || tx instanceof sdk.FileAppendTransaction ? [...(tx.contents ?? [])] : []);
    expect(new TextDecoder().decode(Uint8Array.from(uploaded))).toBe(bytecode);
    expect(transactions.at(-1)).toBeInstanceOf(sdk.ContractCreateTransaction);
  });

  it("rejects unsupported account keys before requesting a wallet signature", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ key: { _type: "ProtobufEncoded", key: "abcd" } }) })));
    const call = vi.fn();
    const signer = { getAccountId: () => "0.0.1234", call } as unknown as sdk.Signer;
    await expect(deployWithHashPack(sdk, signer, "https://mirror.example", { bytecode: "abcd", constructorParams: "0x", gas: 4000000 })).rejects.toThrow("single-key HashPack");
    expect(call).not.toHaveBeenCalled();
  });
});