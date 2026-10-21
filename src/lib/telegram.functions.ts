import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const startTelegram = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ pin: z.string().max(200), kind: z.enum(['top', 'app']) }).parse(data))
  .handler(async ({ data }) => {
    await (await import("./admin-auth.server")).requireAdmin(data.pin);
    const { refreshTelegramTop, postTelegramApp } = await import('./telegram.server');
    return data.kind === 'top' ? refreshTelegramTop() : postTelegramApp();
  });