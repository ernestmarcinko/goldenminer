import { expect, it } from 'vitest';
import { gateIndex, gateWall, isGateTier } from '../../src/core/gates';
import { seedFromText } from '../../src/core/seed';

it('every fifth tier from 5 is a gate', () => {
  for (const tier of [5, 10, 50, 100, 105]) expect(isGateTier(tier), `tier ${tier}`).toBe(true);
  for (const tier of [0, 1, 4, 6, 99]) expect(isGateTier(tier), `tier ${tier}`).toBe(false);
  expect([5, 10, 15, 105].map(gateIndex)).toEqual([1, 2, 3, 21]);
  expect([0, 7, 99].map(gateIndex)).toEqual([0, 0, 0]);
});

it('a tier that is not a gate has no wall', () => {
  for (const seed of [1, 2, 3]) expect(gateWall(seed, 7)).toBeUndefined();
});

it('each pair of gates has one physical wall and one elemental wall, in either order across seeds', () => {
  let physicalFirst = 0;
  let elementalFirst = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const [a, b] of [[5, 10], [15, 20], [25, 30]] as const) {
      const walls = [gateWall(seed, a), gateWall(seed, b)];
      expect([...walls].sort(), `seed ${seed} gates ${a},${b}`).toEqual(['elemental', 'physical']);
    }
    if (gateWall(seed, 5) === 'physical') physicalFirst++;
    else elementalFirst++;
  }
  expect(physicalFirst).toBeGreaterThan(0);
  expect(elementalFirst).toBeGreaterThan(0);
});

it('the wall is a pure function of the seed and the tier', () => {
  const seed = seedFromText('amber-fox-427');
  expect(gateWall(seed, 5)).toBe(gateWall(seed, 5));
  expect(gateWall(seed, 5)).toBe('physical');
});
