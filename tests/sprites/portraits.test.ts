import { expect, it } from 'vitest';
import { GRIDS, PALETTE, PALETTE_OVERRIDES } from '../../src/sprites/grids';

const PORTRAITS = ['brannoc', 'mirela'] as const;

it('draws both merchants as 16 × 24 grids in their palette', () => {
  for (const n of PORTRAITS) {
    const rows = GRIDS[n];
    expect(rows, n).toHaveLength(24);
    for (const r of rows) expect(r, n).toHaveLength(16);
    const pal = { ...PALETTE, ...(PALETTE_OVERRIDES[n] ?? {}) };
    for (const ch of rows.join('')) if (ch !== '.') expect(pal[ch], `${n}:${ch}`).toBeDefined();
  }
});

it('tells the two apart at a glance, each in at least 5 colours', () => {
  const a = GRIDS.brannoc.join('');
  const b = GRIDS.mirela.join('');
  let differ = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differ++;
  expect(differ / a.length).toBeGreaterThanOrEqual(0.4);
  for (const n of PORTRAITS) {
    const pal = { ...PALETTE, ...(PALETTE_OVERRIDES[n] ?? {}) };
    const colours = new Set([...GRIDS[n].join('')].filter((ch) => ch !== '.').map((ch) => pal[ch]));
    expect(colours.size, n).toBeGreaterThanOrEqual(5);
  }
});
