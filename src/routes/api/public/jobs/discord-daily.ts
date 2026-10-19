import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/discord-daily')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { mirrorDailyToDiscord } = await import('@/lib/promo.server');
      return Response.json(await mirrorDailyToDiscord());
    } catch (e) {
      console.error('Discord daily mirror failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Discord daily mirror failed' }, { status: 500 });
    }
  } } },
});
