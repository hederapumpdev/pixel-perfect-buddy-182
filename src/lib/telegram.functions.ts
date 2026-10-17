import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const startTelegram = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ pin: z.string().max(200), kind: z.enum(['top', 'app']) }).parse(data))
  .handler(async ({ data }) => {
    const pin = process.env['ADMIN_PIN'];
    if (!pin || data.pin.trim() !== pin.trim()) throw new Error('Wrong PIN');
    const { refreshTelegramTop, postTelegramApp } = await import('./telegram.server');
    return data.kind === 'top' ? refreshTelegramTop() : postTelegramApp();
  });