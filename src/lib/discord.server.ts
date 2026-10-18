import { MIRROR_URL } from './hedera-config';
import { discordCoinMessage } from './discord-content';

export async function dispatchDiscordCoin() {
  const key = process.env['DISCORD_API_KEY'];
  const appKey = process.env['LOVABLE_API_KEY'];
  if (!key || !appKey) throw new Error('Discord connection is not configured');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const claimed = await db.rpc('claim_discord_coin_post');
  if (claimed.error) throw claimed.error;
  const job = claimed.data?.[0];
  if (!job) return { step: 'no new coin' };
  let attempted = false;
  let definite = true;
  try {
    if (!/^0x[0-9a-f]{40}$/i.test(job.token_address)) throw new Error('Invalid HTS address');
    const tokenId = `0.0.${BigInt(job.token_address)}`;
    const mirror = await fetch(`${MIRROR_URL}/api/v1/tokens/${tokenId}`, { signal: AbortSignal.timeout(3000) });
    if (!mirror.ok) throw new Error(`Hedera token read failed [${mirror.status}]: ${await mirror.text()}`);
    const token = await mirror.json() as { token_id?: string; memo?: string; deleted?: boolean };
    if (token.token_id !== tokenId || token.deleted || typeof token.memo !== 'string') throw new Error('Hedera token or memo not confirmed');
    const savedMemo = await db.from('discord_coin_posts').update({ memo: token.memo }).eq('id', job.post_id);
    if (savedMemo.error) throw savedMemo.error;
    const coin = await db.from('tokens').select('image_url').eq('address', job.token_address).maybeSingle();
    if (coin.error) throw coin.error;
    const payload = discordCoinMessage({ address: job.token_address, name: job.coin_name, symbol: job.coin_symbol, image_url: coin.data?.image_url }, token.memo);
    attempted = true;
    definite = false;
    const response = await fetch(`https://connector-gateway.lovable.dev/discord/channels/${job.channel}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${appKey}`, 'X-Connection-Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, nonce: String(job.post_id), enforce_nonce: true }),
      signal: AbortSignal.timeout(4000),
    });
    const raw = await response.text();
    if (!response.ok) {
      definite = response.status < 500;
      console.error('Discord failed', response.status, raw);
      throw new Error(`Discord [${response.status}]: ${raw}`);
    }
    const sent = JSON.parse(raw) as { id?: string };
    if (!sent.id) throw new Error('No Discord message confirmation');
    const saved = await db.from('discord_coin_posts').update({ status: 'sent', message_id: sent.id, sent_at: new Date().toISOString(), last_error: null }).eq('id', job.post_id);
    if (saved.error) throw saved.error;
    return { step: 'coin posted', token: tokenId };
  } catch (e) {
    await db.from('discord_coin_posts').update({ status: !attempted || definite ? 'failed' : 'unknown', last_error: e instanceof Error ? e.message : 'Discord failed' }).eq('id', job.post_id);
    throw e;
  }
}