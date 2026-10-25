import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/hedex-thanks')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { announceFeature } = await import('@/lib/promo.server');
      const { hedexThanksMessages, hedexThanksSlot } = await import('@/lib/promo-content');
      return Response.json(await announceFeature(hedexThanksSlot, hedexThanksMessages()));
    } catch (e) {
      console.error('Hedex shoutout post failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Hedex shoutout post failed' }, { status: 500 });
    }
  } } },
});
