export const TELEGRAM_APP_HOURS = [10, 15, 20] as const;
const appTopics = [
  'Meet HederaPump — a meme coin launchpad on Hedera. Launch native Hedera tokens, discover communities and trade with HBAR on a bonding curve. New coins automatically list on SaucerSwap when they graduate.',
  'Your idea. Your coin. Your community. Create a coin on HederaPump with its own image, description and links, then share your coin page with the world.',
  'Follow the journey to graduation. Explore live trades, bonding progress, holders and comments on HederaPump before making your own decision.',
  'Get to know the creators. Wallet profiles on HederaPump show a name and photo, and creators can claim their share of trading fees through their profile.',
  'Know what you hold. Check your HBAR balance, launchpad coin holdings and profit/loss in your HederaPump profile.',
  'Built on Hedera, verified on-chain. HederaPump coin and trade data comes from the public mirror node. Check token addresses and creators before you trade.',
];
export function telegramAppSlot(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  return TELEGRAM_APP_HOURS.some(h => h === hour) ? `${get('year')}-${get('month')}-${get('day')}-${hour}` : null;
}
export function telegramAppMessage(index: number) {
  return `${appTopics[index % appTopics.length]}\n\n🌐 https://hederapump.dev\n𝕏 https://x.com/hederapumpdev\n\nMeme coins are highly speculative. You can lose your entire investment. Not financial advice.`;
}