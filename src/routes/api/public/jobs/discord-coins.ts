import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/discord-coins')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { dispatchDiscordCoin } = await import('@/lib/discord.server');
      return Response.json(await dispatchDiscordCoin());
    } catch (e) {
      console.error('Discord coin notification failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Discord failed' }, { status: 500 });
    }
  } } },
});