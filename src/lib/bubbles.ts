// Bubble-map layout for a coin's holders. Pure and deterministic so it is testable:
// bubble area is proportional to the balance (radius scales with sqrt), bubbles are
// placed on a phyllotaxis spiral and then scaled to fit the view box.

export type HolderRow = { who: string; amt: number };
export type Bubble = { who: string; amt: number; pct: number; x: number; y: number; r: number };

export const BUBBLE_VIEW = { w: 600, h: 420, pad: 8 } as const;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
const MAX_R = 95;
const MIN_R = 14;
const SPREAD = 52;

/**
 * Lay out holder bubbles, biggest first, centered in BUBBLE_VIEW.
 * Radius grows with sqrt(amount) so bubble area matches the balance share.
 */
export function layoutBubbles(rows: HolderRow[], supply: number): Bubble[] {
  const list = rows
    .filter((r) => r.amt > 0)
    .slice()
    .sort((a, b) => b.amt - a.amt)
    .slice(0, 40);
  if (!list.length || !(supply > 0)) return [];

  const maxAmt = list[0]!.amt;
  const raw = list.map((row, i) => {
    const r = Math.max(MIN_R, MAX_R * Math.sqrt(row.amt / maxAmt));
    const angle = i * GOLDEN_ANGLE;
    const dist = SPREAD * Math.sqrt(i);
    return {
      who: row.who,
      amt: row.amt,
      pct: (row.amt / supply) * 100,
      r,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    };
  });

  // Fit the whole cluster (including radii) inside the view box.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of raw) {
    minX = Math.min(minX, b.x - b.r);
    maxX = Math.max(maxX, b.x + b.r);
    minY = Math.min(minY, b.y - b.r);
    maxY = Math.max(maxY, b.y + b.r);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(
    (BUBBLE_VIEW.w - BUBBLE_VIEW.pad * 2) / spanX,
    (BUBBLE_VIEW.h - BUBBLE_VIEW.pad * 2) / spanY,
    1, // never blow small clusters up beyond natural size
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return raw.map((b) => ({
    who: b.who,
    amt: b.amt,
    pct: b.pct,
    r: b.r * scale,
    x: BUBBLE_VIEW.w / 2 + (b.x - cx) * scale,
    y: BUBBLE_VIEW.h / 2 + (b.y - cy) * scale,
  }));
}
