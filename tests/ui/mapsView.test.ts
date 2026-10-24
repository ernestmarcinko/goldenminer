import { expect, it } from 'vitest';
import fixture4 from '../fixtures/save-schema-4.txt?raw';
import { decodeSave } from '../../src/core/save';
import type { MapItem, RunOutcome } from '../../src/core/types';
import { gainsLine, mapGroups, runTitle, xpBar } from '../../src/ui/maps/mapsView';

const map = (id: number, tier: number): MapItem => ({ id, type: 'map', tier, metre: 1 });

it('xp bar', () => {
  expect(xpBar(1, 50)).toEqual({ label: 'Level 1', text: '50 / 100 XP', pct: 0.5 });
  expect(xpBar(60, 0)).toEqual({ label: 'Level 60', text: 'Max level', pct: 1 });
  expect(xpBar(30, 1234).text).toBe('1,234 / 16,432 XP');
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

it('maps group by tier and dungeon, the highest tier first, oldest map first', () => {
  const decoded = decodeSave(fixture4);
  if (!decoded.ok) throw new Error('fixture does not decode');
  const { seed, stash } = decoded.state;
  const groups = mapGroups(seed, stash.maps);

  expect(stash.maps).toHaveLength(21);
  expect(groups.reduce((n, g) => n + g.maps.length, 0)).toBe(21);
  const tiers = groups.map((g) => g.tier);
  expect(tiers).toEqual([...tiers].sort((a, b) => b - a));
  expect(groups[0]?.tier).toBe(3);
  // the 14 maps found at metre 214 are one dungeon of one tier
  const crowded = groups.filter((g) => g.maps.some((m) => m.metre === 214));
  expect(crowded).toHaveLength(1);
  expect(crowded[0]?.maps.filter((m) => m.metre === 214)).toHaveLength(14);
  for (const g of groups) {
    expect(g.key).toMatch(/^\d+:[012]$/);
    expect(g.name).not.toBe('');
    const ids = g.maps.map((m) => m.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    for (const m of g.maps) expect(m.rooms).toBe(g.maps[0]?.rooms);
  }
});
