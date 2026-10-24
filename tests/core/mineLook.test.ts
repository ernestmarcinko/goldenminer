import { expect, it } from 'vitest';
import { bandAt } from '../../src/core/bands';
import { bandLook, bandTitle, DEEP_ADJECTIVES, DEEP_NOUNS, wallTile } from '../../src/core/mineLook';

const g2 = (seed: number) => ({ seed, gen: 2 as const });

it('named bands keep their names; deep bands are generated in generation 2 only', () => {
  expect(bandTitle(g2(1), bandAt(10))).toBe('Topsoil');
  expect(bandTitle({ seed: 1, gen: 1 }, bandAt(1000))).toBe('The Abyss I');
  const deep = bandTitle(g2(1), bandAt(1000));
  expect(deep).toMatch(/^The [A-Z][a-z]+ [A-Z][a-z]+$/);
  expect(bandTitle(g2(1), bandAt(1299))).toBe(deep);
  expect(bandTitle(g2(1), bandAt(1300))).not.toBe(undefined);
  const titles = new Set(Array.from({ length: 20 }, (_, i) => bandTitle(g2(i + 1), bandAt(1000))));
  expect(titles.size).toBeGreaterThan(8);
});

it('looks are fixed by the seed', () => {
  expect(bandLook(g2(5), bandAt(10))).toEqual({ palette: ['#5a4030', '#4e3828', '#614634', '#553b2b'], details: ['root', 'pebble'] });
  const deep = bandLook(g2(5), bandAt(2000));
  expect(deep.palette.every((c) => c.startsWith('hsl('))).toBe(true);
  expect(new Set(deep.details).size).toBe(2);
  expect(bandLook(g2(5), bandAt(2000))).toEqual(deep);
  expect(wallTile(g2(5), 40, 0, 2)).toEqual(wallTile(g2(5), 40, 0, 2));
  expect(wallTile(g2(5), 40, 0, 2)).not.toEqual(wallTile(g2(6), 40, 0, 2));
});

it('wall details are rare and belong to their band', () => {
  let tiles = 0;
  let details = 0;
  for (let m = 1; m <= 1000; m++) for (const side of [0, 1] as const) for (let c = 0; c < 4; c++) {
    tiles++;
    const t = wallTile(g2(9), m, side, c);
    if (t.detail) { details++; expect(bandLook(g2(9), bandAt(m - 1)).details).toContain(t.detail); }
  }
  expect(details / tiles).toBeGreaterThan(0.045);
  expect(details / tiles).toBeLessThan(0.075);
});

it('neighbouring deep bands are not chained together', () => {
  const words = (t: string) => t.split(' ');
  let chained = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = words(bandTitle(g2(seed), bandAt(1000 + 300 * 3)));
    const b = words(bandTitle(g2(seed), bandAt(1000 + 300 * 4)));
    if (b[1] === DEEP_ADJECTIVES[DEEP_NOUNS.indexOf(a[2] ?? '')]) chained++;
  }
  expect(chained).toBeLessThan(10);
});
