import { expect, it } from 'vitest';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import { decodeSave } from '../../src/core/save';
import type { MapItem, RunOutcome } from '../../src/core/types';
import { gainsLine, mapGroups, runTitle, xpBar } from '../../src/ui/maps/mapsView';

const map = (id: number, tier: number, metre = 1): MapItem => ({ id, type: 'map', tier, metre });

it('xp bar', () => {
  expect(xpBar(1, 50)).toEqual({ label: 'Level 1', text: '50 / 100 XP', pct: 0.5 });
  expect(xpBar(60, 0)).toEqual({ label: 'Level 60', text: 'Max level', pct: 1 });
  expect(xpBar(30, 1234).text).toBe('1,234 / 16,432 XP');
  expect(xpBar(1, 500)).toEqual({ label: 'Level 1', text: '500 / 100 XP', pct: 1 });
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

it('maps of the schema-4 fixture group by dungeon, the same metre in one row', () => {
  const decoded = decodeSave(fixture4);
  if (!decoded.ok) throw new Error('fixture does not decode');
  const { seed, stash } = decoded.state;
  const groups = mapGroups(seed, stash.maps);

  expect(stash.maps).toHaveLength(21);
  expect(groups.reduce((n, g) => n + g.maps.reduce((c, m) => c + m.count, 0), 0)).toBe(21);
  const tiers = groups.map((g) => g.tier);
  expect(tiers).toEqual([...tiers].sort((a, b) => b - a));
  expect(groups[0]?.tier).toBe(3);
  expect(groups[0]?.name).toBe('The Gloaming Halls');
  expect(groups[0]?.maps.find((m) => m.metre === 214)).toMatchObject({ rooms: 7, count: 14 });
  // the 14 maps found at metre 214 are one row of one dungeon
  const crowded = groups.flatMap((g) => g.maps).filter((m) => m.metre === 214);
  expect(crowded).toHaveLength(1);
  for (const g of groups) expect(g.maps.length).toBeLessThanOrEqual(g.maps.reduce((c, m) => c + m.count, 0));
});

it('groups order by tier then name, rows by their oldest map, and the same metre collapses', () => {
  // seed 9090: metres 1, 3, 2 open the dungeons 0, 1, 2; metres 3 and 5 both open dungeon 1, metres 7 and 4 both dungeon 2
  const maps = [
    map(5, 1, 5), map(13, 20, 2), map(4, 2, 4), map(10, 1, 1), map(2, 2, 7), map(8, 1, 3), map(11, 20, 1),
    map(9, 2, 4), map(12, 1, 3), map(7, 2, 3), map(3, 2, 1), map(1, 1, 3), map(6, 1, 2),
  ];
  const groups = mapGroups(9090, maps);
  expect(groups.map((g) => `T${g.tier} ${g.name}`)).toEqual([
    'T20 Grimhold Vaults', 'T20 Irongate Depths',
    'T2 Slatereach Kilns', 'T2 The Crumbling Pits', 'T2 The Drowned Mudworks',
    'T1 Mirevein Burrows', 'T1 The Smouldering Hollows', 'T1 The Whispering Warrens',
  ]);
  expect(groups.map((g) => g.key)).toEqual(['20:2', '20:0', '2:0', '2:2', '2:1', '1:0', '1:1', '1:2']);
  expect(groups.map((g) => g.maps.map((m) => m.rooms))).toEqual([[4], [7], [4], [7, 7], [5], [4], [4, 4], [7]]);
  // 3 maps at one metre and 1 at another; the oldest map of a metre stands for it
  expect(groups[6]?.maps).toMatchObject([{ id: 1, metre: 3, count: 3 }, { id: 5, metre: 5, count: 1 }]);
  // the order is by the oldest id, not by metre
  expect(groups[3]?.maps).toMatchObject([{ id: 2, metre: 7, count: 1 }, { id: 4, metre: 4, count: 2 }]);
  expect(groups).toHaveLength(8);
});
