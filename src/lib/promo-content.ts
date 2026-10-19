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
