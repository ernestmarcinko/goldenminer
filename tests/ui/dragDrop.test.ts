import { expect, it } from 'vitest';
import type { DropTarget, ItemLoc } from '../../src/core/types';
import { DRAG_THRESHOLD_PX, dropAttr, parseDrop, tapAction } from '../../src/ui/character/dragDrop';

const KINDS: DropTarget[] = [
  { where: 'bag', set: 'battle', index: 23 },
  { where: 'stash', index: 59 },
  { where: 'gems', gem: 'starstone', grade: 'perfect' },
  { where: 'worn', slot: 'amulet' },
  { where: 'stashTab', tab: 'general' },
  { where: 'stashTab', tab: 'gems' },
  { where: 'stashTab', tab: 'auto' },
];

it('a drag starts after 5 px', () => {
  expect(DRAG_THRESHOLD_PX).toBe(5);
});

it('dropAttr and parseDrop round-trip every kind of drop target', () => {
  for (const t of KINDS) expect(parseDrop(dropAttr(t))).toEqual(t);
});

it('parseDrop refuses anything that is not exactly a drop target', () => {
  expect(parseDrop('{"where":"bag","set":"magic","index":1}')).toBeNull();
  expect(parseDrop('{"where":"stash","index":-1}')).toBeNull();
  expect(parseDrop('nope')).toBeNull();
  expect(parseDrop(null)).toBeNull();
});

it('parseDrop checks every value against the game lists and grid sizes', () => {
  expect(parseDrop('{"where":"bag","set":"mining","index":24}')).toBeNull();
  expect(parseDrop('{"where":"bag","set":"mining","index":1.5}')).toBeNull();
  expect(parseDrop('{"where":"bag","set":"mining","index":"1"}')).toBeNull();
  expect(parseDrop('{"where":"stash","index":60}')).toBeNull();
  expect(parseDrop('{"where":"gems","gem":"opal","grade":"tiny"}')).toBeNull();
  expect(parseDrop('{"where":"gems","gem":"ruby","grade":"huge"}')).toBeNull();
  expect(parseDrop('{"where":"worn","slot":"toString"}')).toBeNull();
  expect(parseDrop('{"where":"stashTab","tab":"maps"}')).toBeNull();
  expect(parseDrop('{"where":"elsewhere"}')).toBeNull();
  expect(parseDrop('[]')).toBeNull();
  expect(parseDrop('null')).toBeNull();
  expect(parseDrop('')).toBeNull();
});

it('tapAction follows the tap table', () => {
  const x: ItemLoc = { where: 'bag', set: 'mining', index: 3 };
  const y: ItemLoc = { where: 'stash', index: 7 };
  // nothing held: tapping an item lifts it, tapping an empty cell, slot or tab does nothing
  expect(tapAction(null, x, true)).toEqual({ kind: 'hold' });
  expect(tapAction(null, { where: 'bag', set: 'mining', index: 4 }, false)).toEqual({ kind: 'none' });
  expect(tapAction(null, { where: 'worn', slot: 'boots' }, false)).toEqual({ kind: 'none' });
  expect(tapAction(null, { where: 'stashTab', tab: 'gems' }, false)).toEqual({ kind: 'none' });
  // X held: tapping X puts it back, anything else is a drop there
  expect(tapAction(x, { where: 'bag', set: 'mining', index: 3 }, true)).toEqual({ kind: 'release' });
  expect(tapAction(x, y, true)).toEqual({ kind: 'drop', to: y });
  expect(tapAction(x, { where: 'stashTab', tab: 'auto' }, false))
    .toEqual({ kind: 'drop', to: { where: 'stashTab', tab: 'auto' } });
  expect(tapAction(x, { where: 'worn', slot: 'boots' }, false))
    .toEqual({ kind: 'drop', to: { where: 'worn', slot: 'boots' } });
});
