import { expect, it } from 'vitest';
import { emptyInventory, filledCount, firstEmpty, pageCount } from '../../src/core/cells';
import { gemGradeFor, gemName } from '../../src/core/itemData';
import { gemEffect } from '../../src/core/stats';
import { salvageYield, sellValue } from '../../src/core/loot';

it('gems come in five grades by tier', () => {
  expect([0, 1, 3, 4, 6, 7, 9, 10, 14, 15, 40].map(gemGradeFor)).toEqual(
    ['tiny', 'tiny', 'tiny', 'small', 'small', 'big', 'big', 'giant', 'giant', 'perfect', 'perfect']);
  expect(gemName({ gem: 'starstone', grade: 'giant' })).toBe('Giant Starstone');
  expect((['tiny', 'small', 'big', 'giant', 'perfect'] as const).map((grade) => gemEffect({ gem: 'starstone', grade }, 'mining').value))
    .toEqual([5, 11, 17, 25, 37]);
  expect(sellValue({ id: 1, type: 'gem', gem: 'ruby', grade: 'big', count: 3 })).toBe(480);
  expect(salvageYield({ id: 1, type: 'gem', gem: 'ruby', grade: 'perfect', count: 2 })).toEqual({ tin: 8 });
});

it('an empty inventory is one bag, the free General pages and an empty Map stash', () => {
  const inv = emptyInventory();
  expect([inv.bag.length, inv.stash.general.length, inv.stash.maps]).toEqual([60, 120, {}]);
  expect(pageCount(inv.stash.general)).toBe(2);
  expect(inv.stash.gems.ruby).toEqual({ tiny: 0, small: 0, big: 0, giant: 0, perfect: 0 });
  expect(Object.values(inv.stash.materials)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  expect(inv.stash.bought).toEqual({ general: 0 });
  expect([firstEmpty(inv.bag), filledCount(inv.bag), firstEmpty([{ id: 1, type: 'gem', gem: 'ruby', grade: 'tiny', count: 1 }])])
    .toEqual([0, 0, -1]);
});
