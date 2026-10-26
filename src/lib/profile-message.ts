/** Text a wallet signs to prove it owns the profile; covers the exact content so a replay can only re-save the same thing. */
export function profileEditMessage(p: { accountId: string; wallet: string; time: string; nonce: string; name: string; bio: string; avatar: string | null; x: string | null; banner?: string | null }) {
  return [
    "HederaPump profile update",
    `Account: ${p.accountId}`,
    `Wallet: ${p.wallet}`,
    `Name: ${p.name}`,
    `Bio: ${p.bio}`,
    `Avatar: ${p.avatar ?? "-"}`,
    `X: ${p.x ?? "-"}`,
    ...(p.banner ? [`Banner: ${p.banner}`] : []),
    `Time: ${p.time}`,
    `Nonce: ${p.nonce}`,
  ].join("\n");
}

/** Normalizes an X handle: accepts "@name", "name" or an x.com/twitter.com link. Null when empty. */
export function xHandle(v: unknown): string | null {
  let s = String(v ?? "").trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(s)) throw new Error("X handle: 1–15 letters, numbers or _");
  return s;
}
