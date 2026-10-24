import { expect, it } from 'vitest';
import { GEM_STASH_STACK } from '../../src/core/balance';
import { MATERIALS } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import type { GameState, ItemLoc } from '../../src/core/types';
import { craftLabel, craftOptions, craftResultText } from '../../src/ui/character/craftView';
import { gear } from '../helpers/items';

const bag = (index: number): ItemLoc => ({ where: 'bag', index });

function plenty(s: GameState): void {
  for (const m of MATERIALS) s.stash.materials[m] = 100;
  s.diamonds = 100;
}

it('a normal ilvl-4 pickaxe offers Copper, and Mithril it cannot pay for', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 });
  s.bag[1] = { id: s.nextId++, type: 'material', material: 'copper', count: 37 };
  expect(craftOptions(s, bag(0))).toEqual([
    { kind: 'copper', label: 'Copper ore ×3: make it magic', cost: 3, have: 37, enabled: true },
    { kind: 'mithril', label: 'Mithril ×2: reroll its sockets', cost: 2, have: 0, enabled: false },
  ]);
});

it('counts bag stacks and the Materials tab together, and Diamonds from the purse', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, affixes: [{ stat: 'goldYield', value: 6 }] });
  s.bag[1] = { id: s.nextId++, type: 'material', material: 'silver', count: 1 };
  s.bag[2] = { id: s.nextId++, type: 'material', material: 'silver', count: 2 };
  s.stash.materials.silver = 4;
  s.diamonds = 1;
  const opts = craftOptions(s, bag(0));
  expect(opts.map((o) => o.kind)).toEqual(['iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal', 'diamond']);
  expect(opts.find((o) => o.kind === 'silver')).toMatchObject({ have: 7, cost: 2, enabled: true });
  expect(opts.find((o) => o.kind === 'diamond')).toMatchObject({ have: 1, cost: 2, enabled: false });
});

it('a sealed rare offers nothing, and a legendary only Mithril', () => {
  const s = newGame(1, 0);
  plenty(s);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', sealed: true, affixes: [{ stat: 'goldYield', value: 6 }] });
  s.bag[1] = gear(s, 'pickaxe', { rarity: 'legendary', affixes: [{ stat: 'goldYield', value: 6 }] });
  expect(craftOptions(s, bag(0))).toEqual([]);
  expect(craftOptions(s, bag(1)).map((o) => [o.kind, o.enabled])).toEqual([['mithril', true]]);
});

it('Mithril is listed but off when its gems would not fit back in the Gems tab', () => {
  const s = newGame(1, 0);
  plenty(s);
  s.stash.gems.ruby.tiny = GEM_STASH_STACK;
  s.bag[0] = gear(s, 'ring', {
    rarity: 'normal', sockets: 1, gems: [{ gem: 'ruby', grade: 'tiny' }],
  });
  expect(craftOptions(s, bag(0)).find((o) => o.kind === 'mithril')).toMatchObject({ have: 100, enabled: false });
});

it('a non-gear item has no crafts', () => {
  const s = newGame(1, 0);
  plenty(s);
  s.bag[0] = { id: s.nextId++, type: 'material', material: 'copper', count: 3 };
  expect(craftOptions(s, bag(0))).toEqual([]);
  expect(craftOptions(s, bag(5))).toEqual([]);
});

it('every craft label', () => {
  expect(craftLabel('copper', 3)).toBe('Copper ore ×3: make it magic');
  expect(craftLabel('tin', 2)).toBe('Tin ore ×2: reroll its modifiers');
  expect(craftLabel('iron', 2)).toBe('Iron ore ×2: add a modifier');
  expect(craftLabel('silver', 2)).toBe('Silver ore ×2: reroll its modifiers');
  expect(craftLabel('mithril', 2)).toBe('Mithril ×2: reroll its sockets');
  expect(craftLabel('starsteel', 2)).toBe('Starsteel ×2: reroll its values');
  expect(craftLabel('obsidian', 1)).toBe('Obsidian shard ×1: remove a modifier');
  expect(craftLabel('voidCrystal', 1)).toBe('Void crystal ×1: temper it (risky)');
  expect(craftLabel('diamond', 1200)).toBe('Diamonds ×1,200: add a modifier');
});

it('every craft result text', () => {
  expect(craftResultText({ check: 'ok' })).toBeNull();
  expect(craftResultText({ check: 'ok', temper: 'craftedLine' })).toBe('Tempered: it gained a crafted line.');
  expect(craftResultText({ check: 'ok', temper: 'raiseTiers' })).toBe('Tempered: every line rose a tier.');
  expect(craftResultText({ check: 'ok', temper: 'nothing' })).toBe('Tempered: nothing changed.');
  expect(craftResultText({ check: 'ok', temper: 'ruin' })).toBe('Tempered: it was ruined, every line fell to tier 1.');
  expect(craftResultText({ check: 'sealed' })).toBe("It was tempered and can't be crafted any more.");
  expect(craftResultText({ check: 'legendary' })).toBe("Legendary lines can't be changed.");
  expect(craftResultText({ check: 'wrongRarity' })).toBe("That doesn't work on this item.");
  expect(craftResultText({ check: 'noRoom' })).toBe('It has no room for another modifier.');
  expect(craftResultText({ check: 'nothingToChange' })).toBe('It has no modifiers to change.');
  expect(craftResultText({ check: 'short' })).toBe('Not enough of that material.');
  expect(craftResultText({ check: 'gemsFull' })).toBe('Make room in the Gems tab first.');
  expect(craftResultText({ check: 'notGear' })).toBe('Only gear can be crafted.');
});
