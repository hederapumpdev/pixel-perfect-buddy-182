import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/contest-announce')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { announceContest } = await import('@/lib/promo.server');
      return Response.json(await announceContest());
    } catch (e) {
      console.error('Contest announcement failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Contest announcement failed' }, { status: 500 });
    }
  } } },
});
