import { expect, it } from 'vitest';
import { label } from '../../src/ui/mine/FindsFeed';

it('a bonus find says so after its kind, a normal one does not', () => {
  expect(label('chest', 0, true)).toBe('Chest (bonus)');
  expect(label('gem', 0, true)).toBe('Gem (bonus)');
  expect(label('chest', 0, false)).toBe('Chest');
  expect(label('goldVein', 12, false)).toBe('Gold vein +12');
});

it('a material vein reads as the material and how much', () => {
  expect(label('materialVein', 4, false, 'copper')).toBe('Copper ore ×4');
});
