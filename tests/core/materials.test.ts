import { expect, it } from 'vitest';
import { BAG_SIZE, MATERIAL_STASH_STACK } from '../../src/core/balance';
import { dropItem, moveItem, salvage, sendItem } from '../../src/core/inventory';
import type { MaterialItem } from '../../src/core/items';
import { receiveItem, receiveMaterial, salvageYield } from '../../src/core/loot';
import { newGame } from '../../src/core/newGame';
import type { ItemLoc } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const bagLoc = (index: number): ItemLoc => ({ where: 'bag', index });

it('a found material tops up its bag stack, opens at most one stack, then joins the tab', () => {
  const s = newGame(1, 0);
  receiveMaterial(s, 'copper', 30);
  expect(s.bag[0]).toMatchObject({ type: 'material', material: 'copper', count: 30 });
  receiveMaterial(s, 'copper', 30);
  expect([s.bag[0]?.type === 'material' && s.bag[0].count, s.stash.materials.copper]).toEqual([50, 10]);
  receiveMaterial(s, 'copper', 5);                       // the bag already has a copper stack: no second one
  expect([s.bag.filter((c) => c !== null).length, s.stash.materials.copper]).toEqual([1, 15]);
  receiveMaterial(s, 'tin', 2);
  expect(s.bag[1]).toMatchObject({ material: 'tin', count: 2 });
});

it('a full bag sends found materials to the tab; past the cap they are lost', () => {
  const s = newGame(1, 0);
  for (let i = 0; i < BAG_SIZE; i++) s.bag[i] = gear(s, 'pickaxe');
  s.stash.materials.iron = MATERIAL_STASH_STACK - 3;
  const notes = receiveMaterial(s, 'iron', 10);
  expect(s.stash.materials.iron).toBe(MATERIAL_STASH_STACK);
  expect(notes[0]).toMatchObject({ rarity: 'material', base: 'iron', outcome: 'stash' });
});

it('the note says where the first unit went and how many were found', () => {
  const s = newGame(1, 0);
  expect(receiveMaterial(s, 'silver', 3)).toEqual([
    { name: 'Silver ore', rarity: 'material', base: 'silver', outcome: 'bag', value: 3 },
  ]);
  s.stash.materials.mithril = MATERIAL_STASH_STACK;
  for (let i = 0; i < BAG_SIZE; i++) s.bag[i] ??= gear(s, 'pickaxe');
  expect(receiveMaterial(s, 'mithril', 4)).toEqual([
    { name: 'Mithril', rarity: 'material', base: 'mithril', outcome: 'stash', value: 4 },
  ]);
  expect(s.stash.materials.mithril).toBe(MATERIAL_STASH_STACK);
  const before = s.nextId;
  expect(receiveMaterial(s, 'tin', 0)).toEqual([]);
  expect([s.stash.materials.tin, s.nextId]).toEqual([0, before]);
});

it('a found material larger than a bag stack opens one stack and sends the rest to the tab', () => {
  const s = newGame(1, 0);
  receiveMaterial(s, 'obsidian', 70);
  expect([(s.bag[0] as MaterialItem).count, s.bag[1], s.stash.materials.obsidian]).toEqual([50, null, 20]);
});

it('material stacks move, merge, swap and come out of the tab', () => {
  const s = newGame(1, 0);
  s.bag[0] = { id: s.nextId++, type: 'material', material: 'tin', count: 40 };
  s.bag[1] = { id: s.nextId++, type: 'material', material: 'tin', count: 30 };
  expect(moveItem(s, bagLoc(1), bagLoc(0))).toBe('ok');
  expect([(s.bag[0] as MaterialItem).count, (s.bag[1] as MaterialItem).count]).toEqual([50, 20]);
  expect(moveItem(s, bagLoc(1), { where: 'materials', material: 'tin' })).toBe('ok');
  expect([s.bag[1], s.stash.materials.tin]).toEqual([null, 20]);
  expect(moveItem(s, bagLoc(0), { where: 'materials', material: 'iron' })).toBe('invalid');   // its own slot only
  s.stash.materials.silver = 120;
  expect(sendItem(s, { where: 'materials', material: 'silver' }, 'bag')).toBe('ok');
  expect(s.stash.materials.silver).toBe(70);                                                    // up to 50 taken
  expect(moveItem(s, bagLoc(0), { where: 'stash', index: 0 })).toBe('gearOnly');
  expect(moveItem(s, bagLoc(0), { where: 'gems', gem: 'ruby', grade: 'tiny' })).toBe('gemsOnly');
  s.bag[5] = gem(s);
  expect(moveItem(s, bagLoc(5), { where: 'materials', material: 'tin' })).toBe('materialsOnly');
});

// Plan 7 Task 4: a material dropped on gear crafts with it (crafting.test.ts has the crafts); it used to swap.
it('a material stack dropped on gear crafts instead of swapping, and drags out of the tab onto an empty cell', () => {
  const s = newGame(1, 0);
  const boots = gear(s, 'boots', { rarity: 'normal' });
  s.bag[0] = { id: s.nextId++, type: 'material', material: 'iron', count: 7 };
  s.bag[1] = boots;
  expect(dropItem(s, bagLoc(0), bagLoc(1))).toBe('craftRefused');               // Iron needs a magic or rare item
  expect([s.bag[0]?.type, s.bag[1]]).toEqual(['material', boots]);
  s.stash.materials.copper = 80;
  expect(dropItem(s, { where: 'materials', material: 'copper' }, bagLoc(4))).toBe('ok');
  expect([(s.bag[4] as MaterialItem).count, s.stash.materials.copper]).toEqual([50, 30]);
  expect(dropItem(s, { where: 'materials', material: 'copper' }, bagLoc(1))).toBe('ok');   // onto gear: Copper crafts
  expect([s.bag[1], boots.rarity, s.stash.materials.copper]).toEqual([boots, 'magic', 27]);
  expect(sendItem(s, bagLoc(0), 'stash')).toBe('ok');
  expect([s.bag[0], s.stash.materials.iron]).toEqual([null, 7]);
});

it('salvage gives low-tier materials to the Materials tab, never Diamonds', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4 });
  s.bag[1] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 10, sockets: 1, gems: [{ gem: 'ruby', grade: 'tiny' }] });
  s.bag[2] = gem(s, 'ruby', { count: 4 });
  expect(salvageYield(s.bag[0]!)).toEqual({ copper: 3, tin: 2, iron: 1 });
  expect(salvageYield(s.bag[1]!)).toEqual({ copper: 9, tin: 7, iron: 3 });      // ×3 at ilvl 10, plus 1 tin for the gem
  expect(salvageYield(s.bag[2]!)).toEqual({ tin: 4 });
  expect(salvage(s, bagLoc(0))).toBe('ok');
  expect([s.stash.materials.copper, s.diamonds, s.bag[0]]).toEqual([3, 0, null]);
  s.bag[3] = { id: s.nextId++, type: 'material', material: 'tin', count: 5 };
  expect(salvage(s, bagLoc(3))).toBe('invalid');
});

it('maps and materials yield nothing, and salvage stops at the tab cap', () => {
  const s = newGame(1, 0);
  expect(salvageYield({ id: 1, type: 'map', tier: 3, metre: 40 })).toEqual({});
  expect(salvageYield({ id: 2, type: 'material', material: 'tin', count: 9 })).toEqual({});
  expect(salvageYield(gear(s, 'ring', { rarity: 'legendary', ilvl: 0 }))).toEqual({ tin: 3, iron: 3, silver: 1 });
  s.stash.materials.copper = MATERIAL_STASH_STACK - 1;
  s.bag[0] = gear(s, 'ring', { rarity: 'normal', ilvl: 5 });                     // 2 copper, 1 fits
  expect(salvage(s, bagLoc(0))).toBe('ok');
  expect(s.stash.materials.copper).toBe(MATERIAL_STASH_STACK);
});

it('the loot filter salvages into materials and notes the units', () => {
  const s = newGame(1, 0);
  s.settings.lootFilter = [{ rarity: 'any', target: 'any', action: 'salvage' }];
  const notes = receiveItem(s, gear(s, 'boots', { rarity: 'magic', ilvl: 4 }));
  expect(notes[0]).toMatchObject({ outcome: 'salvaged', value: 3 });
  expect([s.stash.materials.copper, s.stash.materials.tin, s.diamonds]).toEqual([2, 1, 0]);
});
