import { describe, expect, it } from 'vitest';
import { addMentions, dailyMentions, HEDERA_HANDLES, stripMentions, xWeight } from '../lib/hedera-mentions';
import { appTweet, topics } from '../lib/x-content';
import { contestMessages, graduationXMessage, solanaLaunchMessages, weeklyMessages } from '../lib/promo-content';

const coin = { address: '0x0000000000000000000000000000000000a6b793', name: 'HashCat', symbol: 'HCAT' };

describe('official ecosystem handles', () => {
  it('uses the handles each project publishes itself', () => {
    expect(HEDERA_HANDLES).toEqual({
      hedera: '@hedera',
      saucerswap: '@SaucerSwapLabs',
      hashpack: '@hashpack',
      community: '@HederaCommunity',
      sodax: '@gosodax',
      pumpfun: '@Pumpfun',
    });
  });
});

describe('X link weighting', () => {
  it('charges a bare domain the same 23 characters X charges for a link', () => {
    expect(xWeight('pump.fun')).toBe(23);
    expect(xWeight('https://hederapump.dev/markets')).toBe(23);
    expect(xWeight('0.0.10924337')).toBe(12);
  });

  it('keeps the pump.fun launch post inside the limit once X links the domain', () => {
    expect(xWeight(solanaLaunchMessages().x)).toBeLessThanOrEqual(280);
  });
});

describe('addMentions', () => {
  const post = 'New coin live.\n\nhttps://hederapump.dev\n\n#Hedera #HederaPump';
  it('puts the mentions just above the trailing hashtag line', () => {
    expect(addMentions(post, ['hedera', 'saucerswap'])).toBe(
      'New coin live.\n\nhttps://hederapump.dev\n\n@hedera @SaucerSwapLabs\n#Hedera #HederaPump',
    );
  });
  it('drops mentions that would push the post past the X limit', () => {
    const long = `${'x'.repeat(270)}\n\n#Hedera`;
    expect(addMentions(long, ['hedera', 'saucerswap'])).toBe(long);
    const tight = `${'x'.repeat(260)}\n\n#Hedera`;
    expect(addMentions(tight, ['hedera', 'saucerswap'])).toBe(`${'x'.repeat(260)}\n\n@hedera\n#Hedera`);
    expect(xWeight(addMentions(tight, ['hedera', 'saucerswap']))).toBeLessThanOrEqual(280);
  });
  it('counts a link as 23 characters the way X does', () => {
    expect(xWeight('https://hederapump.dev/token/0x0000000000000000000000000000000000a6b793')).toBe(23);
  });
});

describe('daily app tweets', () => {
  it('names SaucerSwap in the introduction tweet', () => {
    expect(appTweet(0, '2026-10-24')).toContain('@SaucerSwapLabs');
  });
  it('names an account only when the topic is about that account', () => {
    expect(dailyMentions('Bring your wallet. HashPack and WalletConnect wallets connect')).toEqual(['hashpack']);
    expect(dailyMentions('One billion tokens, fixed.')).toEqual([]);
  });
  it('keeps every topic inside the X limit with mentions included', () => {
    for (let n = 0; n < topics.length; n++) expect(xWeight(appTweet(n, '2026-10-24'))).toBeLessThanOrEqual(280);
  });
});

describe('milestone posts name the accounts they are about', () => {
  it('tags Hedera and SaucerSwap when a coin graduates', () => {
    const text = graduationXMessage(coin);
    expect(text).toContain('@hedera');
    expect(text).toContain('@SaucerSwapLabs');
    expect(xWeight(text)).toBeLessThanOrEqual(280);
  });
  it('tags Hedera and the community account for the contest winner', () => {
    const text = contestMessages(coin, 1234.5, 100).x;
    expect(text).toContain('@hedera');
    expect(text).toContain('@HederaCommunity');
    expect(xWeight(text)).toBeLessThanOrEqual(280);
  });
  it('tags Hedera in the weekly review', () => {
    const text = weeklyMessages({ coins: 3, trades: 42, volumeHbar: 3068.2, traders: 7 }, '2026-10-12', '2026-10-19').x;
    expect(text).toContain('@hedera');
  });
});

describe('stripMentions', () => {
  it('removes the handle line from copies meant for other channels', () => {
    const tweet = 'Topic text.\n\nhttps://hederapump.dev\n@SaucerSwapLabs\n#Hedera • 2026-10-24';
    expect(stripMentions(tweet)).toBe('Topic text.\n\nhttps://hederapump.dev\n#Hedera • 2026-10-24');
  });
  it('keeps every other line untouched', () => {
    const body = 'Weekly contest winner: HashCat ($HCAT)!\n\nCoin: https://hederapump.dev/token/0x0';
    expect(stripMentions(body)).toBe(body);
  });
});
