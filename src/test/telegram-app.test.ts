import { expect, it } from 'vitest';
import { telegramAppSlot } from '../lib/telegram-app-content';
it('posts app updates at 10, 15 and 20 Amsterdam time, not outside those hours', () => {
  expect(telegramAppSlot(new Date('2026-10-17T08:00:00Z'))).toBe('2026-10-17-10');
  expect(telegramAppSlot(new Date('2026-10-17T13:00:00Z'))).toBe('2026-10-17-15');
  expect(telegramAppSlot(new Date('2026-10-17T18:00:00Z'))).toBe('2026-10-17-20');
  expect(telegramAppSlot(new Date('2026-10-17T01:00:00Z'))).toBeNull();
});