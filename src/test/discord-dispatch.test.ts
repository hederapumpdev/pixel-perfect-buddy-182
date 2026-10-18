import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc, update, eq } = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc, from: () => ({ update, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { image_url: null }, error: null }) }) }) }) } }));
import { dispatchDiscordCoin } from '../lib/discord.server';

describe('Discord dispatch safety', () => {
  beforeEach(() => {
    vi.stubEnv('DISCORD_API_KEY', 'test');
    vi.stubEnv('LOVABLE_API_KEY', 'test');
    vi.clearAllMocks();
    update.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: [{ post_id: 1, token_address: '0x0000000000000000000000000000000000a6b752', channel: '1561344278591045693', coin_name: 'Pepe', coin_symbol: 'PEPE' }], error: null });
  });
  it('saves the exact mirror memo and confirmed message ID', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ token_id: '0.0.10925906', memo: 'Exact ℏ memo', deleted: false })).mockResolvedValueOnce(Response.json({ id: 'discord-message' }));
    vi.stubGlobal('fetch', fetchMock);
    await dispatchDiscordCoin();
    expect(update).toHaveBeenCalledWith({ memo: 'Exact ℏ memo' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', message_id: 'discord-message' }));
    const sendCall = fetchMock.mock.calls[1];
    if (!sendCall) throw new Error('Discord send was not called');
    expect(sendCall[0]).toBe('https://connector-gateway.lovable.dev/discord/channels/1561344278591045693/messages');
    const payload = JSON.parse(sendCall[1].body);
    expect(payload.nonce).toBe('1');
    expect(payload.enforce_nonce).toBe(true);
  });
  it('never repeats a send when no unclaimed token/channel remains', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await dispatchDiscordCoin()).toEqual({ step: 'no new coin' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('leaves an uncertain Discord timeout paused rather than retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ token_id: '0.0.10925906', memo: '', deleted: false })).mockRejectedValueOnce(new Error('Timeout'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(dispatchDiscordCoin()).rejects.toThrow('Timeout');
    expect(update).toHaveBeenCalledWith({ status: 'unknown', last_error: 'Timeout' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('does not send when the on-chain memo is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ token_id: '0.0.10925906' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(dispatchDiscordCoin()).rejects.toThrow('not confirmed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});