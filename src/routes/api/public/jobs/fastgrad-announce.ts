import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/fastgrad-announce')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { announceFeature } = await import('@/lib/promo.server');
      const { fastGradMessages, fastGradSlot } = await import('@/lib/promo-content');
      // Telegram shows the "built on Hedera" card for this one.
      return Response.json(await announceFeature(fastGradSlot, fastGradMessages()));
    } catch (e) {
      console.error('Fast graduation announcement failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Fast graduation announcement failed' }, { status: 500 });
    }
  } } },
});
