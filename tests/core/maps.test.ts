import { expect, it } from 'vitest';
import { MAP_STASH_SIZE } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import { addMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';

it('a map find becomes a map in the stash', () => {
  const s = newGame(1, 0);
  while (s.deepest < 2) applyTicks(s, 1, deriveStats(s));
  expect(s.stash.maps).toEqual([expect.objectContaining({ type: 'map', tier: 1, metre: 2 })]);
  expect(s.stash.maps[0]?.id).toBeGreaterThan(s.finds.find((f) => f.kind === 'map')?.id ?? Infinity);
});

it('a full Maps tab drops its lowest-tier, oldest map', () => {
  const s = newGame(1, 0);
  for (let i = 0; i < MAP_STASH_SIZE; i++) addMap(s, i < 2 ? 1 : 3, 10 + i);
  const firstLow = s.stash.maps[0]?.id;
  addMap(s, 2, 999);
  expect(s.stash.maps).toHaveLength(MAP_STASH_SIZE);
  expect(s.stash.maps.some((m) => m.id === firstLow)).toBe(false);
  expect(s.stash.maps.filter((m) => m.tier === 1)).toHaveLength(1);
  const kept = addMap(s, 1, 5);
  expect(s.stash.maps.some((m) => m.id === kept.id)).toBe(false);   // strictly the lowest: not kept
  expect(s.stash.maps).toHaveLength(MAP_STASH_SIZE);
});
