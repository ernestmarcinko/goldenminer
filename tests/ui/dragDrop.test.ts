import { expect, it } from 'vitest';
import fixture3 from '../fixtures/save-schema-3.txt?raw';
import { decodeSave } from '../../src/core/save';
import type { DropTarget, ItemLoc } from '../../src/core/types';
import {
  clickRoute, DRAG_THRESHOLD_PX, dropAttr, heldLoc, parseDrop, tapAction,
} from '../../src/ui/character/dragDrop';

function migrated() {
  const decoded = decodeSave(fixture3);
  if (!decoded.ok) throw new Error('fixture does not decode');
  return decoded.state;
}

const KINDS: DropTarget[] = [
  { where: 'bag', index: 59 },
  { where: 'stash', index: 119 },
  { where: 'maps', index: 61 },
  { where: 'gems', gem: 'starstone', grade: 'perfect' },
  { where: 'materials', material: 'voidCrystal' },
  { where: 'worn', slot: 'amulet' },
  { where: 'stashTab', tab: 'general' },
  { where: 'stashTab', tab: 'gems' },
  { where: 'stashTab', tab: 'maps' },
  { where: 'stashTab', tab: 'materials' },
  { where: 'stashTab', tab: 'auto' },
];

it('a drag starts after 5 px', () => {
  expect(DRAG_THRESHOLD_PX).toBe(5);
});

it('dropAttr and parseDrop round-trip every kind of drop target', () => {
  for (const t of KINDS) expect(parseDrop(dropAttr(t))).toEqual(t);
});

it('parseDrop refuses anything that is not exactly a drop target', () => {
  expect(parseDrop('{"where":"bag","index":-1}')).toBeNull();
  expect(parseDrop('{"where":"stash","index":-1}')).toBeNull();
  expect(parseDrop('{"where":"maps"}')).toBeNull();
  expect(parseDrop('nope')).toBeNull();
  expect(parseDrop(null)).toBeNull();
});

it('parseDrop checks every value against the game lists and grid sizes', () => {
  expect(parseDrop('{"where":"bag","index":60}')).toBeNull();
  expect(parseDrop('{"where":"bag","index":1.5}')).toBeNull();
  expect(parseDrop('{"where":"bag","index":"1"}')).toBeNull();
  expect(parseDrop('{"where":"stash","index":0.5}')).toBeNull();
  expect(parseDrop('{"where":"maps","index":"3"}')).toBeNull();
  expect(parseDrop('{"where":"materials","material":"gold"}')).toBeNull();
  expect(parseDrop('{"where":"gems","gem":"opal","grade":"tiny"}')).toBeNull();
  expect(parseDrop('{"where":"gems","gem":"ruby","grade":"huge"}')).toBeNull();
  expect(parseDrop('{"where":"worn","slot":"toString"}')).toBeNull();
  expect(parseDrop('{"where":"stashTab","tab":"shop"}')).toBeNull();
  expect(parseDrop('{"where":"elsewhere"}')).toBeNull();
  expect(parseDrop('[]')).toBeNull();
  expect(parseDrop('null')).toBeNull();
  expect(parseDrop('')).toBeNull();
});

it('tapAction follows the tap table', () => {
  const x: ItemLoc = { where: 'bag', index: 3 };
  const y: ItemLoc = { where: 'stash', index: 7 };
  // nothing held: tapping an item lifts it, tapping an empty cell, slot or tab does nothing
  expect(tapAction(null, x, true)).toEqual({ kind: 'hold' });
  expect(tapAction(null, { where: 'bag', index: 4 }, false)).toEqual({ kind: 'none' });
  expect(tapAction(null, { where: 'worn', slot: 'boots' }, false)).toEqual({ kind: 'none' });
  expect(tapAction(null, { where: 'stashTab', tab: 'gems' }, false)).toEqual({ kind: 'none' });
  // X held: tapping X puts it back, anything else is a drop there
  expect(tapAction(x, { where: 'bag', index: 3 }, true)).toEqual({ kind: 'release' });
  expect(tapAction(x, y, true)).toEqual({ kind: 'drop', to: y });
  expect(tapAction(x, { where: 'stashTab', tab: 'auto' }, false))
    .toEqual({ kind: 'drop', to: { where: 'stashTab', tab: 'auto' } });
  expect(tapAction(x, { where: 'worn', slot: 'boots' }, false))
    .toEqual({ kind: 'drop', to: { where: 'worn', slot: 'boots' } });
});

it('a single touch tap never equips, sells or moves: it lifts, or places what is held', () => {
  for (const mods of [{ altKey: false, shiftKey: false }, { altKey: true, shiftKey: false }, { altKey: false, shiftKey: true }]) {
    expect(clickRoute({ ...mods, detail: 1, pointerType: 'touch' }, false)).toEqual({ kind: 'lift' });
    expect(clickRoute({ ...mods, detail: 1, pointerType: 'touch' }, true)).toEqual({ kind: 'tap' });
  }
});

it('a keyboard click opens the card and never lifts, even on a touch screen or with an item held', () => {
  for (const pointerType of ['touch', 'mouse']) {
    for (const holding of [false, true]) {
      expect(clickRoute({ altKey: false, shiftKey: false, detail: 0, pointerType }, holding))
        .toEqual({ kind: 'pick', intent: 'menu' });
    }
  }
});

it('mouse clicks keep their shortcuts, held item or not', () => {
  expect(clickRoute({ altKey: false, shiftKey: false, detail: 1, pointerType: 'mouse' }, true))
    .toEqual({ kind: 'pick', intent: 'primary' });
  expect(clickRoute({ altKey: true, shiftKey: false, detail: 1, pointerType: 'pen' }, false))
    .toEqual({ kind: 'pick', intent: 'sell' });
  expect(clickRoute({ altKey: false, shiftKey: true, detail: 1, pointerType: 'mouse' }, false))
    .toEqual({ kind: 'pick', intent: 'move' });
});

it('a hold lasts only while the lifted item is still where it was', () => {
  const s = migrated();
  const loc: ItemLoc = { where: 'bag', index: 0 };
  const item = s.bag[0];
  if (item === null || item === undefined) throw new Error('fixture bag cell 0 is empty');
  const hold = { loc, id: item.id };
  expect(heldLoc(s, null)).toBeNull();
  expect(heldLoc(s, hold)).toEqual(loc);
  // sold, and new loot took the cell
  s.bag[0] = { ...item, id: s.nextId };
  expect(heldLoc(s, hold)).toBeNull();
  // sold, and the cell stayed empty
  s.bag[0] = null;
  expect(heldLoc(s, hold)).toBeNull();
  // a Gems-tab stack is its slot: it lasts while the count is above 0
  const gems: ItemLoc = { where: 'gems', gem: 'ruby', grade: 'tiny' };
  expect(heldLoc(s, { loc: gems, id: 0 })).toEqual(gems);
  s.stash.gems.ruby.tiny = 0;
  expect(heldLoc(s, { loc: gems, id: 0 })).toBeNull();
});
