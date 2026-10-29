import { describe, expect, it } from 'vitest';
import { xWeight } from '../lib/hedera-mentions';
import {
  contestMessages,
  contestSlot,
  discordDailySlot,
  domainOutageMessages,
  domainOutageSlot,
  domainReachableMessages,
  domainReachableSlot,
  graduationDiscordMessage,
  graduationSlot,
  graduationXMessage,
  hedexMessages,
  hedexSlot,
  hedexThanksMessages,
  hedexThanksSlot,
  profilesMessages,
  profilesSlot,
  hashpackTipMessages,
  hashpackTipSlot,
  SOLANA_MINT,
  SOLANA_PROMO_DAYS,
  solanaDailyMessages,
  solanaDailySlot,
  solanaLaunchMessages,
  solanaLaunchSlot,
  solanaLockedMessages,
  solanaLockedSlot,
  solanaMessages,
  solanaSlot,
  testGradCaMessages,
  testGradCaSlot,
  testGradMessages,
  testGradSlot,
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

  it('links SaucerSwap in the Discord graduation post', () => {
    expect(graduationDiscordMessage(coin)).toContain('[SaucerSwap](https://saucerswap.finance)');
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

describe('test coin clarification', () => {
  it('uses one stable slot so the clarification can never be posted twice', () => {
    expect(testGradSlot).toBe('testgrad:hederapump');
  });

  it('names the test token ID and says it was only a test on every channel', () => {
    const msgs = testGradMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('0.0.10931033');
      expect(text.toLowerCase()).toContain('test');
      expect(text.toLowerCase()).toContain('our own wallets');
    }
  });

  it('tells people not to buy it and points out the original coin', () => {
    const msgs = testGradMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('0.0.10924337');
      expect(text.toLowerCase()).toContain("don't buy");
    }
  });

  it('fits the X character limit and makes no refund or deletion claim', () => {
    const msgs = testGradMessages();
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).not.toContain('refund');
      expect(text.toLowerCase()).not.toContain('deleted');
    }
  });
});

describe('official contract address follow-up', () => {
  it('uses one stable slot so the address post can never be posted twice', () => {
    expect(testGradCaSlot).toBe('testgrad:hederapump-ca');
  });

  it('gives the official contract address and Hedera ID on every channel', () => {
    const msgs = testGradCaMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('0x0000000000000000000000000000000000a6b131');
      expect(text).toContain('0.0.10924337');
      expect(text).toContain('0.0.10931033');
      expect(text.toLowerCase()).toContain("don't buy");
    }
  });

  it('fits the X character limit and makes no refund or deletion claim', () => {
    const msgs = testGradCaMessages();
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).not.toContain('refund');
      expect(text.toLowerCase()).not.toContain('deleted');
    }
  });
});

describe('Solana expansion announcement', () => {
  it('uses one stable slot so the announcement can never be posted twice', () => {
    expect(solanaSlot).toBe('solana:announce');
  });

  it('announces the pump.fun launch, promotion and fee buyback of the real coin on every channel', () => {
    const msgs = solanaMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('solana');
      expect(text.toLowerCase()).toContain('pump.fun');
      expect(text.toLowerCase()).toContain('fee');
      expect(text.toLowerCase()).toContain('buy the real hederapump');
      expect(text).toContain('0.0.10924337');
    }
  });

  it('fits the X character limit and promises no guaranteed returns', () => {
    const msgs = solanaMessages();
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).not.toContain('guaranteed');
      expect(text.toLowerCase()).not.toContain('profit');
    }
  });
});

describe('HashPack false-positive tip', () => {
  it('uses one stable slot so the tip can never be posted twice', () => {
    expect(hashpackTipSlot).toBe('hashpack:tip');
  });

  it('explains the false positive and the Safari/Chrome + WalletConnect workaround', () => {
    const msgs = hashpackTipMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('false positive');
      expect(text.toLowerCase()).toContain('walletconnect');
      expect(text.toLowerCase()).toContain('safari');
      expect(text.toLowerCase()).toContain('chrome');
    }
    expect(msgs.x).toContain('@hashpack');
  });

  it('does not claim the flag is already removed and fits the X character limit', () => {
    const msgs = hashpackTipMessages();
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).not.toContain('has been removed');
      expect(text.toLowerCase()).not.toContain('is fixed');
      expect(text.toLowerCase()).not.toContain('whitelisted');
    }
  });
});

describe('Hedex listing announcement', () => {
  it('uses one stable slot so the announcement can never be posted twice', () => {
    expect(hedexSlot).toBe('hedex:announce');
  });

  it('names Hedex, links to it and points at the coin list on every channel', () => {
    const msgs = hedexMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('hedex');
      expect(text.toLowerCase()).toContain('hedex.dev');
      expect(text.toLowerCase()).toContain('bonding-curve');
      expect(text).toContain('https://hederapump.dev/markets');
    }
  });

  it('does not claim an endorsement Hedex has not made and fits the X character limit', () => {
    const msgs = hedexMessages();
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      const low = text.toLowerCase();
      expect(low).not.toContain('official partner');
      expect(low).not.toContain('endorsed');
      expect(low).not.toContain('verified by');
    }
  });
});

describe('hedex shoutout', () => {
  it('claims one stable slot for the follow-up', () => {
    expect(hedexThanksSlot).toBe('hedex:thanks');
  });

  it('tags the Hedex account, links to the coin list and fits the X limit', () => {
    const msgs = hedexThanksMessages();
    expect(msgs.x).toContain('@1hedex');
    expect(msgs.x.toLowerCase()).toContain('hedex');
    expect(msgs.x).toContain('https://hederapump.dev/markets');
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
    const low = msgs.x.toLowerCase();
    expect(low).not.toContain('official partner');
    expect(low).not.toContain('endorsed');
    expect(low).not.toContain('verified by');
  });
});

describe('pump.fun launch announcement', () => {
  it('uses one stable slot so the launch post can never be posted twice', () => {
    expect(solanaLaunchSlot).toBe('solana:launch');
  });

  it('gives the real Solana mint and the Hedera coin it supports on every channel', () => {
    const msgs = solanaLaunchMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text).toContain('84aTPXRQPDStSQ65YsHEsyomRz9AHc8u4Cw4tTwepump');
      expect(text).toContain('0.0.10924337');
      expect(text.toLowerCase()).toContain('pump.fun');
    }
  });

  it('says the two coins are separate so nobody buys the wrong one', () => {
    const msgs = solanaLaunchMessages();
    for (const text of [msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('two separate coins');
      expect(text.toLowerCase()).toContain('check the address');
    }
  });

  it('repeats the fee buyback promise and tags pump.fun within the X limit', () => {
    const msgs = solanaLaunchMessages();
    expect(msgs.x).toContain('@Pumpfun');
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('fee');
      const low = text.toLowerCase();
      expect(low).not.toContain('guaranteed');
      expect(low).not.toContain('profit');
    }
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
  });
});

describe('team supply locked follow-up', () => {
  it('uses one stable slot so the follow-up can never be posted twice', () => {
    expect(solanaLockedSlot).toBe('solana:locked');
  });

  it('announces the lock and the DexScreener update with the real mint on every channel', () => {
    const msgs = solanaLockedMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('locked');
      expect(text.toLowerCase()).toContain('dexscreener');
      expect(text).toContain('84aTPXRQPDStSQ65YsHEsyomRz9AHc8u4Cw4tTwepump');
      expect(text).toContain('0.0.10924337');
    }
  });

  it('keeps the two-coin warning and the fee buyback promise, and fits the X limit', () => {
    const msgs = solanaLockedMessages();
    for (const text of [msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('two separate coins');
    }
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('fee');
      const low = text.toLowerCase();
      expect(low).not.toContain('guaranteed');
      expect(low).not.toContain('profit');
    }
    expect([...msgs.x].length).toBeLessThanOrEqual(280);
  });
});

describe('trader profiles announcement', () => {
  it('uses one stable slot so the announcement can never be posted twice', () => {
    expect(profilesSlot).toBe('profiles:announce');
  });

  it('announces public profiles, wallet-signed editing and linked names on every channel', () => {
    const msgs = profilesMessages();
    for (const text of [msgs.x, msgs.telegram, msgs.discord]) {
      const low = text.toLowerCase();
      expect(low).toContain('profile');
      expect(low).toContain('public');
      expect(low).toContain('wallet');
      expect(text).toContain('https://hederapump.dev');
    }
  });

  it('labels X links as not verified and fits the X character limit', () => {
    const msgs = profilesMessages();
    for (const text of [msgs.telegram, msgs.discord]) {
      expect(text.toLowerCase()).toContain('not verified');
    }
    const weighted = msgs.x.replace(/https:\/\/\S+/g, 'x'.repeat(23));
    expect([...weighted].length).toBeLessThanOrEqual(280);
  });
});

describe("daily pump.fun promo week", () => {
  it("covers exactly the seven launch-week days", () => {
    expect([...SOLANA_PROMO_DAYS]).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
  it("builds one slot per day", () => {
    expect(solanaDailySlot("2026-10-26")).toBe("solana:daily:2026-10-26");
  });
  it("returns messages with the mint and pump.fun link for every promo day", () => {
    for (const day of SOLANA_PROMO_DAYS) {
      const messages = solanaDailyMessages(day);
      expect(messages).not.toBeNull();
      expect(messages!.x).toContain(SOLANA_MINT);
      expect(messages!.x).toContain(`https://pump.fun/coin/${SOLANA_MINT}`);
      expect(messages!.telegram).toContain(SOLANA_MINT);
      expect(messages!.discord).toContain(SOLANA_MINT);
      const weighted = messages!.x.replace(/https:\/\/\S+/g, "x".repeat(23));
      expect([...weighted].length).toBeLessThanOrEqual(280);
    }
  });
  it("gives every day a different X text", () => {
    const texts = SOLANA_PROMO_DAYS.map((day) => solanaDailyMessages(day)!.x);
    expect(new Set(texts).size).toBe(SOLANA_PROMO_DAYS.length);
  });
  it("returns null outside the promo week", () => {
    expect(solanaDailyMessages("2026-10-25")).toBeNull();
    expect(solanaDailyMessages("2026-11-02")).toBeNull();
  });
});

describe("domain outage notice", () => {
  it("is a single stable slot", () => {
    expect(domainOutageSlot).toBe("domain:outage");
  });
  it("points every channel at the working address and says funds are untouched", () => {
    const messages = domainOutageMessages();
    const fallback = "https://pixel-perfect-buddy-182.lovable.app";
    expect(messages.x).toContain(fallback);
    expect(messages.telegram).toContain(fallback);
    expect(messages.discord).toContain(fallback);
    for (const text of [messages.x, messages.telegram, messages.discord]) {
      expect(text).toContain("hederapump.dev");
      expect(text).toMatch(/not a hack/i);
      expect(text).toMatch(/untouched/i);
    }
    expect(xWeight(messages.x)).toBeLessThanOrEqual(280);
  });
  it("says the site is down now without claiming it is already fixed", () => {
    const messages = domainOutageMessages();
    const falseClaim = /back up|has been fixed|now resolved|working again|is live again/i;
    expect(messages.x).toMatch(/unreachable right now/i);
    expect(messages.x).not.toMatch(falseClaim);
    expect(messages.discord).not.toMatch(falseClaim);
  });
});
