import { describe, expect, it } from 'vitest';
import {
  contestMessages,
  contestSlot,
  discordDailySlot,
  graduationDiscordMessage,
  graduationSlot,
  graduationXMessage,
  verifiedMessages,
  verifiedSlot,
  weeklyMessages,
  weeklySlot,
} from '../lib/promo-content';

const coin = { address: '0x0000000000000000000000000000000000a6b793', name: 'HashCat', symbol: 'HCAT' };

describe('promo slots', () => {
  it('builds stable unique slots per event and channel', () => {
    expect(contestSlot('2026-10-12')).toBe('contest:2026-10-12');
    expect(weeklySlot('2026-10-19')).toBe('weekly:2026-10-19');
    expect(graduationSlot('0xABC')).toBe('graduation:0xabc');
    expect(discordDailySlot('2026-10-19-10')).toBe('x:2026-10-19-10');
  });
});

describe('contest messages', () => {
  it('names the winner, volume, prize and coin link on every channel', () => {
    const msgs = contestMessages(coin, 1234.5, 100);
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('HashCat');
      expect(text).toContain('HCAT');
      expect(text).toContain('1,235');
      expect(text).toContain('100 HBAR');
      expect(text).toContain(`https://hederapump.dev/token/${coin.address}`);
    }
  });

  it('escapes HTML in Telegram and mentions in Discord', () => {
    const evil = { ...coin, name: '<b>@everyone</b>' };
    const msgs = contestMessages(evil, 10, 100);
    expect(msgs.telegram).not.toContain('<b>@everyone</b>');
    expect(msgs.telegram).toContain('&lt;b&gt;');
    expect(msgs.discord).toContain('@​everyone');
  });
});

describe('weekly messages', () => {
  it('includes coins, trades, volume and traders with the date range', () => {
    const msgs = weeklyMessages({ coins: 3, trades: 42, volumeHbar: 3068.2, traders: 7 }, '2026-10-12', '2026-10-19');
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('3 new coins');
      expect(text).toContain('42 trades');
      expect(text).toContain('3,068 HBAR');
      expect(text).toContain('7 active traders');
      expect(text).toContain('2026-10-12');
      expect(text).toContain('2026-10-19');
    }
  });
});

describe('graduation messages', () => {
  it('announces the graduation with the coin link on X and Discord', () => {
    for (const text of [graduationXMessage(coin), graduationDiscordMessage(coin)]) {
      expect(text).toContain('HashCat');
      expect(text).toContain('graduated');
      expect(text).toContain('SaucerSwap');
      expect(text).toContain(`https://hederapump.dev/token/${coin.address}`);
    }
  });
});

describe('verified account messages', () => {
  it('uses one stable slot so the announcement can never be posted twice', () => {
    expect(verifiedSlot).toBe('verified:announce');
  });

  it('names the official X handle on every channel', () => {
    const msgs = verifiedMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('hederapumpdev');
      expect(text).toContain('https://x.com/hederapumpdev');
    }
  });

  it('keeps the claim to what X confirmed and keeps the risk line', () => {
    const msgs = verifiedMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).not.toContain('audit');
      expect(text.toLowerCase()).not.toContain('guarantee');
    }
    expect(msgs.telegram).toContain('Meme coins are high-risk');
    expect(msgs.discord).toContain('Meme coins are high-risk');
  });
});
