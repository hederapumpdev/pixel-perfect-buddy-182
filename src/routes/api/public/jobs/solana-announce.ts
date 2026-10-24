import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/solana-announce')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { announceFeature } = await import('@/lib/promo.server');
      const { solanaMessages, solanaSlot } = await import('@/lib/promo-content');
      return Response.json(await announceFeature(solanaSlot, solanaMessages()));
    } catch (e) {
      console.error('Solana announcement post failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Solana announcement post failed' }, { status: 500 });
    }
  } } },
});
