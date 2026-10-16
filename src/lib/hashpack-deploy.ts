import type { Key, Signer, Transaction, TransactionReceipt } from "@hiero-ledger/sdk";

type Sdk = typeof import("@hiero-ledger/sdk");

/** Where an interrupted upload left off, so a retry doesn't pay for the same bytes twice. */
export type DeployState = { fileId: string; uploaded: number };
export type DeployProgress = {
  fileId: string;
  uploaded: number;
  total: number;
  part: number;
  parts: number;
  phase: "upload" | "create";
  resumed: boolean;
};

// Hedera accepts at most 4096 bytes of file contents per transaction.
export const DEPLOY_CHUNK = 4096;

// WalletConnect's signer intentionally does not implement getAccountKey().
// Retrieve only the PUBLIC account key; all signatures remain in the wallet.
export async function deployWithHashPack(
  sdk: Sdk,
  signer: Signer,
  mirrorUrl: string,
  opts: { bytecode: string; constructorParams: `0x${string}`; gas: number; resume?: DeployState | null },
  onProgress?: (p: DeployProgress) => void,
): Promise<string> {
  const response = await fetch(`${mirrorUrl}/api/v1/accounts/${signer.getAccountId()}`);
  if (!response.ok) throw new Error("Couldn't read your wallet's public account key. Try again.");
  const account = await response.json() as { key?: { _type?: string; key?: string } };
  const key = account.key;
  let publicKey: Key;
  if (key?._type === "ED25519" && key.key) publicKey = sdk.PublicKey.fromStringED25519(key.key);
  else if (key?._type === "ECDSA_SECP256K1" && key.key) publicKey = sdk.PublicKey.fromStringECDSA(key.key);
  else throw new Error("Deployment requires a single-key HashPack account. This account's key type isn't supported.");

  const nodes = Object.values(signer.getNetwork()).slice(0, 1)
    .map((node) => typeof node === "string" ? sdk.AccountId.fromString(node) : node);
  if (!nodes.length) throw new Error("No Hedera network node is available. Reconnect HashPack.");
  async function submit(tx: Transaction): Promise<TransactionReceipt> {
    tx.setNodeAccountIds(nodes);
    await tx.freezeWithSigner(signer);
    const result = await tx.executeWithSigner(signer);
    const receipt = await result.getReceiptWithSigner(signer);
    if (receipt.status.toString() !== "SUCCESS") throw new Error(`Transaction failed: ${receipt.status}`);
    return receipt;
  }

  // Hedera bytecode files contain ASCII hex, not decoded EVM bytes.
  const bytecode = opts.bytecode.replace(/^0x/, "");
  if (!bytecode || bytecode.length % 2 || !/^[\da-f]+$/i.test(bytecode)) throw new Error("Invalid contract bytecode");
  const parts = Math.ceil(bytecode.length / DEPLOY_CHUNK);

  // Continue an earlier upload when it still describes this exact contract.
  let resume: DeployState | null = null;
  if (opts.resume?.fileId) {
    const uploaded = Math.min(Math.max(0, Math.floor(opts.resume.uploaded)), bytecode.length);
    try { resume = { fileId: sdk.FileId.fromString(opts.resume.fileId).toString(), uploaded }; } catch { resume = null; }
  }
  const resumed = !!resume;
  const report = (phase: "upload" | "create", s: DeployState | null) => onProgress?.({
    fileId: s?.fileId ?? "",
    uploaded: s?.uploaded ?? 0,
    total: bytecode.length,
    part: phase === "create" ? parts : Math.min(parts, Math.ceil((s?.uploaded ?? 0) / DEPLOY_CHUNK)),
    parts,
    phase,
    resumed,
  });

  async function upload(startFrom: DeployState | null): Promise<DeployState> {
    let s = startFrom;
    if (!s) {
      const first = bytecode.slice(0, DEPLOY_CHUNK);
      const file = await submit(new sdk.FileCreateTransaction().setKeys([publicKey]).setContents(first));
      if (!file.fileId) throw new Error("The contract upload did not return a file ID.");
      s = { fileId: file.fileId.toString(), uploaded: first.length };
      report("upload", s);
    }
    while (s.uploaded < bytecode.length) {
      const chunk = bytecode.slice(s.uploaded, s.uploaded + DEPLOY_CHUNK);
      await submit(new sdk.FileAppendTransaction().setFileId(sdk.FileId.fromString(s.fileId)).setContents(chunk));
      s = { fileId: s.fileId, uploaded: s.uploaded + chunk.length };
      report("upload", s);
    }
    return s;
  }

  let file: DeployState;
  try {
    file = await upload(resume);
  } catch (e) {
    // A resumed upload can point at a file that has since expired: start over once.
    const msg = e instanceof Error ? e.message : String(e);
    if (!resumed || !/INVALID_FILE_ID/i.test(msg)) throw e;
    file = await upload(null);
  }

  report("create", file);
  const params = Uint8Array.from((opts.constructorParams.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  const receipt = await submit(new sdk.ContractCreateTransaction()
    .setBytecodeFileId(sdk.FileId.fromString(file.fileId)).setGas(opts.gas).setConstructorParameters(params));
  if (!receipt.contractId) throw new Error("Deployment did not return a contract ID.");
  return receipt.contractId.toString();
}
