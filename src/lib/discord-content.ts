export function discordCoinMessage(coin: { address: string; name: string; symbol: string }, memo: string) {
  if (!/^0x[0-9a-f]{40}$/i.test(coin.address)) throw new Error('Invalid token address');
  const tokenId = `0.0.${BigInt(coin.address)}`;
  const plain = (s: string) => s.replace(/([\\`*_{}\[\]()<>~|])/g, '\\$1').replace(/@/g, '@\u200b');
  return {
    content: `New Hedera coin: ${plain(coin.name)} (${plain(coin.symbol)})\nToken: ${tokenId}\nCoin: https://hederapump.dev/token/${coin.address}\nHedera: https://hashscan.io/mainnet/token/${tokenId}\nToken memo (exact on-chain value):\n${memo || '(empty)'}\n\nCommunity-created coin; listing is not an endorsement. Trading is risky.`,
    allowed_mentions: { parse: [] as string[] },
  };
}