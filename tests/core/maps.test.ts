import { expect, it } from 'vitest';
import { STASH_PAGE_SIZE } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import type { MapItem } from '../../src/core/items';
import { addMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';

const mapOf = (id: number, tier: number, metre = 10): MapItem => ({ id, type: 'map', tier, metre, rarity: 'normal', mods: [] });

it('a map find becomes a map in the stash', () => {
  const s = newGame(1, 0);
  while (s.deepest < 2) applyTicks(s, 1, deriveStats(s));
  expect(s.stash.maps[0]).toEqual(expect.objectContaining({ type: 'map', tier: 1, metre: 2 }));
  expect(s.stash.maps.slice(1).every((m) => m === null)).toBe(true);
  expect(s.stash.maps[0]?.id).toBeGreaterThan(s.finds.find((f) => f.kind === 'map')?.id ?? Infinity);
});

it('a found map takes the first empty Maps-tab cell', () => {
  const s = newGame(1, 0);
  const a = addMap(s, 3, 120);
  expect(s.stash.maps[0]).toBe(a);
  const b = addMap(s, 1, 4);
  expect(s.stash.maps[1]).toBe(b);
  s.stash.maps[0] = null;
  expect(addMap(s, 2, 9)).toBe(s.stash.maps[0]);
});

it('a full Maps tab drops its lowest-tier, oldest map, never one in the bag', () => {
  const s = newGame(1, 0);
  s.stash.maps = s.stash.maps.map((_, i) => mapOf(s.nextId++, i === 7 ? 2 : 3));
  const inBag = mapOf(s.nextId++, 1);
  s.bag[0] = inBag;
  const kept = addMap(s, 3, 500);
  expect(s.stash.maps[7]).toBe(kept);
  expect(s.bag[0]).toBe(inBag);
  expect(s.stash.maps).toHaveLength(STASH_PAGE_SIZE);
  const before = structuredClone(s.stash.maps);
  const next = s.nextId;
  const dropped = addMap(s, 2, 500);   // every tab map is tier 3
  expect(s.stash.maps).toEqual(before);
  expect(dropped.id).toBe(next);
  expect(s.nextId).toBe(next + 1);
});

it('on a tie the oldest of the lowest-tier maps goes, wherever it sits', () => {
  const s = newGame(1, 0);
  s.stash.maps = s.stash.maps.map((_, i) => mapOf(100 + i, 3));
  s.nextId = 400;
  s.stash.maps[40] = mapOf(300, 1);
  s.stash.maps[10] = mapOf(320, 1);   // newer, though in an earlier cell
  const kept = addMap(s, 1, 5);
  expect(s.stash.maps[40]).toBe(kept);
  expect(s.stash.maps[10]?.id).toBe(320);
});

it('maps run from the bag or the Maps tab', () => {
  const s = newGame(1, 0);
  const inBag = mapOf(s.nextId++, 1, 2);
  s.bag[4] = inBag;
  expect(startMap(s, 9999)).toBe('invalid');
  expect(startMap(s, inBag.id)).toBe('ok');
  expect(s.bag[4]).toBeNull();
  expect(s.activity.kind === 'map' && s.activity.run.map).toBe(inBag);
  const inTab = addMap(s, 1, 3);
  expect(startMap(s, inTab.id)).toBe('busy');
  s.activity = { kind: 'dig' };
  const at = s.stash.maps.indexOf(inTab);
  expect(startMap(s, inTab.id)).toBe('ok');
  expect(s.stash.maps[at]).toBeNull();
});
