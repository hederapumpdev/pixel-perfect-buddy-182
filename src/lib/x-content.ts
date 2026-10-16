export const DAILY_X_HOURS = [10, 15, 20] as const;
export const APP_URL = "https://hederapump.dev";

export const topics = [
  "Meet HederaPump: a meme coin launchpad on Hedera. Create native Hedera tokens, trade on a bonding curve and build your community. At graduation, new coins automatically list on SaucerSwap.",
  "What do we do? HederaPump brings meme coin creation and bonding-curve trading to Hedera. Discover new launches, follow creators and track each coin's journey to graduation.",
  "Your idea. Your coin. Your community. Create a native Hedera token on HederaPump, add an image and description, and share your coin page. Crypto trading carries risk.",
  "How does trading work on HederaPump? Coins start on a bonding curve: buys move the curve price up, sells move it down. Prices can change quickly. Never trade more than you can afford to lose.",
  "Creator spotlight: HederaPump creators can build a profile with a name and image, show their launched coins and claim their share of trading fees. Explore the people behind the tokens.",
  "From launch to graduation: new HederaPump coins trade on a bonding curve first. Once they graduate, liquidity is automatically listed on SaucerSwap. Before graduation, trading happens on HederaPump.",
  "Know what you hold. Your HederaPump profile shows your HBAR balance and launchpad coin holdings. Check your wallet before making your next trade.",
  "Discover the next community on HederaPump. Browse launches, check the token address and creator, read comments and follow the coins that interest you. Always do your own research.",
  "Built on Hedera. Native tokens, community profiles and transparent coin pages. HederaPump brings creation, discovery and bonding-curve trading together. No promises of profit—just tools to build.",
];

export function localXTime(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (name: string) => parts.find((part) => part.type === name)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function dailyXSlot(now: Date, introduction: boolean) {
  if (introduction) return "introduction";
  const { day, hour } = localXTime(now);
  return DAILY_X_HOURS.some((h) => h === hour) ? `${day}-${hour}` : null;
}

export function appTweet(index: number, day: string) {
  const topic = topics[index % topics.length] ?? topics[0];
  return `${topic}\n\n${APP_URL}\n${index === 0 ? "#Hedera #HederaPump" : `#Hedera • ${day}`}`;
}