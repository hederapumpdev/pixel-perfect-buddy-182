import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';
export const Route = createFileRoute('/api/public/jobs/telegram-app')({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    if (!z.object({}).strict().safeParse(await request.json().catch(() => null)).success) return Response.json({ error: 'Invalid body' }, { status: 400 });
    try {
      const { postTelegramApp } = await import('@/lib/telegram.server');
      return Response.json(await postTelegramApp());
    } catch (e) {
      console.error('Telegram app failed', e);
      return Response.json({ error: e instanceof Error ? e.message : 'Telegram failed' }, { status: 500 });
    }
  } } },
});