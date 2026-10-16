export const DAILY_X_HOURS = [10, 15, 20] as const;
export const APP_URL = "https://hederapump.dev";

// One topic per branded image, in the same order as src/lib/x-images.ts.
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
  "Comments on every coin. Read what people say, reply, and see who is really active before you trade. The conversation lives next to the chart.",
  "Who holds what? Each coin page lists its biggest holders, so you can see how coins are spread out before you buy. Public data, no guesswork.",
  "Follow a coin on HederaPump and get a heads-up when it moves or gets close to graduation. Set your alerts and keep an eye on the launch.",
  "King of the Hill: the coin closest to graduation takes the top spot on the HederaPump homepage. Watch the race and see who is next.",
  "Your profile, your name, your picture. Build a HederaPump profile so people can follow your launches and see the coins you have made.",
  "Found a coin worth sharing? Make a share card with its name, price and link in one tap, and send it to your group before anyone else does.",
  "Every coin page shows the token address and the creator behind it, with copy buttons and a link to the public record. Check before you buy.",
  "Bring your wallet. HashPack, MetaMask and WalletConnect wallets all connect to HederaPump, so you can trade from the app you already use.",
  "No seed phrase stress. Create an instant wallet with your e-mail on HederaPump and start trading in seconds, right from your phone.",
  "The curve is the market. HederaPump coins trade against a bonding curve, not an order book, so there is no waiting for a counterparty. Buys push the price up, sells push it down.",
  "Automatic listing. When a HederaPump coin fills its curve, liquidity is listed on SaucerSwap as part of the graduating trade. No manual migration needed.",
  "One billion tokens, fixed. Every HederaPump coin is created without mint or freeze controls, so nobody can print more later. The supply you see is the supply that exists.",
  "Native Hedera tokens. Coins launched on HederaPump are real HTS tokens in your wallet, not a wrapper or an IOU. They move like any other Hedera token.",
  "Check the numbers. Coin and trade data on HederaPump comes from Hedera's public mirror node, so anyone can verify the same figures independently.",
  "Same curve for everyone. There is no private allocation and no team unlock: every buyer, including the creator, buys from the same bonding curve at the same price.",
  "Questions about a coin, a fee or your wallet? Talk to the HederaPump support assistant, or leave a request and a human picks it up from the admin inbox.",
  "Live in minutes. Pick a name, add an image, set your first buy and your coin is trading on its own bonding curve. No approval queue, no listing committee.",
  "Your coin page, your story. Add an image, a long description and your links, then shape the page the way you want people to find it.",
  "Claim your fees. Creators keep a share of the trading fees on their own coin and can claim it straight from their HederaPump profile.",
  "In your pocket. Create a coin, follow launches and trade from your phone with the same HederaPump account you use on desktop.",
  "Follow along. New launches, graduations and build updates are posted on X, and the HederaPump Telegram group is where the questions get answered.",
  "Know the risk. Meme coins are volatile and most of them go to zero. HederaPump shows you real data so you can decide, but nothing here is financial advice.",
  "Do your own research. Check the creator, the holder list and how much of the curve is left before you buy. HederaPump gives you the tools, not a promise.",
  "Settles in seconds. Hedera finalises transactions quickly and with fixed fees, so a buy or a sell on HederaPump does not wait behind a gas auction.",
  "Efficient by design. Hedera reaches consensus without energy-wasting mining, which keeps transaction fees small and predictable for traders and creators.",
  "Sell any time. There is no lock-in on a HederaPump bonding curve: you can sell your coins straight from the coin page whenever you want.",
  "No approval pop-ups. With an instant wallet on HederaPump, buys and sells happen without a signature request in a separate wallet app.",
  "Real trades only. Every point on a HederaPump price chart comes from a trade that actually happened on the bonding curve. No smooth lines, no fake volume.",
  "How far to graduation? Each coin page shows how much is left to sell before the curve is full and the coin graduates to SaucerSwap.",
  "Ethereum tools, Hedera network. MetaMask and other EVM wallets connect to HederaPump on chain 295, so you can use the wallet you already know.",
  "On SaucerSwap. Coins that graduate on HederaPump get their liquidity listed on SaucerSwap, Hedera's largest decentralised exchange.",
  "Live ticker. Buys and sells appear on the HederaPump ticker as they land on-chain, so you can watch real activity instead of guessing.",
  "What you paid, what it is worth. Your HederaPump profile compares your average buy price with the current value of every coin you hold.",
  "Built in the open. HederaPump is a small team shipping in public: what changes gets posted, and the coin data stays verifiable on Hedera.",
  "Tokens arrive in your wallet. Because coins are native Hedera tokens, your wallet associates a new token automatically when you buy it.",
  "Tell us what you want next. Features on HederaPump come from the community: say what is missing in the Telegram group and watch it get built.",
  "Fees, in the open. Trading fees are fixed and published, and creators earn a share of every trade made on the coin they launched.",
  "Behind the coin. Every HederaPump launch names its creator, so you can follow the people whose launches you like instead of anonymous wallets.",
  "No listing fee. Launching a coin on HederaPump costs a small creation fee plus your own first buy. There is no charge to be listed.",
  "Pays in HBAR. You trade with HBAR, the native coin of Hedera. Fees are small and predictable, and your balance is shown on every coin page.",
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
