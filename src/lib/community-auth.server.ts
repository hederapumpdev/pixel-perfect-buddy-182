import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { verifyMessage } from "viem";
import { MIRROR_URL } from "./hedera-config";
import { chatLoginMessage } from "./community";

export async function tokenHash(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export async function verifyChatLogin(data: { author: string; time: string; nonce: string; signature?: string; evmSignature?: string }) {
  if (!Number.isFinite(Date.parse(data.time)) || Math.abs(Date.now() - Date.parse(data.time)) > 300_000) throw new Error("Login expired. Try again.");
  const message = chatLoginMessage(data.author, data.time, data.nonce);
  let address = data.author.startsWith("0x") ? data.author : undefined;
  let key: { _type?: string; key?: string } | undefined;
  if (!address || data.signature) {
    const response = await fetch(`${MIRROR_URL}/api/v1/accounts/${data.author}`);
    if (!response.ok) throw new Error("Wallet not found on Hedera.");
    const account = await response.json() as { evm_address?: string; key?: typeof key };
    address = account.evm_address;
    key = account.key;
  }
  let ok = false;
  try {
    if (data.evmSignature && address) ok = await verifyMessage({ address: address as `0x${string}`, message, signature: data.evmSignature as `0x${string}` });
    else if (data.signature && key?.key) {
      const signed = new TextEncoder().encode(`\x19Hedera Signed Message:\n${message.length}${message}`);
      const sig = hexToBytes(data.signature);
      if (key._type === "ED25519") ok = ed25519.verify(sig, signed, hexToBytes(key.key));
      else if (key._type === "ECDSA_SECP256K1") ok = secp256k1.verify(sig, keccak_256(signed), hexToBytes(key.key), { prehash: false, lowS: false });
    }
  } catch { ok = false; }
  if (!ok) throw new Error("Wallet signature could not be verified.");
}