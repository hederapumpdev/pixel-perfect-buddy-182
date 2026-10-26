/** Text a wallet signs to follow or unfollow another wallet. */
export function followMessage(p: { follower: string; followee: string; follow: boolean; time: string; nonce: string }) {
  return [
    `HederaPump ${p.follow ? "follow" : "unfollow"}`,
    `Account: ${p.follower}`,
    `Target: ${p.followee}`,
    `Time: ${p.time}`,
    `Nonce: ${p.nonce}`,
  ].join("\n");
}

export const isAccountId = (v: unknown): v is string => typeof v === "string" && /^0\.0\.\d{1,20}$/.test(v);
