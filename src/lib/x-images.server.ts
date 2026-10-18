// Tweet images, stored in token_images and served by /api/public/img/$hash.
// The scheduled worker fetches these stable URLs; bundled asset URLs do not
// resolve in the published server build.
const BUCKET_BASE = "/api/public/img";

// Generated from /tmp/ximg/mapping.json (sha256 of each re-encoded image).
const FILE_HASHES: Record<string, string> = {
  "x-address.jpg": "d6d0fd3f869031cdf32bce65edb7e70b9a0926bf27b51ef63aaf510a4dd60873",
  "x-associate.jpg": "bd67b267e2370e4096d05acf2fa6e82b92a2bdd5600a097dd3d7ea330b98ba82",
  "x-auto-listing.jpg": "dcbb04b8d4a63f375ce8b842a4159563d4a7c56e57a64b7b5e2f86db61deea32",
  "x-behind.jpg": "",
  "x-bonding-curve.jpg": "",
  "x-built-on-hedera.jpg": "",
  "x-chart.jpg": "",
  "x-check-numbers.jpg": "",
  "x-claim.jpg": "",
  "x-coin-page.jpg": "",
  "x-comments.jpg": "",
  "x-community-call.jpg": "",
  "x-community.jpg": "",
  "x-creator.jpg": "",
  "x-curve-market.jpg": "",
  "x-dyor.jpg": "",
  "x-efficient.jpg": "",
  "x-evm.jpg": "",
  "x-fees.jpg": "",
  "x-fixed-supply.jpg": "",
  "x-follow.jpg": "",
  "x-graduation.jpg": "",
  "x-hbar.jpg": "",
  "x-holders.jpg": "",
  "x-holdings.jpg": "",
  "x-instant.jpg": "",
  "x-introduction.jpg": "",
  "x-king.jpg": "",
  "x-live-in-minutes.jpg": "",
  "x-mission.jpg": "",
  "x-mobile.jpg": "",
  "x-native.jpg": "",
  "x-no-approvals.jpg": "",
  "x-no-listing.jpg": "",
  "x-open.jpg": "",
  "x-pnl.jpg": "",
  "x-profile.jpg": "",
  "x-progress.jpg": "",
  "x-referrals.jpg": "",
  "x-risk.jpg": "",
  "x-same-curve.jpg": "",
  "x-saucer.jpg": "",
  "x-sell.jpg": "",
  "x-share.jpg": "",
  "x-social.jpg": "",
  "x-speed.jpg": "",
  "x-support.jpg": "",
  "x-ticker.jpg": "",
  "x-wallets.jpg": "",
  "x-your-coin.jpg": "",
};

export const topicImageUrls: string[] = Object.entries(FILE_HASHES)
  .filter(([, hash]) => hash)
  .map(([, hash]) => `${BUCKET_BASE}/${hash}`);
