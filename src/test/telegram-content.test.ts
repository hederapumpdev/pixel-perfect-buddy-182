import { describe, expect, it } from 'vitest';
import { bondingProgress, topBondingCoins, type TelegramCoin } from '../lib/telegram-content';
const coin = (id: number, sold: number, graduated = false): TelegramCoin => ({ address: String(id), name: 'Coin', symbol: 'C', tokens_sold: sold, graduated });
describe('Telegram channel rules', () => {
  it('limits the ranking to ten coins', () => {
    expect(topBondingCoins(Array.from({ length: 12 }, (_, i) => coin(i, i))).length).toBe(10);
  });
  it('ranks highest bonding progress first', () => {
    expect(topBondingCoins([coin(1, 400_000_000), coin(2, 720_000_000)])[0]?.address).toBe('2');
    expect(bondingProgress(720_000_000)).toBe(90);
  });
  it('excludes graduated coins from the active ranking', () => {
    expect(topBondingCoins([coin(1, 800_000_000, true), coin(2, 400_000_000)]).map(c => c.address)).toEqual(['2']);
  });
});