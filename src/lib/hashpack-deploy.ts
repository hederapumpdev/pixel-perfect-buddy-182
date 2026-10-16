import type { Key, Signer, Transaction } from "@hiero-ledger/sdk";
import { WALLET_NODE_IDS } from "./hedera-config";

type Sdk = typeof import("@hiero-ledger/sdk");

/** How far a contract upload got: the Hedera file holding the bytecode and how many bytes it has. */
export type DeployState = { fileId: string; uploaded: number };
/** Approvals done / total, so the UI can say exactly which wallet approval comes next. */
export type DeployProgress = {
  fileId: string;
  uploaded: number;
  total: number;
  done: number;
  approvals: number;
  phase: "upload" | "create" | "done";
  contractId: string | null;
};

// Hedera accepts at most 4096 bytes of file contents per transaction.
export const DEPLOY_CHUNK = 4096;

const cleanBytecode = (bytecode: string) => {
  const bc = bytecode.replace(/^0x/, "");
  if (!bc || bc.length % 2 || !/^[\da-f]+$/i.test(bc)) throw new Error("Invalid contract bytecode");
  return bc;
};

/** Short stable ID of the contract code, written into every transaction memo. */
export function deployFingerprint(bytecode: string) {
  const bc = cleanBytecode(bytecode).toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < bc.length; i++) h = Math.imul(h ^ bc.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export function deployProgressOf(bytecode: string, state: DeployState | null, contractId: string | null = null): DeployProgress {
  const bc = cleanBytecode(bytecode);
  const parts = Math.ceil(bc.length / DEPLOY_CHUNK);
  const uploaded = Math.min(state?.uploaded ?? 0, bc.length);
  const done = contractId ? parts + 1 : Math.ceil(uploaded / DEPLOY_CHUNK);
  return {
    fileId: state?.fileId ?? "",
    uploaded,
    total: bc.length,
    done,
    approvals: parts + 1,
    phase: contractId ? "done" : uploaded >= bc.length ? "create" : "upload",
    contractId,
  };
}

const decodeMemo = (b64?: string | null) => {
  try { return b64 ? atob(b64) : ""; } catch { return ""; }
};

type MirrorTx = {
  name: string; result: string; entity_id?: string | null; memo_base64?: string | null;
  nonce?: number; consensus_timestamp: string;
};

/**
 * Rebuilds upload progress from this account's own transactions on Hedera, so a
 * reload, a lost wallet reply or another phone never makes us pay for the same bytes twice.
 */
export async function findDeployOnMirror(mirrorUrl: string, accountId: string, bytecode: string):
  Promise<{ state: DeployState | null; contractId: string | null }> {
  const fp = deployFingerprint(bytecode);
  const r = await fetch(`${mirrorUrl}/api/v1/transactions?account.id=${accountId}&limit=100&order=desc`);
  if (!r.ok) throw new Error("Couldn't read your wallet history from Hedera.");
  const txs = ((await r.json()) as { transactions?: MirrorTx[] }).transactions ?? [];
  let state: DeployState | null = null;
  let contractId: string | null = null;
  for (const t of [...txs].reverse()) {
    if (t.result !== "SUCCESS" || (t.nonce ?? 0) !== 0) continue;
    const m = decodeMemo(t.memo_base64).match(/^hpump:([\da-f]{8}):(\d+):(\d+)$/);
    if (!m || m[1] !== fp) continue;
    const offset = Number(m[2]);
    const len = Number(m[3]);
    if (t.name === "FILECREATE" && offset === 0 && t.entity_id) {
      state = { fileId: t.entity_id, uploaded: len };
      contractId = null;
    } else if (t.name === "FILEAPPEND" && state && t.entity_id === state.fileId && offset === state.uploaded) {
      state = { fileId: state.fileId, uploaded: state.uploaded + len };
    } else if (t.name === "CONTRACTCREATEINSTANCE" && state && t.entity_id) {
      contractId = t.entity_id;
    }
  }
  return { state, contractId };
}

const sleep = (ms: number, stop: { done: boolean }) =>
  new Promise<void>((res) => {
    const t = setTimeout(res, ms);
    if (stop.done) { clearTimeout(t); res(); }
  });

/**
 * Sends exactly ONE wallet request (one approval in HashPack) and returns the new progress.
 * The UI calls this once per tap, so every approval starts from a fresh user tap — mobile
 * wallets otherwise miss requests sent while the browser was in the background.
 */
export async function deployStep(
  sdk: Sdk,
  signer: Signer,
  mirrorUrl: string,
  opts: { bytecode: string; constructorParams: `0x${string}`; gas: number; resume?: DeployState | null; confirmTimeoutMs?: number },
): Promise<DeployProgress> {
  const bytecode = cleanBytecode(opts.bytecode);
  const fp = deployFingerprint(bytecode);

  // WalletConnect's signer intentionally does not implement getAccountKey().
  // Retrieve only the PUBLIC account key; all signatures remain in the wallet.
  const response = await fetch(`${mirrorUrl}/api/v1/accounts/${signer.getAccountId()}`);
  if (!response.ok) throw new Error("Couldn't read your wallet's public account key. Try again.");
  const account = await response.json() as { key?: { _type?: string; key?: string } };
  const key = account.key;
  let publicKey: Key;
  if (key?._type === "ED25519" && key.key) publicKey = sdk.PublicKey.fromStringED25519(key.key);
  else if (key?._type === "ECDSA_SECP256K1" && key.key) publicKey = sdk.PublicKey.fromStringECDSA(key.key);
  else throw new Error("Deployment requires a single-key HashPack account. This account's key type isn't supported.");

  // The WalletConnect signer's node list can contain nodes the wallet's own
  // client rejects (e.g. 0.0.17). Freeze against the SDK's full mainnet node
  // list instead; signing still happens in the wallet.
  const client = sdk.Client.forMainnet();
  // Same full node list as buy/sell: if one node is busy or unknown to HashPack, it tries the next.
  const nodes = WALLET_NODE_IDS.map((n) => sdk.AccountId.fromString(n)) as never[];

  /** Sends one transaction; trusts whichever answers first: the wallet's receipt or Hedera's public record. */
  async function submit(tx: Transaction, memo: string): Promise<string | null> {
    tx.setNodeAccountIds(nodes).setTransactionMemo(memo);
    tx.setTransactionId(sdk.TransactionId.generate(signer.getAccountId()));
    await tx.freezeWith(client);
    // No separate signWithSigner(): that was a SECOND wallet request per step, which
    // mobile HashPack misses after the first approval. executeWithSigner signs + sends in one.
    const txId = tx.transactionId?.toString() ?? "";
    const mirrorId = txId.replace("@", "-").replace(/\.(\d+)$/, "-$1");
    const stop = { done: false };
    const timeout = opts.confirmTimeoutMs ?? 180_000;

    const viaWallet = (async () => {
      let res;
      try {
        res = await tx.executeWithSigner(signer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // HashPack often sends the transaction but then fails reading the reply
        // (getByKey bug): let Hedera's public record decide.
        if (/getByKey|fromBytes/i.test(msg)) return new Promise<never>(() => {});
        if (/unhealthy|txError/i.test(msg))
          throw new Error("HashPack couldn't send this to Hedera. Nothing was charged — tap the button again.");
        throw e; // e.g. the user rejected it
      }
      try {
        const r = await res.getReceiptWithSigner(signer);
        return { status: r.status.toString(), entity: (r.contractId ?? r.fileId)?.toString() ?? null };
      } catch {
        return new Promise<never>(() => {}); // receipt lost: let Hedera's public record decide
      }
    })();
    const viaMirror = (async () => {
      const deadline = Date.now() + timeout;
      while (!stop.done && Date.now() < deadline) {
        await sleep(4000, stop);
        if (stop.done) break;
        try {
          const r = await fetch(`${mirrorUrl}/api/v1/transactions/${mirrorId}`);
          if (!r.ok) continue;
          const t = ((await r.json()) as { transactions?: MirrorTx[] }).transactions?.find((x) => (x.nonce ?? 0) === 0);
          if (t?.result) return { status: t.result, entity: t.entity_id ?? null };
        } catch { /* keep polling */ }
      }
      if (stop.done) return new Promise<never>(() => {});
      throw new Error("Hedera hasn't confirmed this step yet. Approve it in HashPack, then tap the button again.");
    })();

    try {
      const out = await Promise.race([viaWallet, viaMirror]);
      if (out.status !== "SUCCESS") throw new Error(`Transaction failed: ${out.status}`);
      return out.entity;
    } finally {
      stop.done = true;
    }
  }

  let state: DeployState | null = null;
  if (opts.resume?.fileId) {
    const uploaded = Math.min(Math.max(0, Math.floor(opts.resume.uploaded)), bytecode.length);
    try { state = { fileId: sdk.FileId.fromString(opts.resume.fileId).toString(), uploaded }; } catch { state = null; }
    if (state && state.uploaded <= 0) state = null;
  }

  if (!state) {
    const first = bytecode.slice(0, DEPLOY_CHUNK);
    const fileId = await submit(
      new sdk.FileCreateTransaction().setKeys([publicKey]).setContents(first),
      `hpump:${fp}:0:${first.length}`,
    );
    if (!fileId) throw new Error("The contract upload did not return a file ID.");
    return deployProgressOf(bytecode, { fileId, uploaded: first.length });
  }

  if (state.uploaded < bytecode.length) {
    const chunk = bytecode.slice(state.uploaded, state.uploaded + DEPLOY_CHUNK);
    try {
      await submit(
        new sdk.FileAppendTransaction().setFileId(sdk.FileId.fromString(state.fileId)).setContents(chunk),
        `hpump:${fp}:${state.uploaded}:${chunk.length}`,
      );
    } catch (e) {
      // The earlier file has expired or isn't ours: start a fresh upload on the next tap.
      if (/INVALID_FILE_ID|FILE_DELETED|INVALID_SIGNATURE/i.test(e instanceof Error ? e.message : String(e)))
        return deployProgressOf(bytecode, null);
      throw e;
    }
    return deployProgressOf(bytecode, { fileId: state.fileId, uploaded: state.uploaded + chunk.length });
  }

  const params = Uint8Array.from((opts.constructorParams.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  const contractId = await submit(
    new sdk.ContractCreateTransaction()
      .setBytecodeFileId(sdk.FileId.fromString(state.fileId)).setGas(opts.gas).setConstructorParameters(params),
    `hpump:${fp}:${bytecode.length}:0`,
  );
  if (!contractId) throw new Error("Deployment did not return a contract ID.");
  return deployProgressOf(bytecode, state, contractId);
}

/** Runs every step back to back (used by tests and scripts; the app goes one tap per step). */
export async function deployWithHashPack(
  sdk: Sdk,
  signer: Signer,
  mirrorUrl: string,
  opts: { bytecode: string; constructorParams: `0x${string}`; gas: number; resume?: DeployState | null },
  onProgress?: (p: DeployProgress) => void,
): Promise<string> {
  let resume = opts.resume ?? null;
  for (let i = 0; i < 64; i++) {
    const p = await deployStep(sdk, signer, mirrorUrl, { ...opts, resume });
    onProgress?.(p);
    if (p.contractId) return p.contractId;
    resume = p.fileId ? { fileId: p.fileId, uploaded: p.uploaded } : null;
  }
  throw new Error("Deployment did not finish.");
}
