import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { MIRROR_URL } from "./hedera-config";

const TOKEN_HOURS = 12;
const MAX_SKEW_MS = 5 * 60_000;

const secret = () => {
  const pin = process.env["ADMIN_PIN"];
  if (!pin) throw new Error("Admin is not configured");
  return new TextEncoder().encode(`wallet-admin:${pin.trim()}`);
};
const mac = (body: string) => bytesToHex(hmac(sha256, secret(), new TextEncoder().encode(body)));

export function adminLoginMessage(accountId: string, time: string) {
  return `HederaPump admin login\nWallet: ${accountId}\nTime: ${time}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function adminStaff(db: any, accountId: string) {
  const { data } = await db.from("staff_members").select("wallet,account_id").eq("account_id", accountId)
    .eq("is_admin", true).is("left_at", null).maybeSingle();
  return data as { wallet: string; account_id: string } | null;
}

/** Accepts the owner PIN or a wallet-admin session; removed or demoted staff lose access immediately. */
export async function requireAdmin(pin: unknown) {
  const p = typeof pin === "string" ? pin.trim() : "";
  const real = process.env["ADMIN_PIN"];
  if (real && p && p === real.trim()) return;
  const m = /^w1\.(0\.0\.\d+)\.(\d+)\.([0-9a-f]{64})$/.exec(p);
  if (!m || Number(m[2]) < Date.now() || mac(`${m[1]}.${m[2]}`) !== m[3]) throw new Error("Wrong PIN");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!(await adminStaff(supabaseAdmin, m[1]))) throw new Error("Wrong PIN");
}

export async function isAdmin(pin: unknown) {
  try { await requireAdmin(pin); return true; } catch { return false; }
}

/** Verifies a wallet-signed login message against the account key on Hedera and returns a session. */
export async function walletAdminLogin(accountId: string, time: string, signatureHex: string, evmSignature?: string) {
  const t = Date.parse(time);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_SKEW_MS) throw new Error("Login expired, try again");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!(await adminStaff(supabaseAdmin, accountId))) throw new Error("This wallet has no admin access");
  const r = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}`);
  if (!r.ok) throw new Error("Wallet not found on Hedera");
  const acct = (await r.json()) as { key?: { _type?: string; key?: string }; evm_address?: string };
  const message = adminLoginMessage(accountId, time);
  let ok = false;
  if (evmSignature) {
    const { verifyMessage } = await import("viem");
    if (acct.evm_address) ok = await verifyMessage({ address: acct.evm_address as `0x${string}`, message, signature: evmSignature as `0x${string}` }).catch(() => false);
  } else {
    const signed = new TextEncoder().encode(`\x19Hedera Signed Message:\n${message.length}${message}`);
    const sig = hexToBytes(signatureHex);
    const key = acct.key?.key ?? "";
    try {
      if (acct.key?._type === "ED25519") ok = ed25519.verify(sig, signed, hexToBytes(key));
      else if (acct.key?._type === "ECDSA_SECP256K1")
        ok = secp256k1.verify(sig, keccak_256(signed), hexToBytes(key), { prehash: false, lowS: false });
    } catch { ok = false; }
  }
  if (!ok) throw new Error("Signature check failed");
  const exp = Date.now() + TOKEN_HOURS * 3600_000;
  return `w1.${accountId}.${exp}.${mac(`${accountId}.${exp}`)}`;
}
