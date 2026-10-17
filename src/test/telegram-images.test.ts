import { describe, expect, it } from 'vitest';
import { telegramImage } from '../lib/telegram-images.server';

describe('Telegram post images', () => {
  it('attaches a JPEG to the top ten post', async () => {
    const image = telegramImage('top');
    expect(image.type).toBe('image/jpeg');
    expect(Array.from(new Uint8Array(await image.arrayBuffer()).slice(0, 2))).toEqual([255, 216]);
  });
  it('uses a different image for each app topic', async () => {
    const images = await Promise.all(Array.from({ length: 6 }, (_, i) => telegramImage('app', i).text()));
    expect(new Set(images).size).toBe(6);
  });
  it('attaches a JPEG to graduation announcements', async () => {
    const image = telegramImage('graduation');
    expect(Array.from(new Uint8Array(await image.arrayBuffer()).slice(0, 2))).toEqual([255, 216]);
  });
});