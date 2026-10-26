import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import fixture8 from '../fixtures/save-schema-8.txt?raw';
import { decodeSave } from '../../src/core/save';
import { MATERIALS } from '../../src/core/items';
import type { MapItem } from '../../src/core/items';
import { putMap } from '../../src/core/maps';
import { itemAt } from '../../src/core/cells';
import { newGame } from '../../src/core/newGame';
import {
  bagHeading, buyLabel, GRADE_HEADERS, gemTabRows, gridCapacity, mapTierCaption, mapTierCells, mapTiers, materialTabCells, pageCells,
  pickTier, runeTabCells, STASH_TABS, tabLabel,
} from '../../src/ui/character/stashView';

function migrated() {
  const decoded = decodeSave(fixture3);
  if (!decoded.ok) throw new Error('fixture does not decode');
  return decoded.state;
}

function schema8() {
  const decoded = decodeSave(fixture8.trim());
  if (!decoded.ok) throw new Error('fixture does not decode');
  return decoded.state;
}

it('the Gems tab has a row per gem and a cell per grade, with compact counts', () => {
  const rows = gemTabRows(migrated());
  expect(rows).toHaveLength(5);
  expect(rows[0]).toEqual({
    gem: 'ruby',
    label: 'Ruby',
    cells: [
      { grade: 'tiny', count: 3, text: '3' },
      { grade: 'small', count: 0, text: '' },
      { grade: 'big', count: 0, text: '' },
      { grade: 'giant', count: 0, text: '' },
      { grade: 'perfect', count: 0, text: '' },
    ],
  });
  expect(GRADE_HEADERS).toEqual(['Tiny', 'Small', 'Big', 'Giant', 'Perfect']);
});

it('counts above a thousand are shortened', () => {
  const s = migrated();
  s.stash.gems.sapphire.big = 1240;
  const sapphire = gemTabRows(s).find((r) => r.gem === 'sapphire');
  expect(sapphire?.cells[2]).toEqual({ grade: 'big', count: 1240, text: '1.2K' });
});

it('tab labels show the General fill and the Map stash total, and the other tabs just their name', () => {
  const s = migrated();
  expect(STASH_TABS).toEqual(['general', 'gems', 'runes', 'maps', 'materials', 'orbs']);
  expect(tabLabel(s, 'general')).toBe('General 5 / 120');
  expect(tabLabel(s, 'gems')).toBe('Gems');
  expect(tabLabel(s, 'runes')).toBe('Runes');
  expect(tabLabel(s, 'maps')).toBe(`Maps ${Object.values(s.stash.maps).flat().length}`);
  expect(tabLabel(s, 'materials')).toBe('Materials');
  expect(tabLabel(s, 'orbs')).toBe('Orbs');
  const fresh = newGame(1, 0);
  expect(tabLabel(fresh, 'general')).toBe('General 0 / 120');
  expect(tabLabel(fresh, 'maps')).toBe('Maps 0');
  const map = (id: number, tier: number) => ({ id, type: 'map' as const, tier, metre: 2, rarity: 'normal' as const, mods: [] });
  fresh.stash.maps = { 1: Array.from({ length: 5 }, (_, i) => map(i + 1, 1)), 4: Array.from({ length: 7 }, (_, i) => map(i + 10, 4)) };
  expect(tabLabel(fresh, 'maps')).toBe('Maps 12');
});

it('a page is its 60 cells, counted from page 0', () => {
  expect(pageCells(Array.from({ length: 120 }, (_, i) => i), 1)).toEqual(Array.from({ length: 60 }, (_, i) => 60 + i));
  expect(pageCells(Array.from({ length: 120 }, (_, i) => i), 0)).toHaveLength(60);
});

it('the buy button names the next page and its price, and whether the Gold is there', () => {
  const s = newGame(1, 0);
  expect(buyLabel(s)).toEqual({ text: '+ Page 3 · 5,000 Gold', affordable: false });
  s.gold = 5000;
  expect(buyLabel(s).affordable).toBe(true);
  s.stash.bought.general = 1;
  s.stash.general = Array.from({ length: 180 }, () => null);
  expect(buyLabel(s)).toEqual({ text: '+ Page 4 · 20,000 Gold', affordable: false });
});

it('the Materials tab has one cell per material, in order, with compact counts', () => {
  const s = migrated();
  s.stash.materials.tin = 7;
  s.stash.materials.voidCrystal = 2500;
  const cells = materialTabCells(s);
  expect(cells.map((c) => c.material)).toEqual([...MATERIALS]);
  expect(cells[0]).toEqual({ material: 'copper', label: 'Copper ore', count: 0, text: '' });
  expect(cells[1]).toEqual({ material: 'tin', label: 'Tin ore', count: 7, text: '7' });
  expect(cells[7]).toEqual({ material: 'voidCrystal', label: 'Void crystal', count: 2500, text: '2.5K' });
});

it('the Runes tab has one cell per kind, in catalogue order, with compact counts', () => {
  const s = newGame(1, 0);
  s.stash.runes.fehu = 3;
  s.stash.runes.isa = 2500;
  const cells = runeTabCells(s);
  expect(cells).toHaveLength(10);
  expect(cells.map((c) => c.rune)).toEqual(['fehu', 'uruz', 'thurisaz', 'ansuz', 'raidho', 'kenaz', 'gebo', 'wunjo', 'hagalaz', 'isa']);
  expect(cells[0]).toEqual({ rune: 'fehu', label: 'Fehu', count: 3, text: '3' });
  expect(cells[9]).toEqual({ rune: 'isa', label: 'Isa', count: 2500, text: '2.5K' });
});

it('the Maps tab has a chip per tier it holds, lowest first, with its count', () => {
  const s = schema8();
  expect(mapTiers(s)).toEqual([
    { tier: 1, count: 2, label: 'T1 · 2' },
    { tier: 2, count: 1, label: 'T2 · 1' },
    { tier: 3, count: 4, label: 'T3 · 4' },
    { tier: 4, count: 3, label: 'T4 · 3' },
  ]);
  expect(mapTiers(newGame(1, 0))).toEqual([]);
  expect(tabLabel(s, 'maps')).toBe('Maps 10');
});

it('a tier\'s maps show rare first, then magic, then normal, each newest first, with where each lies', () => {
  const s = schema8();
  const cells = mapTierCells(s, 1);
  const list = s.stash.maps[1] ?? [];
  expect(cells.map((c) => c.item.rarity)).toEqual(['rare', 'rare']);
  expect(cells[0]?.item.id).toBeGreaterThan(cells[1]?.item.id ?? Infinity);
  for (const c of cells) {
    expect(c.loc).toEqual({ where: 'maps', tier: 1, index: list.indexOf(c.item) });
    expect(itemAt(s, c.loc)).toBe(c.item);
  }
  const plain: MapItem = { id: s.nextId++, type: 'map', tier: 1, metre: 3, rarity: 'normal', mods: [] };
  const magic: MapItem = { id: 1, type: 'map', tier: 1, metre: 3, rarity: 'magic', mods: [] };
  expect([putMap(s, plain), putMap(s, magic)]).toEqual(['ok', 'ok']);
  const after = mapTierCells(s, 1);
  expect(after.map((c) => c.item.rarity)).toEqual(['rare', 'rare', 'magic', 'normal']);
  expect(after.at(-1)).toEqual({ item: plain, loc: { where: 'maps', tier: 1, index: 2 } });
  expect(mapTierCells(s, 9)).toEqual([]);
});

it('the Maps tab caption names the tier, its count and its room', () => {
  expect(mapTierCaption(4, 12)).toBe('Tier 4 maps · 12 / 200');
});

it('the shown tier stays while it holds maps, else the highest tier, else none', () => {
  expect(pickTier([1, 3], 3)).toBe(3);
  expect(pickTier([1, 3], 2)).toBe(3);
  expect(pickTier([1, 3], null)).toBe(3);
  expect(pickTier([1, 3], 1)).toBe(1);
  expect(pickTier([], 2)).toBeNull();
});

it('a grid shows its items in whole rows of ten, never under one row', () => {
  expect(gridCapacity(0)).toBe(10);
  expect(gridCapacity(10)).toBe(10);
  expect(gridCapacity(11)).toBe(20);
  expect(gridCapacity(200)).toBe(200);
});

it('the bag heading names the held finds only when there are any', () => {
  const s = schema8();
  expect(s.overflow).toHaveLength(4);
  expect(bagHeading(s)).toEqual({ filled: '60 / 60', held: '· 4 held' });
  s.overflow = [];
  s.bag[3] = null;
  expect(bagHeading(s)).toEqual({ filled: '59 / 60', held: null });
});
