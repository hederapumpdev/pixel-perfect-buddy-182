/**
 * Imported wallets: the private key is encrypted with the user's PIN (PBKDF2 + AES-GCM)
 * and stored only in this browser. It is never sent to the server.
 */
export const LOCAL_WALLET_KEY = "hederaPump.localWallet.v1";
export const MIN_PIN = 6;
const ITERATIONS = 310_000;

export type StoredLocalWallet = { accountId: string; salt: string; iv: string; data: string };

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptKey(accountId: string, privateKey: string, pin: string): Promise<StoredLocalWallet> {
  if (pin.length < MIN_PIN) throw new Error(`Use a PIN of at least ${MIN_PIN} characters.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(privateKey)),
  );
  return { accountId, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

export async function decryptKey(stored: StoredLocalWallet, pin: string): Promise<string> {
  try {
    const key = await deriveKey(pin, unb64(stored.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(stored.iv) }, key, unb64(stored.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Wrong PIN.");
  }
}

export function readStoredWallet(): StoredLocalWallet | null {
  try {
    const s = JSON.parse(localStorage.getItem(LOCAL_WALLET_KEY) ?? "null");
    return s?.accountId && s.data ? s : null;
  } catch {
    return null;
  }
}

/** Extra wallets live inside a signed-in account (HashPack or email): at most this many per account. */
export const MAX_ACCOUNT_WALLETS = 10;
const walletsKey = (owner: string) => `hederaPump.accountWallets.v1.${owner.toLowerCase()}`;

export function readAccountWallets(owner: string): StoredLocalWallet[] {
  try {
    const list = JSON.parse(localStorage.getItem(walletsKey(owner)) ?? "[]");
    return Array.isArray(list) ? list.filter((s) => s?.accountId && s.data) : [];
  } catch {
    return [];
  }
}

export function writeAccountWallets(owner: string, list: StoredLocalWallet[]) {
  localStorage.setItem(walletsKey(owner), JSON.stringify(list.slice(0, MAX_ACCOUNT_WALLETS)));
}

/** Moves a wallet imported before accounts existed into the first account that signs in. */
export function adoptLegacyWallet(owner: string): StoredLocalWallet[] {
  const list = readAccountWallets(owner);
  const legacy = readStoredWallet();
  if (legacy && list.length < MAX_ACCOUNT_WALLETS && !list.some((w) => w.accountId === legacy.accountId)) {
    list.push(legacy);
    writeAccountWallets(owner, list);
  }
  if (legacy) localStorage.removeItem(LOCAL_WALLET_KEY);
  return list;
}

/**
 * Reveals a wallet's own private key after its PIN is confirmed.
 * The key stays in this browser only — it is never sent to the server.
 */
export async function revealStoredWallet(owner: string, id: string, pin: string): Promise<string> {
  const stored = readAccountWallets(owner).find((s) => s.accountId === id);
  if (!stored) throw new Error("That wallet isn't in your account.");
  return decryptKey(stored, pin);
}
