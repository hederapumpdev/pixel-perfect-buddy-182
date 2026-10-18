import { describe, expect, it } from 'vitest';
import { discordCoinMessage } from '../lib/discord-content';

describe('Discord coin announcements', () => {
  const coin = { address: '0x0000000000000000000000000000000000a6b752', name: 'Pepe', symbol: 'PEPE' };
  it('includes the actual coin link and exact on-chain memo', () => {
    const memo = 'https://hederapump.dev/api/public/token-meta/0x0000000000000000000000000000000000a6ace9/1';
    const message = discordCoinMessage(coin, memo);
    expect(message.content).toContain(`https://hederapump.dev/token/${coin.address}`);
    expect(message.content).toContain(`Token memo (exact on-chain value):\n${memo}\n`);
  });
  it('does not let coin names or memos ping Discord members', () => {
    const message = discordCoinMessage({ ...coin, name: '@everyone' }, '@everyone');
    expect(message.allowed_mentions.parse).toEqual([]);
    expect(message.content).toContain('@\u200beveryone');
  });
  it('rejects invalid addresses instead of claiming a coin exists', () => {
    expect(() => discordCoinMessage({ ...coin, address: 'fake' }, '')).toThrow('Invalid token address');
  });
  it("shows the coin's own uploaded logo and no substitute when absent", () => {
    const hash = '3cc73f8660654e54887984e061645846b4e4e822aab3ebfbfb74d4fd80f03086';
    expect(discordCoinMessage({ ...coin, image_url: hash }, '').embeds[0]?.thumbnail.url).toBe(`https://hederapump.dev/api/public/img/${hash}`);
    expect(discordCoinMessage(coin, '').embeds).toEqual([]);
  });
});