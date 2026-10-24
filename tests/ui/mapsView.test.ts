import { expect, it } from 'vitest';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import { decodeSave } from '../../src/core/save';
import type { MapItem, RunOutcome } from '../../src/core/types';
import { newGame } from '../../src/core/newGame';
import { gainsLine, mapDungeon, mapRows, runTitle, xpBar } from '../../src/ui/maps/mapsView';

const map = (id: number, tier: number, metre = 1): MapItem => ({ id, type: 'map', tier, metre });

it('xp bar', () => {
  expect(xpBar(1, 50)).toEqual({ label: 'Level 1', text: '50 / 100 XP', pct: 0.5 });
  expect(xpBar(60, 0)).toEqual({ label: 'Level 60', text: 'Max level', pct: 1 });
  expect(xpBar(30, 1234).text).toBe('1,234 / 16,432 XP');
  expect(xpBar(1, 0)).toEqual({ label: 'Level 1', text: '0 / 100 XP', pct: 0 });
  // the last xp below a level stays short of a full bar
  expect(xpBar(1, 99).text).toBe('99 / 100 XP');
  expect(xpBar(1, 99).pct).toBeCloseTo(0.99);
});

it('run results in words', () => {
  const g = { xp: 200, souls: 5, gold: 40, levels: 1 };
  const r = (outcome: RunOutcome, room: number) => ({ map: map(1, 1), outcome, room, bossRoom: 6, gained: g, items: 2, seen: false });
  expect(runTitle(r('cleared', 6))).toBe('Map cleared!');
  expect(runTitle(r('died', 3))).toBe('You fell in room 3');
  expect(runTitle(r('died', 6))).toBe('You fell in the boss room');
  expect(runTitle(r('left', 2))).toBe('You left the map in room 2');
  expect(runTitle(r('left', 6))).toBe('You left the map in the boss room');
  expect(gainsLine(g, 2)).toBe('+200 XP · +5 Souls · +40 Gold · 2 items · +1 level');
  expect(gainsLine({ ...g, levels: 0 }, 1)).toBe('+200 XP · +5 Souls · +40 Gold · 1 item');
});

it('every map is a row: highest tier first, then name, then id, with where it lies', () => {
  const state = newGame(9090, 0);
  state.bag[3] = map(40, 2, 4);
  state.stash.maps[61] = map(30, 5, 7);
  state.stash.maps[0] = map(20, 5, 7);
  state.stash.maps[1] = map(10, 5, 3);
  const rows = mapRows(state);

  expect(rows).toHaveLength(4);
  const names = rows.slice(0, 3).map((r) => r.name);
  expect(rows.map((r) => r.tier)).toEqual([5, 5, 5, 2]);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  // the same dungeon (same metre) falls back to the lower id first
  const same = rows.filter((r) => r.metre === 7);
  expect(same.map((r) => r.id)).toEqual([20, 30]);
  expect(rows[3]).toMatchObject({ id: 40, tier: 2, metre: 4, where: 'bag', page: 0 });
  expect(rows.find((r) => r.id === 30)).toMatchObject({ where: 'maps', page: 2 });
  expect(rows.find((r) => r.id === 20)).toMatchObject({ where: 'maps', page: 1 });
  for (const r of rows) {
    const src = [...state.bag, ...state.stash.maps].find((c) => c?.id === r.id) as MapItem;
    const d = mapDungeon(state.seed, src);
    expect(r).toMatchObject({ name: d.type.name, rooms: d.type.rooms });
  }
});

it('a state with no maps has no rows', () => {
  expect(mapRows(newGame(9090, 0))).toEqual([]);
});

it('the maps of the schema-4 fixture are all rows', () => {
  const decoded = decodeSave(fixture4);
  if (!decoded.ok) throw new Error('fixture does not decode');
  const rows = mapRows(decoded.state);
  expect(rows).toHaveLength(21);
  const tiers = rows.map((r) => r.tier);
  expect(tiers).toEqual([...tiers].sort((a, b) => b - a));
});
