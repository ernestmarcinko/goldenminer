import { expect, it } from 'vitest';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import { decodeSave } from '../../src/core/save';
import type { MapItem, RunOutcome } from '../../src/core/types';
import { newGame } from '../../src/core/newGame';
import { gainsLine, mapCount, mapDungeon, mapRows, runTitle, xpBar } from '../../src/ui/maps/mapsView';

const map = (id: number, tier: number, metre = 1): MapItem => ({ id, type: 'map', tier, metre, rarity: 'normal', mods: [] });

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
  // two metres opening dungeons whose names differ; `early` sorts before `late`
  const nameAt = (metre: number): string => mapDungeon(state.seed, { tier: 5, metre }).type.name;
  const first = 1;
  const other = Array.from({ length: 40 }, (_, i) => i + 1).find((m) => nameAt(m) !== nameAt(first));
  if (other === undefined) throw new Error('no second dungeon found');
  const [early, late] = nameAt(first).localeCompare(nameAt(other)) < 0 ? [first, other] : [other, first];

  state.bag[3] = map(40, 2, 4);
  // the lowest id lies in the dungeon that sorts last, so name order and id order disagree
  state.stash.maps[0] = map(10, 5, late);
  state.stash.maps[61] = map(30, 5, early);
  state.stash.maps[1] = map(20, 5, early);
  const rows = mapRows(state);

  expect(rows.map((r) => r.id)).toEqual([20, 30, 10, 40]);
  expect(rows.map((r) => r.tier)).toEqual([5, 5, 5, 2]);
  expect(rows.slice(0, 3).map((r) => r.name)).toEqual([nameAt(early), nameAt(early), nameAt(late)]);
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

it('the map count covers the bag and the Maps tab, as the Maps screen lists them', () => {
  const state = newGame(9090, 0);
  expect(mapCount(state)).toBe(0);
  state.bag[0] = map(1, 1);
  state.bag[1] = map(2, 2);
  state.stash.maps[0] = map(3, 1);
  expect(mapCount(state)).toBe(3);
  expect(mapCount(state)).toBe(mapRows(state).length);
});

it('an enchanted map\'s row carries its rarity, its modifiers and what they pay; a normal map\'s row has none', () => {
  const state = newGame(9090, 0);
  state.bag[0] = map(1, 4, 7);
  state.stash.maps[0] = { ...map(2, 3, 9), rarity: 'rare', mods: [
    { kind: 'monsterLife', tier: 4, value: 27 },
    { kind: 'monsterDamage', tier: 3, value: 17 },
    { kind: 'weakHealing', tier: 2, value: 16 },
  ] };
  const [plain, rare] = mapRows(state);
  expect(plain).toEqual({
    id: 1, name: mapDungeon(state.seed, { tier: 4, metre: 7 }).type.name, tier: 4, metre: 7,
    rooms: mapDungeon(state.seed, { tier: 4, metre: 7 }).type.rooms, where: 'bag', page: 0,
    rarity: 'normal', mods: [], rewards: '',
  });
  expect(rare).toMatchObject({
    id: 2, rarity: 'rare',
    mods: ['T4 Monsters have +27% life', 'T3 Monsters deal +17% damage', 'T2 Rooms heal 16% less'],
    rewards: 'Rewards: +30% items · +18% rarity · +30% Souls',
  });
});
