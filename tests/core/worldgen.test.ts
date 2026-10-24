import { expect, it } from 'vitest';
import { BASE_ROLL_CHANCES } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import { fillAhead, rollMetre } from '../../src/core/metres';
import { newGame } from '../../src/core/newGame';
import { seedFromText } from '../../src/core/seed';
import { deriveStats } from '../../src/core/stats';
import { gear } from '../helpers/items';

const world = (lootSeed: number) => newGame(seedFromText('golden mole'), 0, { seedText: 'golden mole', lootSeed });
const finder = (s: ReturnType<typeof world>) => {
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: 900 }, { stat: 'mapFind', value: 300 }] });
};

it('find gear never changes what a metre holds in generation 2', () => {
  const plain = world(1);
  const geared = world(2);
  finder(geared);
  const sp = deriveStats(plain);
  const sg = deriveStats(geared);
  while (plain.deepest < 60) applyTicks(plain, 1, sp);
  while (geared.deepest < 60) applyTicks(geared, 1, sg);
  const seeded = (s: typeof plain) => s.finds.filter((f) => !f.bonus).map((f) => [f.depth, f.kind]);
  expect(seeded(geared)).toEqual(seeded(plain));
  expect(geared.finds.filter((f) => f.bonus).length).toBeGreaterThan(0);
  expect(plain.finds.some((f) => f.bonus)).toBe(false);
  for (const f of geared.finds.filter((x) => x.bonus)) {
    expect(rollMetre(geared.seed, f.depth, BASE_ROLL_CHANCES).feature).toBeNull();
    expect(['chest', 'gem', 'map']).toContain(f.kind);
  }
});

it('generation 1 keeps gear-dependent rolls; generation 2 ignores gear', () => {
  const chestShare = (gen: 1 | 2) => {
    const s = world(1);
    s.worldGen = gen;
    finder(s);
    const stats = deriveStats(s);
    let chests = 0;
    for (let m = 0; m < 500; m++) {
      s.deepest = m; s.depth = m; s.ahead = {};
      fillAhead(s, stats);
      if (s.ahead[m + 1]?.feature === 'chest') chests++;
    }
    return chests / 500;
  };
  expect(chestShare(1)).toBeGreaterThan(0.4);
  expect(chestShare(2)).toBeLessThan(0.1);
});

it('bonus chances come only from find gear and respect the cap', () => {
  const s = world(1);
  expect(deriveStats(s).bonusChances).toEqual({ chest: 0, gem: 0, map: 0 });
  finder(s);
  const b = deriveStats(s).bonusChances;
  expect(b.gem).toBe(0);
  expect(b.chest + b.map + 0.28).toBeCloseTo(0.9);
});
