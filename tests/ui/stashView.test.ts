import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import { decodeSave } from '../../src/core/save';
import { MATERIALS } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { buyLabel, GRADE_HEADERS, gemTabRows, materialTabCells, pageCells, STASH_TABS, tabLabel } from '../../src/ui/character/stashView';

function migrated() {
  const decoded = decodeSave(fixture3);
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
  expect(STASH_TABS).toEqual(['general', 'gems', 'maps', 'materials']);
  expect(tabLabel(s, 'general')).toBe('General 5 / 120');
  expect(tabLabel(s, 'gems')).toBe('Gems');
  expect(tabLabel(s, 'maps')).toBe(`Maps ${Object.values(s.stash.maps).flat().length}`);
  expect(tabLabel(s, 'materials')).toBe('Materials');
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
