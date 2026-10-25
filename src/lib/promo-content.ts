// Browser-safe content for automatic promotion posts:
// weekly contest winner, weekly summary, graduation alerts and the Discord daily mirror.
import { addMentions } from "./hedera-mentions";

export type PromoCoin = { address: string; name: string; symbol: string };
export type WeeklyStats = { coins: number; trades: number; volumeHbar: number; traders: number };

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const escapeMd = (s: string) => s.replace(/([\\`*_{}\[\]()<>~|])/g, '\\$1').replace(/@/g, '@​');
const coinUrl = (address: string) => `https://hederapump.dev/token/${encodeURIComponent(address)}`;
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const RISK = 'Meme coins are high-risk. Not financial advice.';

/** Slots are stable identifiers: one post per slot per channel, ever. */
export const contestSlot = (weekKey: string) => `contest:${weekKey}`;
export const weeklySlot = (day: string) => `weekly:${day}`;
export const graduationSlot = (token: string) => `graduation:${token.toLowerCase()}`;
export const discordDailySlot = (xSlot: string) => `x:${xSlot}`;
/** One spotlight per six-hour window: spotlight:YYYY-MM-DD-(0..3). */
export const spotlightSlot = (d: Date) => `spotlight:${d.toISOString().slice(0, 10)}-${Math.floor(d.getUTCHours() / 6)}`;

export function spotlightMessages(coin: PromoCoin, trades: number, volumeHbar: number) {
  const name = coin.name.slice(0, 32);
  const symbol = coin.symbol.slice(0, 12);
  const x = `🔦 Coin spotlight: ${name} ($${symbol})\n\n${num(trades)} trades · ${num(volumeHbar)} HBAR volume so far.\n\nTake a look:\n${coinUrl(coin.address)}\n\n#Hedera #HederaPump`;
  const telegram = `<b>🔦 Coin spotlight</b>\n\n<a href="${coinUrl(coin.address)}">${escapeHtml(name)} ($${escapeHtml(symbol)})</a> — <b>${num(trades)}</b> trades, <b>${num(volumeHbar)} HBAR</b> volume so far.\n\n${RISK}`;
  const discord = `🔦 **Coin spotlight**\n\n**${escapeMd(name)} ($${escapeMd(symbol)})** — **${num(trades)}** trades, **${num(volumeHbar)} HBAR** volume so far.\n\nCoin: ${coinUrl(coin.address)}\n\n${RISK}`;
  return { x, telegram, discord };
}

export function contestMessages(coin: PromoCoin, volumeHbar: number, prizeHbar: number) {
  const name = coin.name.slice(0, 32);
  const symbol = coin.symbol.slice(0, 12);
  const x = addMentions(`🏆 Weekly contest winner: ${name} ($${symbol})!\n\nMost trading volume this week: ${num(volumeHbar)} HBAR. The creator receives ${num(prizeHbar)} HBAR.\n\nLaunch your coin and compete next week:\n${coinUrl(coin.address)}\n\n#Hedera #HederaPump`, ["hedera", "community"]);
  const telegram = `<b>🏆 Weekly contest winner</b>\n\n<a href="${coinUrl(coin.address)}">${escapeHtml(name)} ($${escapeHtml(symbol)})</a> takes the week with <b>${num(volumeHbar)} HBAR</b> in trading volume. The creator receives <b>${num(prizeHbar)} HBAR</b>.\n\nLaunch your coin and compete next week on <a href="https://hederapump.dev">HederaPump</a>.\n\n${RISK}`;
  const discord = `🏆 **Weekly contest winner**\n\n**${escapeMd(name)} ($${escapeMd(symbol)})** takes the week with **${num(volumeHbar)} HBAR** in trading volume. The creator receives **${num(prizeHbar)} HBAR**.\n\nCoin: ${coinUrl(coin.address)}\nLaunch your coin and compete next week: https://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

export function weeklyMessages(s: WeeklyStats, fromDay: string, toDay: string) {
  const stats = `🪙 ${s.coins} new coins\n🔁 ${num(s.trades)} trades\n💰 ${num(s.volumeHbar)} HBAR volume\n👥 ${num(s.traders)} active traders`;
  const x = addMentions(`📊 HederaPump week in review (${fromDay} → ${toDay})\n\n${stats}\n\nLaunch yours: https://hederapump.dev\n\n#Hedera #HederaPump`, ["hedera"]);
  const telegram = `<b>📊 HederaPump week in review</b> (${fromDay} → ${toDay})\n\n${stats}\n\nLaunch yours on <a href="https://hederapump.dev">HederaPump</a>.\n\n${RISK}`;
  const discord = `📊 **HederaPump week in review** (${fromDay} → ${toDay})\n\n${stats}\n\nLaunch yours: https://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

export function graduationXMessage(coin: PromoCoin) {
  const name = coin.name.slice(0, 32);
  const symbol = coin.symbol.slice(0, 12);
  return addMentions(`🎓 ${name} ($${symbol}) has graduated!\n\nThe bonding curve is full and liquidity is now listed on SaucerSwap.\n\n${coinUrl(coin.address)}\n\n#Hedera #HederaPump`, ["hedera", "saucerswap"]);
}

export function graduationDiscordMessage(coin: PromoCoin) {
  const name = escapeMd(coin.name.slice(0, 32));
  const symbol = escapeMd(coin.symbol.slice(0, 12));
  return `🎓 **${name} ($${symbol}) has graduated!**\n\nThe bonding curve is full and liquidity is now listed on [SaucerSwap](https://saucerswap.finance).\n\nCoin: ${coinUrl(coin.address)}\n\n${RISK}`;
}

/** One-off Hold Out announcement: one post per channel, ever. */
export const holdoutSlot = "holdout:announce";

export function holdoutMessages() {
  const x = `🫂 Hold Out: weekly HBAR rewards for HederaPump holders.

Hold at least 7 days — the longer you hold, the bigger your share (up to 2× after 60 days). Funded by trading fees.

First pot counts Monday 26 October.
https://hederapump.dev

#Hedera #HederaPump`;
  const telegram = `<b>🫂 Hold Out</b>\n\nWeekly HBAR rewards for <a href="https://hederapump.dev">HederaPump</a> holders.\n\nHold at least 7 days — the longer you hold, the bigger your share, up to 2× after 60 days. Every coin has its own weekly pot, funded by a slice of trading fees.\n\nFirst pot counts from Monday 26 October.\n\n${RISK}`;
  const discord = `🫂 **Hold Out**\n\nWeekly HBAR rewards for HederaPump holders.\n\nHold at least 7 days — the longer you hold, the bigger your share, up to 2× after 60 days. Every coin has its own weekly pot, funded by a slice of trading fees.\n\nFirst pot counts from Monday 26 October.\n\nhttps://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

/** One-off Google sign-in announcement: one post per channel, ever. */
export const signInSlot = "signin:announce";

export function signInMessages() {
  const x = `🔑 Signing in with Google now works on HederaPump.

One tap — no wallet app to open, no code to copy. Your wallet is ready the moment you're in.

Try it: https://hederapump.dev

#Hedera #HederaPump`;
  const telegram = `<b>🔑 Google sign-in now works</b>\n\nSign in to <a href="https://hederapump.dev">HederaPump</a> with your Google account — no wallet app to open, no codes to copy. Your wallet is ready the moment you're in.\n\nYou can also keep signing in with email, and add or import up to 10 wallets inside your account.\n\n${RISK}`;
  const discord = `🔑 **Google sign-in now works**\n\nSign in to HederaPump with your Google account — no wallet app to open, no codes to copy. Your wallet is ready the moment you're in.\n\nYou can also keep signing in with email, and add or import up to 10 wallets inside your account.\n\nhttps://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

/** One-off verified-account announcement: one post per channel, ever. */
export const verifiedSlot = "verified:announce";

export function verifiedMessages() {
  const x = `✅ HederaPump is now a verified account on X.

The blue check next to @hederapumpdev means X has confirmed this is the official HederaPump account.

Follow for new coins, graduations and weekly rewards:
https://x.com/hederapumpdev

#Hedera #HederaPump`;
  const telegram = `<b>✅ HederaPump is verified on X</b>\n\nOur X account <a href="https://x.com/hederapumpdev">@hederapumpdev</a> now carries the blue check — X has confirmed it as the official HederaPump account.\n\nFollow for new coins, graduations and weekly rewards. If an account or DM looks like us without the check, it isn't us.\n\n${RISK}`;
  const discord = `✅ **HederaPump is verified on X**\n\nOur X account @hederapumpdev now carries the blue check — X has confirmed it as the official HederaPump account.\n\nFollow: https://x.com/hederapumpdev\nWebsite: https://hederapump.dev\n\nIf an account or DM looks like us without the check, it isn't us.\n\n${RISK}`;
  return { x, telegram, discord };
}

export const fastGradSlot = "fastgrad:hederapump";

/** One-time announcement: fast-graduation HEDERAPUMP (0.0.10931033) reached SaucerSwap. */
export function fastGradMessages() {
  const id = "0.0.10931033";
  const x = `🎓 HEDERAPUMP (fast edition) graduated!

Token ${id} filled its bonding curve and is now live on SaucerSwap with liquidity locked forever.

Check the token ID — the original HEDERAPUMP is a different coin.
https://hederapump.dev/markets

#Hedera #HederaPump`;
  const telegram = `<b>🎓 HEDERAPUMP fast edition graduated</b>\n\nToken <code>${id}</code> filled its bonding curve and now trades on SaucerSwap. The pool's liquidity is locked in the contract forever.\n\nAlways check the token ID: the original HEDERAPUMP (still on its bonding curve) is a different coin.\n\nTrade: https://hederapump.dev/markets\n\n${RISK}`;
  const discord = `🎓 **HEDERAPUMP fast edition graduated**\n\nToken \`${id}\` filled its bonding curve and now trades on SaucerSwap. Liquidity is locked in the contract forever.\n\nAlways check the token ID — the original HEDERAPUMP (still on its bonding curve) is a different coin.\n\nTrade: https://hederapump.dev/markets\n\n${RISK}`;
  return { x, telegram, discord };
}

export const testGradSlot = "testgrad:hederapump";

/** One-time clarification: the graduated fast-graduation coin was a test run, not a launch. */
export function testGradMessages() {
  const id = "0.0.10931033";
  const x = `🧪 Test complete.

HEDERAPUMP (0.0.10931033) was a test coin — made to check our fast-graduation setup end to end. Only our own wallets bought it, no outside funds.

Not a launch. Don't buy it. The original HEDERAPUMP is 0.0.10924337.

#Hedera #HederaPump`;
  const telegram = `<b>🧪 That one was a test</b>\n\nToken <code>${id}</code> — the HEDERAPUMP that filled its bonding curve and graduated — was a <b>test coin</b>. We made it to check the fast-graduation setup end to end: curve, graduation and the automatic SaucerSwap pool.\n\nOnly our own wallets bought it, so no outside funds are involved. It is not a launch. Don't buy it.\n\nThe original HEDERAPUMP (0.0.10924337) is a different coin and is still on its bonding curve.\n\n${RISK}`;
  const discord = `🧪 **That one was a test**\n\nToken \`${id}\` — the HEDERAPUMP that filled its bonding curve and graduated — was a **test coin**. We made it to check the fast-graduation setup end to end: curve, graduation and the automatic SaucerSwap pool.\n\nOnly our own wallets bought it, so no outside funds are involved. It is not a launch. Don't buy it.\n\nThe original HEDERAPUMP (0.0.10924337) is a different coin and is still on its bonding curve.\n\nhttps://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

export const testGradCaSlot = "testgrad:hederapump-ca";

/** One-time follow-up: the official coin's contract address, so nobody buys the test coin by mistake. */
export function testGradCaMessages() {
  const official = { id: "0.0.10924337", ca: "0x0000000000000000000000000000000000a6b131" };
  const testId = "0.0.10931033";
  const x = `🧪 Follow-up to our test post.

Official HEDERAPUMP (the real one, still on its bonding curve):
CA 0x0000000000000000000000000000000000a6b131 · 0.0.10924337

The test coin that bonded was 0.0.10931033. Not a launch — don't buy it.

#Hedera #HederaPump`;
  const telegram = `<b>🧪 Official HEDERAPUMP contract address</b>\n\nFollowing our test post: the official coin, still on its bonding curve, is\n\n<code>${official.ca}</code>\nHedera ID <code>${official.id}</code>\n\nCoin page: https://hederapump.dev/token/${official.ca}\nHedera: https://hashscan.io/mainnet/token/${official.id}\n\nThe coin that filled its curve and graduated was a test run: <code>${testId}</code>. Not a launch — don't buy it.\n\n${RISK}`;
  const discord = `🧪 **Official HEDERAPUMP contract address**\n\nFollowing our test post: the official coin, still on its bonding curve, is\n\n\`${official.ca}\`\nHedera ID \`${official.id}\`\n\nCoin page: https://hederapump.dev/token/${official.ca}\nHedera: https://hashscan.io/mainnet/token/${official.id}\n\nThe coin that filled its curve and graduated was a test run: \`${testId}\`. Not a launch — don't buy it.\n\n${RISK}`;
  return { x, telegram, discord };
}

/** One-off Solana expansion announcement: one post per channel, ever. */
export const solanaSlot = "solana:announce";

/** One-time announcement: HEDERAPUMP is coming to Solana via pump.fun; Solana fees buy the real coin on Hedera. */
export function solanaMessages() {
  const official = "0.0.10924337";
  const x = addMentions(`🌉 HEDERAPUMP is coming to Solana.

We're launching our official sister coin on pump.fun and promoting it there. Every fee it earns will be used to buy the real HEDERAPUMP on Hedera (${official}).

Same brand, two chains.

#Hedera #HederaPump`, ["hedera"]);
  const telegram = `<b>🌉 HEDERAPUMP is coming to Solana</b>\n\nWe're launching the official HEDERAPUMP sister coin on <b>pump.fun</b> and we'll be promoting it on the Solana network.\n\n<b>The goal:</b> every fee the Solana coin earns will be used to buy the real HEDERAPUMP on Hedera (token <code>${official}</code>) — growing the original coin with Solana volume.\n\nSame brand, two chains. We'll share the contract address here the moment it launches — never buy before you see it from this channel.\n\n${RISK}`;
  const discord = `🌉 **HEDERAPUMP is coming to Solana**\n\nWe're launching the official HEDERAPUMP sister coin on **pump.fun** and we'll be promoting it on the Solana network.\n\n**The goal:** every fee the Solana coin earns will be used to buy the real HEDERAPUMP on Hedera (token \`${official}\`) — growing the original coin with Solana volume.\n\nSame brand, two chains. We'll share the contract address here the moment it launches — never buy before you see it from this channel.\n\nhttps://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

/** One-off HashPack false-positive tip: one post per channel, ever. */
export const hashpackTipSlot = "hashpack:tip";

/** One-time tip: HashPack's in-app browser flags the site by mistake; use Safari/Chrome + WalletConnect. */
export function hashpackTipMessages() {
  const x = addMentions(`🛡️ HashPack's in-app browser is flagging hederapump.dev by mistake — a false positive. We're on no scam list.

Workaround: open the site in Safari or Chrome and connect HashPack via WalletConnect.

We've asked HashPack to clear it.

#Hedera #HederaPump`, ["hashpack"]);
  const telegram = `<b>🛡️ Heads-up for HashPack users</b>\n\nHashPack's in-app dApp browser is currently flagging <a href="https://hederapump.dev">hederapump.dev</a> as "possibly harmful" — a false positive. We're not on any external scam list.\n\n<b>Workaround:</b> open the site in Safari or Chrome and connect your HashPack wallet with WalletConnect as usual.\n\nWe've asked HashPack to remove the flag and will post here the moment it's cleared.\n\n${RISK}`;
  const discord = `🛡️ **Heads-up for HashPack users**\n\nHashPack's in-app dApp browser is currently flagging hederapump.dev as "possibly harmful" — a false positive. We're not on any external scam list.\n\n**Workaround:** open the site in Safari or Chrome and connect your HashPack wallet with WalletConnect as usual.\n\nWe've asked HashPack to remove the flag and will post here the moment it's cleared.\n\nhttps://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

/** One-off Hedex listing announcement: one post per channel, ever. */
export const hedexSlot = "hedex:announce";

/** One-time announcement: Hedex (hedex.dev) now lists HederaPump coins with live bonding-curve progress. */
export function hedexMessages() {
  const x = `🔎 HederaPump coins now show on Hedex.

hedex.dev indexes Hedera markets — SaucerSwap pools plus live bonding-curve progress for every coin launched here.

https://hederapump.dev/markets

#Hedera #HederaPump`;
  const telegram = `<b>🔎 HederaPump coins now show on Hedex</b>\n\n<a href="https://hedex.dev">Hedex</a> is an independent Hedera markets index. It now lists every coin launched on <a href="https://hederapump.dev">HederaPump</a> with live bonding-curve progress, alongside its own SaucerSwap pool data.\n\nFind your coin: https://hederapump.dev/markets\n\n${RISK}`;
  const discord = `🔎 **HederaPump coins now show on Hedex**\n\n[Hedex](https://hedex.dev) is an independent Hedera markets index. It now lists every coin launched on HederaPump with live bonding-curve progress, alongside its own SaucerSwap pool data.\n\nFind your coin: https://hederapump.dev/markets\n\n${RISK}`;
  return { x, telegram, discord };
}

/** One-off X shoutout tagging the Hedex account: one post, ever. */
export const hedexThanksSlot = "hedex:thanks";

/** One-time X follow-up to the Hedex listing announcement, tagging @1hedex. */
export function hedexThanksMessages() {
  const x = addMentions(`🔎 Shoutout to the team behind Hedex — every HederaPump coin now shows there with live bonding-curve progress, next to SaucerSwap pool data.

Find yours: https://hederapump.dev/markets

#Hedera #HederaPump`, ["hedex"]);
  return { x };
}

/** One-off pump.fun launch announcement: the Solana sister coin is live with its real mint. */
export const solanaLaunchSlot = "solana:launch";

/** Solana mint of the HEDERAPUMP sister coin, verified on-chain 2026-10-25. */
export const SOLANA_MINT = "84aTPXRQPDStSQ65YsHEsyomRz9AHc8u4Cw4tTwepump";

/** One-time announcement: the HEDERAPUMP sister coin launched on pump.fun; its fees buy the coin on Hedera. */
export function solanaLaunchMessages() {
  const official = "0.0.10924337";
  const page = `https://pump.fun/coin/${SOLANA_MINT}`;
  const chart = `https://dexscreener.com/solana/${SOLANA_MINT}`;
  const x = addMentions(`🚀 HEDERAPUMP is live on pump.fun.

CA: ${SOLANA_MINT}

New launches can pair with HEDERAPUMP, and every fee it earns buys the real HEDERAPUMP on Hedera (${official}).

Same brand, two chains.

#Hedera #HederaPump`, ["pumpfun", "hedera"]);
  const telegram = `<b>🚀 HEDERAPUMP is live on pump.fun</b>\n\nThe official HEDERAPUMP sister coin on Solana has launched. It shows as <b>Hederapump</b> (<code>$Hederpump</code>).\n\n<b>Contract (mint):</b> <code>${SOLANA_MINT}</code>\nCoin page: <a href="${page}">pump.fun</a>\nChart: <a href="${chart}">DexScreener</a>\n\n<b>Why it matters:</b> new launches on pump.fun can now pick HEDERAPUMP as their pair instead of SOL, and every fee the Solana coin earns is used to buy the real HEDERAPUMP on Hedera (token <code>${official}</code>).\n\n⚠️ These are two separate coins. The original HEDERAPUMP on Hedera is unchanged — always check the address before you buy.\n\nhttps://hederapump.dev\n\n${RISK}`;
  const discord = `🚀 **HEDERAPUMP is live on pump.fun**\n\nThe official HEDERAPUMP sister coin on Solana has launched. It shows as **Hederapump** (\`$Hederpump\`).\n\n**Contract (mint):** \`${SOLANA_MINT}\`\nCoin page: ${page}\nChart: ${chart}\n\n**Why it matters:** new launches on pump.fun can now pick HEDERAPUMP as their pair instead of SOL, and every fee the Solana coin earns is used to buy the real HEDERAPUMP on Hedera (token \`${official}\`).\n\n⚠️ These are two separate coins. The original HEDERAPUMP on Hedera is unchanged — always check the address before you buy.\n\nhttps://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}
