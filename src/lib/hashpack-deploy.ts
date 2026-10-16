import type { Key, Signer, Transaction, TransactionReceipt } from "@hiero-ledger/sdk";

type Sdk = typeof import("@hiero-ledger/sdk");

// WalletConnect's signer intentionally does not implement getAccountKey().
// Retrieve only the PUBLIC account key; all signatures remain in the wallet.
export async function deployWithHashPack(
  sdk: Sdk,
  signer: Signer,
  mirrorUrl: string,
  opts: { bytecode: string; constructorParams: `0x${string}`; gas: number },
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
  const chunkSize = 2048;
  const file = await submit(new sdk.FileCreateTransaction().setKeys([publicKey]).setContents(bytecode.slice(0, chunkSize)));
  if (!file.fileId) throw new Error("The contract upload did not return a file ID.");
  for (let offset = chunkSize; offset < bytecode.length; offset += chunkSize) {
    await submit(new sdk.FileAppendTransaction().setFileId(file.fileId).setContents(bytecode.slice(offset, offset + chunkSize)));
  }
  const params = Uint8Array.from((opts.constructorParams.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
  const receipt = await submit(new sdk.ContractCreateTransaction()
    .setBytecodeFileId(file.fileId).setGas(opts.gas).setConstructorParameters(params));
  if (!receipt.contractId) throw new Error("Deployment did not return a contract ID.");
  return receipt.contractId.toString();
}