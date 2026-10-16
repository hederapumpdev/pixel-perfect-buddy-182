import * as sdk from "@hiero-ledger/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deployWithHashPack, deployFingerprint, findDeployOnMirror, DEPLOY_CHUNK } from "@/lib/hashpack-deploy";

afterEach(() => vi.unstubAllGlobals());

const ED25519 = "016206cce27f19c21933357cdaa83790cf06f85ef850572055ad5e5d0fadfc6b";
// 9060 hex chars: one create + two appends at the 4096-byte network limit.
const BYTECODE = "ab".repeat(4530);

function stubAccountKey() {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ key: { _type: "ED25519", key: ED25519 } }),
  })));
}

function mockSigner(transactions: sdk.Transaction[]) {
  const getAccountKey = vi.fn(() => { throw new Error("Method not implemented."); });
  const signer = {
    getAccountKey,
    getAccountId: () => sdk.AccountId.fromString("0.0.1234"),
    getNetwork: () => ({ "node:50211": sdk.AccountId.fromString("0.0.3") }),
    populateTransaction: async (tx: sdk.Transaction) => tx.setTransactionId(sdk.TransactionId.generate("0.0.1234")),
    signTransaction: async (txs: sdk.Transaction[]) => txs,
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
  return { signer, getAccountKey };
}

const uploadedBytes = (txs: sdk.Transaction[]) => txs.flatMap(
  (tx) => tx instanceof sdk.FileCreateTransaction || tx instanceof sdk.FileAppendTransaction
    ? [...(tx.contents ?? [])] : [],
);

describe("HashPack contract deployment", () => {
  it("uploads chunks and creates a contract without calling getAccountKey", async () => {
    stubAccountKey();
    const transactions: sdk.Transaction[] = [];
    const { signer, getAccountKey } = mockSigner(transactions);
    const progress: string[] = [];
    const id = await deployWithHashPack(
      sdk, signer, "https://mirror.example",
      { bytecode: `0x${BYTECODE}`, constructorParams: "0x1234", gas: 4000000 },
      (p) => progress.push(`${p.phase} ${p.done}/${p.approvals}`),
    );
    expect(id).toBe("0.0.9999");
    expect(getAccountKey).not.toHaveBeenCalled();
    expect(transactions[0]).toBeInstanceOf(sdk.FileCreateTransaction);
    expect(transactions.filter((tx) => tx instanceof sdk.FileAppendTransaction)).toHaveLength(2);
    expect(new TextDecoder().decode(Uint8Array.from(uploadedBytes(transactions)))).toBe(BYTECODE);
    expect(transactions.at(-1)).toBeInstanceOf(sdk.ContractCreateTransaction);
    expect(progress).toEqual(["upload 1/4", "upload 2/4", "create 3/4", "done 4/4"]);
    const fp = deployFingerprint(BYTECODE);
    expect(transactions.map((tx) => tx.transactionMemo)).toEqual([
      `hpump:${fp}:0:4096`, `hpump:${fp}:4096:4096`, `hpump:${fp}:8192:868`, `hpump:${fp}:9060:0`,
    ]);
    const chunkSizes = transactions
      .filter((tx) => tx instanceof sdk.FileCreateTransaction || tx instanceof sdk.FileAppendTransaction)
      .map((tx) => (tx.contents ?? []).length);
    expect(chunkSizes).toEqual([DEPLOY_CHUNK, DEPLOY_CHUNK, BYTECODE.length - 2 * DEPLOY_CHUNK]);
  });

  it("continues an interrupted upload instead of paying for the same bytes twice", async () => {
    stubAccountKey();
    const transactions: sdk.Transaction[] = [];
    const { signer } = mockSigner(transactions);
    const id = await deployWithHashPack(
      sdk, signer, "https://mirror.example",
      { bytecode: `0x${BYTECODE}`, constructorParams: "0x1234", gas: 4000000, resume: { fileId: "0.0.5678", uploaded: DEPLOY_CHUNK } },
    );
    expect(id).toBe("0.0.9999");
    expect(transactions.some((tx) => tx instanceof sdk.FileCreateTransaction)).toBe(false);
    expect(transactions[0]).toBeInstanceOf(sdk.FileAppendTransaction);
    expect(new TextDecoder().decode(Uint8Array.from(uploadedBytes(transactions)))).toBe(BYTECODE.slice(DEPLOY_CHUNK));
  });

  it("starts a fresh upload when a resumed file has already expired", async () => {
    stubAccountKey();
    const transactions: sdk.Transaction[] = [];
    let failedOnce = false;
    const { signer } = mockSigner(transactions);
    const base = (signer as unknown as { call: (tx: sdk.Transaction) => Promise<unknown> }).call;
    (signer as unknown as { call: (tx: sdk.Transaction) => Promise<unknown> }).call = async (tx: sdk.Transaction) => {
      const out = await base(tx);
      if (!failedOnce && tx instanceof sdk.FileAppendTransaction) {
        failedOnce = true;
        return { getReceiptWithSigner: async () => ({ status: sdk.Status.InvalidFileId }) };
      }
      return out;
    };
    const id = await deployWithHashPack(
      sdk, signer, "https://mirror.example",
      { bytecode: `0x${BYTECODE}`, constructorParams: "0x1234", gas: 4000000, resume: { fileId: "0.0.5678", uploaded: DEPLOY_CHUNK } },
    );
    expect(id).toBe("0.0.9999");
    expect(transactions.filter((tx) => tx instanceof sdk.FileCreateTransaction)).toHaveLength(1);
    // The failed attempt is dropped; the fresh upload re-sends the whole contract.
    expect(new TextDecoder().decode(Uint8Array.from(uploadedBytes(transactions).slice(DEPLOY_CHUNK)))).toBe(BYTECODE);
  });

  it("rebuilds upload progress from the account's own Hedera history", async () => {
    const fp = deployFingerprint(BYTECODE);
    const memo = (m: string) => btoa(m);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ transactions: [
      { name: "FILEAPPEND", result: "SUCCESS", entity_id: "0.0.77", memo_base64: memo(`hpump:${fp}:4096:4096`), nonce: 0 },
      { name: "FILEAPPEND", result: "INSUFFICIENT_PAYER_BALANCE", entity_id: "0.0.77", memo_base64: memo(`hpump:${fp}:4096:4096`), nonce: 0 },
      { name: "FILECREATE", result: "SUCCESS", entity_id: "0.0.77", memo_base64: memo(`hpump:${fp}:0:4096`), nonce: 0 },
      { name: "FILECREATE", result: "SUCCESS", entity_id: "0.0.66", memo_base64: memo("hpump:00000000:0:4096"), nonce: 0 },
    ] }) })));
    expect(await findDeployOnMirror("https://mirror.example", "0.0.1234", BYTECODE))
      .toEqual({ state: { fileId: "0.0.77", uploaded: 8192 }, contractId: null });
  });

  it("rejects unsupported account keys before requesting a wallet signature", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ key: { _type: "ProtobufEncoded", key: "abcd" } }) })));
    const call = vi.fn();
    const signer = { getAccountId: () => "0.0.1234", call } as unknown as sdk.Signer;
    await expect(deployWithHashPack(sdk, signer, "https://mirror.example", { bytecode: "abcd", constructorParams: "0x", gas: 4000000 })).rejects.toThrow("single-key HashPack");
    expect(call).not.toHaveBeenCalled();
  });
});
