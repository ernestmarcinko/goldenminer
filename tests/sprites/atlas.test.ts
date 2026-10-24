import { expect, it } from 'vitest';
import { GRIDS, PALETTE, PALETTE_OVERRIDES } from '../../src/sprites/grids';
import { layoutAtlas, spriteStyle, type SpriteName } from '../../src/sprites/atlas';

const names = Object.keys(GRIDS) as SpriteName[];

it('every grid is rectangular and uses known colours', () => {
  for (const n of names) {
    const rows = GRIDS[n];
    expect(new Set(rows.map((r) => r.length)).size, n).toBe(1);
    const pal = { ...PALETTE, ...(PALETTE_OVERRIDES[n] ?? {}) };
    for (const ch of rows.join('')) if (ch !== '.') expect(pal[ch], `${n}:${ch}`).toBeDefined();
  }
  expect(GRIDS.miner).toHaveLength(20);
  expect(GRIDS.miner[0]).toHaveLength(16);
  expect(GRIDS.ruby).toEqual(GRIDS.gem);
  for (const g of ['sapphire', 'emerald', 'amethyst', 'starstone'] as const) expect(GRIDS[g]).toEqual(GRIDS.gem);
});

it('packs frames without overlap', () => {
  const sizes = Object.fromEntries(names.map((n) => [n, { w: GRIDS[n][0]!.length, h: GRIDS[n].length }])) as Record<SpriteName, { w: number; h: number }>;
  const { width, frames } = layoutAtlas(sizes);
  expect(width).toBeLessThanOrEqual(256);
  const list = Object.values(frames);
  for (const a of list) for (const b of list) if (a !== b) {
    const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    expect(apart).toBe(true);
  }
});

it('scales a frame by whole pixels', () => {
  const atlas = { imageUrl: 'x.png', width: 100, height: 50, frames: { coin: { x: 10, y: 4, w: 8, h: 8 } } } as never;
  expect(spriteStyle(atlas, 'coin', 3)).toEqual({
    width: '24px', height: '24px', backgroundImage: 'url("x.png")',
    backgroundPosition: '-30px -12px', backgroundSize: '300px 150px', imageRendering: 'pixelated',
  });
});
