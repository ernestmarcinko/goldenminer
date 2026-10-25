import { expect, it } from 'vitest';
import { MAP_TIER_CAP } from '../../src/core/balance';
import { mapTierCount } from '../../src/core/cells';
import { applyTicks } from '../../src/core/dig';
import type { MapItem } from '../../src/core/items';
import { addMap, putMap, startMap, takeMap, takeMapAt } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { stashMap } from '../helpers/items';

const mapOf = (id: number, tier: number, metre = 10): MapItem => ({ id, type: 'map', tier, metre, rarity: 'normal', mods: [] });

it('a map find becomes a map in the bag, and its find notes it', () => {
  const s = newGame(1, 0);
  while (s.deepest < 2) applyTicks(s, 1, deriveStats(s));
  expect(s.stash.maps).toEqual({});
  const map = s.bag.find((c) => c?.type === 'map');
  expect(map).toEqual(expect.objectContaining({ type: 'map', tier: 1, metre: 2 }));
  const find = s.finds.find((f) => f.kind === 'map');
  expect(map?.id).toBeGreaterThan(find?.id ?? Infinity);
  expect(find?.loot).toEqual([{ name: 'Tier 1 map', rarity: 'normal', base: 'map', outcome: 'bag', value: 0 }]);
});

it('putMap appends a map under its own tier, creating the list', () => {
  const s = newGame(1, 0);
  const a = mapOf(s.nextId++, 3);
  const b = mapOf(s.nextId++, 1);
  const c = mapOf(s.nextId++, 3);
  expect([putMap(s, a), putMap(s, b), putMap(s, c)]).toEqual(['ok', 'ok', 'ok']);
  expect(s.stash.maps).toEqual({ 1: [b], 3: [a, c] });
  expect([mapTierCount(s, 3), mapTierCount(s, 1), mapTierCount(s, 2)]).toEqual([2, 1, 0]);
});

it('a full tier refuses a map and changes nothing', () => {
  const s = newGame(1, 0);
  s.stash.maps[4] = Array.from({ length: MAP_TIER_CAP }, () => mapOf(s.nextId++, 4));
  const before = structuredClone(s.stash.maps);
  expect(putMap(s, mapOf(s.nextId++, 4))).toBe('mapTierFull');
  expect(s.stash.maps).toEqual(before);
  expect(putMap(s, mapOf(s.nextId++, 5))).toBe('ok');
});

it('takeMapAt splices a map out, and an emptied tier loses its key', () => {
  const s = newGame(1, 0);
  const [a, b] = [mapOf(s.nextId++, 2), mapOf(s.nextId++, 2)];
  s.stash.maps[2] = [a, b];
  expect(takeMapAt(s, { tier: 2, index: 5 })).toBeUndefined();
  expect(takeMapAt(s, { tier: 7, index: 0 })).toBeUndefined();
  expect(takeMapAt(s, { tier: 2, index: 0 })).toBe(a);
  expect(s.stash.maps).toEqual({ 2: [b] });
  expect(takeMapAt(s, { tier: 2, index: 0 })).toBe(b);
  expect(s.stash.maps).toEqual({});
});

it('takeMap finds a map in the bag or in any tier', () => {
  const s = newGame(1, 0);
  const inBag = mapOf(s.nextId++, 1);
  const deep = mapOf(s.nextId++, 9);
  s.bag[7] = inBag;
  s.stash.maps[3] = [mapOf(s.nextId++, 3)];
  s.stash.maps[9] = [mapOf(s.nextId++, 9), deep];
  expect(takeMap(s, 9999)).toBeUndefined();
  expect(takeMap(s, inBag.id)).toBe(inBag);
  expect(s.bag[7]).toBeNull();
  expect(takeMap(s, deep.id)).toBe(deep);
  expect(s.stash.maps[9]).toHaveLength(1);
});

it('a found map takes the bag\'s first empty cell, is held when the bag is full, and never joins its tier', () => {
  const s = newGame(1, 0);
  s.bag[0] = mapOf(s.nextId++, 1);
  const id = s.nextId;
  expect(addMap(s, 3, 120)).toEqual([{ name: 'Tier 3 map', rarity: 'normal', base: 'map', outcome: 'bag', value: 0 }]);
  expect(s.bag[1]).toEqual({ id, type: 'map', tier: 3, metre: 120, rarity: 'normal', mods: [] });
  expect(s.stash.maps).toEqual({});
  s.bag = s.bag.map((c) => c ?? mapOf(s.nextId++, 1));
  expect(addMap(s, 3, 130).map((n) => n.outcome)).toEqual(['held']);
  expect(s.overflow).toEqual([expect.objectContaining({ type: 'map', tier: 3, metre: 130 })]);
  expect(s.stash.maps).toEqual({});
});

it('maps run from the bag or from a tier list', () => {
  const s = newGame(1, 0);
  const inBag = mapOf(s.nextId++, 1, 2);
  s.bag[4] = inBag;
  expect(startMap(s, 9999)).toBe('invalid');
  expect(startMap(s, inBag.id)).toBe('ok');
  expect(s.bag[4]).toBeNull();
  expect(s.activity.kind === 'map' && s.activity.run.map).toBe(inBag);
  const inTab = stashMap(s, 1, 3);
  expect(startMap(s, inTab.id)).toBe('busy');
  s.activity = { kind: 'dig' };
  expect(startMap(s, inTab.id)).toBe('ok');
  expect(s.activity).toMatchObject({ kind: 'map', run: { map: inTab } });
  expect(s.stash.maps).toEqual({});
});
