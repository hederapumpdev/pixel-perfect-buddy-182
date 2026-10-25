import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/solana-daily')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const parsed = z.object({}).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { promoteSolanaDaily } = await import('@/lib/promo.server');
      return Response.json(await promoteSolanaDaily());
    } catch (e) {
      console.error('pump.fun daily promo failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'pump.fun daily promo failed' }, { status: 500 });
    }
  } } },
});
