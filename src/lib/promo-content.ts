// Browser-safe content for automatic promotion posts:
// weekly contest winner, weekly summary, graduation alerts and the Discord daily mirror.

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
  const x = `🏆 Weekly contest winner: ${name} ($${symbol})!\n\nMost trading volume this week: ${num(volumeHbar)} HBAR. The creator receives ${num(prizeHbar)} HBAR.\n\nLaunch your coin and compete next week:\n${coinUrl(coin.address)}\n\n#Hedera #HederaPump`;
  const telegram = `<b>🏆 Weekly contest winner</b>\n\n<a href="${coinUrl(coin.address)}">${escapeHtml(name)} ($${escapeHtml(symbol)})</a> takes the week with <b>${num(volumeHbar)} HBAR</b> in trading volume. The creator receives <b>${num(prizeHbar)} HBAR</b>.\n\nLaunch your coin and compete next week on <a href="https://hederapump.dev">HederaPump</a>.\n\n${RISK}`;
  const discord = `🏆 **Weekly contest winner**\n\n**${escapeMd(name)} ($${escapeMd(symbol)})** takes the week with **${num(volumeHbar)} HBAR** in trading volume. The creator receives **${num(prizeHbar)} HBAR**.\n\nCoin: ${coinUrl(coin.address)}\nLaunch your coin and compete next week: https://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

export function weeklyMessages(s: WeeklyStats, fromDay: string, toDay: string) {
  const stats = `🪙 ${s.coins} new coins\n🔁 ${num(s.trades)} trades\n💰 ${num(s.volumeHbar)} HBAR volume\n👥 ${num(s.traders)} active traders`;
  const x = `📊 HederaPump week in review (${fromDay} → ${toDay})\n\n${stats}\n\nLaunch yours: https://hederapump.dev\n\n#Hedera #HederaPump`;
  const telegram = `<b>📊 HederaPump week in review</b> (${fromDay} → ${toDay})\n\n${stats}\n\nLaunch yours on <a href="https://hederapump.dev">HederaPump</a>.\n\n${RISK}`;
  const discord = `📊 **HederaPump week in review** (${fromDay} → ${toDay})\n\n${stats}\n\nLaunch yours: https://hederapump.dev\n\n${RISK}`;
  return { x, telegram, discord };
}

export function graduationXMessage(coin: PromoCoin) {
  const name = coin.name.slice(0, 32);
  const symbol = coin.symbol.slice(0, 12);
  return `🎓 ${name} ($${symbol}) has graduated!\n\nThe bonding curve is full and liquidity is now listed on SaucerSwap.\n\n${coinUrl(coin.address)}\n\n#Hedera #HederaPump`;
}

export function graduationDiscordMessage(coin: PromoCoin) {
  const name = escapeMd(coin.name.slice(0, 32));
  const symbol = escapeMd(coin.symbol.slice(0, 12));
  return `🎓 **${name} ($${symbol}) has graduated!**\n\nThe bonding curve is full and liquidity is now listed on SaucerSwap.\n\nCoin: ${coinUrl(coin.address)}\n\n${RISK}`;
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
