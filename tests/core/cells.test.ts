import { expect, it } from 'vitest';
import { emptyInventory, filledCount, firstEmpty } from '../../src/core/cells';
import { gemGradeFor, gemName } from '../../src/core/itemData';
import { gemEffect } from '../../src/core/stats';
import { salvageValue, sellValue } from '../../src/core/loot';

it('gems come in five grades by tier', () => {
  expect([0, 1, 3, 4, 6, 7, 9, 10, 14, 15, 40].map(gemGradeFor)).toEqual(
    ['tiny', 'tiny', 'tiny', 'small', 'small', 'big', 'big', 'giant', 'giant', 'perfect', 'perfect']);
  expect(gemName({ gem: 'starstone', grade: 'giant' })).toBe('Giant Starstone');
  expect((['tiny', 'small', 'big', 'giant', 'perfect'] as const).map((grade) => gemEffect({ gem: 'starstone', grade }, 'mining').value))
    .toEqual([6, 12, 18, 26, 38]);
  expect(sellValue({ id: 1, type: 'gem', gem: 'ruby', grade: 'big', count: 3 })).toBe(480);
  expect(salvageValue({ id: 1, type: 'gem', gem: 'ruby', grade: 'perfect', count: 2 })).toBe(16);
});

it('an empty inventory is fixed grids', () => {
  const inv = emptyInventory();
  expect([inv.bags.mining.length, inv.bags.battle.length, inv.stash.general.length]).toEqual([24, 24, 60]);
  expect(inv.stash.gems.ruby).toEqual({ tiny: 0, small: 0, big: 0, giant: 0, perfect: 0 });
  expect([firstEmpty(inv.bags.mining), filledCount(inv.bags.mining), firstEmpty([{ id: 1, type: 'gem', gem: 'ruby', grade: 'tiny', count: 1 }])])
    .toEqual([0, 0, -1]);
});
