export const TELEGRAM_TOP_LIMIT = 10;
export type TelegramCoin = { address: string; name: string; symbol: string; tokens_sold: number; graduated: boolean };
export const bondingProgress = (sold: number) => Math.max(0, Math.min(100, sold / 800_000_000 * 100));
export const topBondingCoins = (coins: TelegramCoin[]) => coins.filter(c => !c.graduated)
  .sort((a, b) => b.tokens_sold - a.tokens_sold || a.address.localeCompare(b.address)).slice(0, TELEGRAM_TOP_LIMIT);
const escapeHtml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const coinLink = (coin: TelegramCoin) => `<a href="https://hederapump.dev/token/${encodeURIComponent(coin.address)}">${escapeHtml(coin.name.slice(0, 32))} ($${escapeHtml(coin.symbol.slice(0, 12))})</a>`;
export function topCoinsMessage(coins: TelegramCoin[], now = new Date()) {
  const rows = topBondingCoins(coins).map((coin, i) => `${i + 1}. ${coinLink(coin)} — <b>${bondingProgress(coin.tokens_sold).toFixed(2)}%</b>`);
  return `<b>HederaPump · Top 10 bonding coins</b>\n\n${rows.length ? rows.join('\n') : 'No active bonding coins yet.'}\n\nUpdated: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC\n<a href="https://hederapump.dev">HederaPump</a> · Ranked by bonding-curve progress\n\nMeme coins are high-risk. Not financial advice.`;
}
export function graduationMessage(coin: TelegramCoin) {
  return `<b>🎓 A coin has graduated!</b>\n\n${coinLink(coin)} has completed its bonding curve and graduated to SaucerSwap.\n\n<a href="https://hederapump.dev/token/${encodeURIComponent(coin.address)}">View coin</a>\n\nMeme coins are high-risk. Not financial advice.`;
}