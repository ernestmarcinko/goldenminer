import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import { decodeSave } from '../../src/core/save';
import { MATERIALS } from '../../src/core/items';
import { GRADE_HEADERS, gemTabRows, materialTabCells, STASH_TABS, tabLabel } from '../../src/ui/character/stashView';

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

it('tab labels show the General fill, and the other tabs just their name', () => {
  const s = migrated();
  expect(STASH_TABS).toEqual(['general', 'gems', 'maps', 'materials']);
  expect(tabLabel(s, 'general')).toBe('General 5 / 120');
  expect(tabLabel(s, 'gems')).toBe('Gems');
  expect(tabLabel(s, 'maps')).toBe('Maps');
  expect(tabLabel(s, 'materials')).toBe('Materials');
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
