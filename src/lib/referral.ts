// Referral links: ?ref=<wallet> (Hedera account id 0.0.x or EVM 0x…) is remembered in
// localStorage and sent with every v4 trade, so the referrer earns a share of the fee pool.
const KEY = "hederaPump.referrer";

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const HEDERA_RE = /^0\.0\.\d+$/;

export const isValidRef = (ref: string) => EVM_RE.test(ref) || HEDERA_RE.test(ref);

/** Hedera account id → long-zero EVM address. */
export const refToEvm = (ref: string) =>
  HEDERA_RE.test(ref)
    ? "0x" + BigInt(ref.split(".")[2]).toString(16).padStart(40, "0")
    : ref.toLowerCase();

/** Call once on app load: stores ?ref= from the URL (first referrer wins). */
export function captureReferral() {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref || !isValidRef(ref)) return;
  try {
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, refToEvm(ref));
  } catch {
    /* private mode */
  }
}

/** The stored referrer as an EVM address, or null. */
export function getReferrer(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v && EVM_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Personal referral link for a wallet (account id preferred — shorter). */
export function referralLink(accountId: string | null, evmAddress: string | null) {
  const ref = accountId ?? evmAddress;
  return ref ? `https://hederapump.dev/?ref=${ref}` : null;
}
