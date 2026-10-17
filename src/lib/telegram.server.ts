import { NETWORK, HTS_CONTRACTS } from './hedera-config';
import { topCoinsMessage, graduationMessage, type TelegramCoin } from './telegram-content';

class TelegramError extends Error {
  constructor(public status: number, public body: string) { super(`Telegram [${status}]: ${body}`); }
}
async function telegram(method: string, body: Record<string, unknown>) {
  const key = process.env['TELEGRAM_API_KEY'];
  const appKey = process.env['LOVABLE_API_KEY'];
  if (!key || !appKey) throw new Error('Telegram connection is not configured');
  const response = await fetch(`https://connector-gateway.lovable.dev/telegram/${method}`, {
    method: 'POST', headers: { Authorization: `Bearer ${appKey}`, 'X-Connection-Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
  });
  const raw = await response.text();
  if (!response.ok) { console.error('Telegram failed', response.status, raw); throw new TelegramError(response.status, raw); }
  const data = JSON.parse(raw) as { ok: boolean; result?: { message_id?: number }; description?: string; error_code?: number };
  if (!data.ok) { console.error('Telegram failed', data.error_code, raw); throw new TelegramError(data.error_code ?? 500, raw); }
  return data.result;
}
export async function refreshTelegramTop(now = new Date()) {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const lock = await db.rpc('acquire_telegram_top_lease');
  if (lock.error) throw lock.error;
  if (!lock.data) return { step: 'busy or awaiting review' };
  let sendingNew = false;
  try {
    const state = await db.from('telegram_channel_state').select('*').eq('id', 1).single();
    if (state.error) throw state.error;
    const coins = await db.from('tokens').select('address,name,symbol,tokens_sold,graduated').eq('network', NETWORK).eq('graduated', false)
      .order('tokens_sold', { ascending: false }).order('address').limit(10);
    if (coins.error) throw coins.error;
    const payload = { chat_id: state.data.chat_id, text: topCoinsMessage(coins.data as TelegramCoin[], now), parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
    if (state.data.message_id) {
      try { await telegram('editMessageText', { ...payload, message_id: state.data.message_id }); }
      catch (e) { if (!(e instanceof TelegramError && e.body.includes('message is not modified'))) throw e; }
    } else {
      const reserved = await db.from('telegram_channel_state').update({ status: 'sending' }).eq('id', 1);
      if (reserved.error) throw reserved.error;
      sendingNew = true;
      const sent = await telegram('sendMessage', payload);
      if (!sent?.message_id) throw new Error('No Telegram message confirmation');
      const saved = await db.from('telegram_channel_state').update({ message_id: sent.message_id, status: 'ready' }).eq('id', 1);
      if (saved.error) throw saved.error;
      sendingNew = false;
    }
    const saved = await db.from('telegram_channel_state').update({ updated_at: now.toISOString(), last_error: null }).eq('id', 1);
    if (saved.error) throw saved.error;
    return { step: state.data.message_id ? 'edited' : 'sent' };
  } catch (e) {
    await db.from('telegram_channel_state').update({ status: sendingNew && !(e instanceof TelegramError && e.status < 500) ? 'unknown' : 'ready', last_error: e instanceof Error ? e.message : 'Telegram failed' }).eq('id', 1);
    throw e;
  } finally { await db.from('telegram_channel_state').update({ lease_until: null }).eq('id', 1); }
}

/** Unique queue claims prevent duplicate posts even during concurrent sync calls. */
export async function dispatchTelegramGraduation() {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const claimed = await db.rpc('claim_telegram_graduation', { p_network: NETWORK });
  if (claimed.error) throw claimed.error;
  const job = claimed.data?.[0];
  if (!job) return { step: 'no graduation' };
  let attempted = false;
  try {
    const coin = await db.from('tokens').select('address,name,symbol,tokens_sold,graduated,contract').eq('address', job.token).eq('network', NETWORK).single();
    if (coin.error) throw coin.error;
    if (!coin.data.graduated) throw new Error('Graduation not confirmed');
    let text = graduationMessage(coin.data as TelegramCoin);
    if (!HTS_CONTRACTS.includes(coin.data.contract ?? '')) text = text.replace(' and graduated to SaucerSwap', '');
    attempted = true;
    const sent = await telegram('sendMessage', { chat_id: '@hederapump', text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    if (!sent?.message_id) throw new Error('No Telegram confirmation');
    const saved = await db.from('telegram_graduation_posts').update({ status: 'sent', message_id: sent.message_id, sent_at: new Date().toISOString(), last_error: null }).eq('token', job.token);
    if (saved.error) throw saved.error;
    return { step: 'graduation sent' };
  } catch (e) {
    const definite = !attempted || (e instanceof TelegramError && e.status < 500);
    await db.from('telegram_graduation_posts').update({ status: definite ? 'failed' : 'unknown', last_error: e instanceof Error ? e.message : 'Telegram failed' }).eq('token', job.token);
    throw e;
  }
}