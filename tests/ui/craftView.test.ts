import { expect, it } from 'vitest';
import { GEM_STASH_STACK } from '../../src/core/balance';
import { MATERIALS } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import type { MapItem, MapMod } from '../../src/core/items';
import type { GameState, ItemLoc } from '../../src/core/types';
import { craftLabel, craftOptions, craftResultText } from '../../src/ui/character/craftView';
import { gear } from '../helpers/items';

const bag = (index: number): ItemLoc => ({ where: 'bag', index });

function plenty(s: GameState): void {
  for (const m of MATERIALS) s.stash.materials[m] = 100;
  s.diamonds = 100;
}

it('a normal ilvl-4 pickaxe offers makeMagic, and Mithril it cannot pay for', () => {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 });
  s.diamonds = 2;
  expect(craftOptions(s, bag(0))).toEqual([
    { kind: 'makeMagic', label: 'Diamonds ×2: make it magic', cost: 2, souls: 0, have: 2, enabled: true },
    { kind: 'mithril', label: 'Mithril ×2: reroll its sockets', cost: 2, souls: 0, have: 0, enabled: false },
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
  expect(opts.map((o) => o.kind)).toEqual(['silver', 'mithril', 'voidCrystal', 'diamond']);
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
  expect(craftLabel('makeMagic', 2, 0, 'gear')).toBe('Diamonds ×2: make it magic');
  expect(craftLabel('makeRare', 3, 0, 'gear')).toBe('Diamonds ×3: make it rare');
  expect(craftLabel('tin', 2, 0, 'gear')).toBe('Tin ore ×2: reroll its modifiers');
  expect(craftLabel('silver', 2, 0, 'gear')).toBe('Silver ore ×2: reroll its modifiers');
  expect(craftLabel('mithril', 2, 0, 'gear')).toBe('Mithril ×2: reroll its sockets');
  expect(craftLabel('voidCrystal', 1, 0, 'gear')).toBe('Void crystal ×1: temper it (risky)');
  expect(craftLabel('diamond', 1200, 0, 'gear')).toBe('Diamonds ×1,200: add a modifier');
  for (const kind of ['copper', 'iron', 'starsteel', 'obsidian'] as const) expect(() => craftLabel(kind, 1, 0, 'gear')).toThrow();
});

it('every craft result text', () => {
  expect(craftResultText({ check: 'ok' }, 'gear')).toBeNull();
  expect(craftResultText({ check: 'ok', temper: 'craftedLine' }, 'gear')).toBe('Tempered: it gained a crafted line.');
  expect(craftResultText({ check: 'ok', temper: 'raiseTiers' }, 'gear')).toBe('Tempered: every line rose a tier.');
  expect(craftResultText({ check: 'ok', temper: 'nothing' }, 'gear')).toBe('Tempered: nothing changed.');
  expect(craftResultText({ check: 'ok', temper: 'ruin' }, 'gear')).toBe('Tempered: it was ruined, every line fell to tier 1.');
  expect(craftResultText({ check: 'sealed' }, 'gear')).toBe("It was tempered and can't be crafted any more.");
  expect(craftResultText({ check: 'legendary' }, 'gear')).toBe("Legendary lines can't be changed.");
  expect(craftResultText({ check: 'wrongRarity' }, 'gear')).toBe("That doesn't work on this item.");
  expect(craftResultText({ check: 'noRoom' }, 'gear')).toBe('It has no room for another modifier.');
  expect(craftResultText({ check: 'nothingToChange' }, 'gear')).toBe('It has no modifiers to change.');
  expect(craftResultText({ check: 'short' }, 'gear')).toBe('Not enough of that material.');
  expect(craftResultText({ check: 'gemsFull' }, 'gear')).toBe('Make room in the Gems tab first.');
  expect(craftResultText({ check: 'notGear' }, 'gear')).toBe('Only gear and maps can be crafted.');
});

const map = (s: GameState, rarity: MapItem['rarity'], mods: MapMod[] = [], sealed?: true): MapItem => (
  { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity, mods, ...(sealed ? { sealed } : {}) }
);
const mods = (n: number): MapMod[] => (
  ['monsterLife', 'monsterDamage', 'monsterSpeed', 'bossPower', 'weakHealing', 'hardened'] as const
).slice(0, n).map((kind) => ({ kind, tier: 1, value: 10 }));

it('a normal tier-4 map offers only makeMagic, for its Souls', () => {
  const s = newGame(1, 0);
  s.bag[0] = map(s, 'normal');
  s.souls = 50;
  expect(craftOptions(s, bag(0))).toEqual([
    { kind: 'makeMagic', label: '20 Souls: make it magic', cost: 0, souls: 20, have: 50, enabled: true },
  ]);
  plenty(s);
  expect(craftOptions(s, bag(0)).map((o) => o.kind)).toEqual(['makeMagic']);
});

it('a map upgrade is off with too few Souls', () => {
  const s = newGame(1, 0);
  const inTab = map(s, 'normal');
  s.stash.maps[inTab.tier] = [inTab];
  const tab: ItemLoc = { where: 'maps', tier: inTab.tier, index: 0 };
  s.souls = 19;
  expect(craftOptions(s, tab)).toMatchObject([{ kind: 'makeMagic', souls: 20, enabled: false }]);
  s.souls = 20;
  expect(craftOptions(s, tab)).toMatchObject([{ kind: 'makeMagic', enabled: true }]);
});

it('a magic map offers makeRare; a rare one no further upgrade', () => {
  const s = newGame(1, 0);
  plenty(s);
  s.souls = 1000;
  s.bag[0] = map(s, 'magic', mods(2));
  s.bag[1] = map(s, 'rare', mods(4));
  s.bag[2] = map(s, 'rare', mods(6));
  expect(craftOptions(s, bag(0)).map((o) => o.kind)).toEqual(['makeRare']);
  expect(craftOptions(s, bag(1)).map((o) => o.kind)).toEqual([]);
  expect(craftOptions(s, bag(2)).map((o) => o.kind)).toEqual([]);
  expect(craftOptions(s, bag(0)).every((o) => o.souls === 40 && o.enabled)).toBe(true);
});

it('a sealed map offers nothing', () => {
  const s = newGame(1, 0);
  plenty(s);
  s.souls = 1000;
  s.bag[0] = map(s, 'rare', mods(4), true);
  expect(craftOptions(s, bag(0))).toEqual([]);
});

it('every map craft label', () => {
  expect(craftLabel('makeMagic', 0, 20, 'map')).toBe('20 Souls: make it magic');
  expect(craftLabel('makeRare', 0, 40, 'map')).toBe('40 Souls: make it rare');
  for (const kind of ['copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal', 'diamond'] as const) {
    expect(() => craftLabel(kind, 1, 20, 'map')).toThrow();
  }
});

it('every map craft result text, and the new refusals', () => {
  expect(craftResultText({ check: 'notForMaps' }, 'map')).toBe("That material doesn't work on maps.");
  expect(craftResultText({ check: 'noSouls' }, 'map')).toBe('Not enough Souls.');
  expect(craftResultText({ check: 'ok' }, 'map')).toBeNull();
  expect(craftResultText({ check: 'sealed' }, 'map')).toBe("It was tempered and can't be enchanted any more.");
  expect(craftResultText({ check: 'wrongRarity' }, 'map')).toBe("That doesn't work on this item.");
  expect(craftResultText({ check: 'noRoom' }, 'map')).toBe('It has no room for another modifier.');
  expect(craftResultText({ check: 'nothingToChange' }, 'map')).toBe('It has no modifiers to change.');
  expect(craftResultText({ check: 'short' }, 'map')).toBe('Not enough of that material.');
  expect(craftResultText({ check: 'notForMaps' }, 'gear')).toBe("That material doesn't work on maps.");
  expect(craftResultText({ check: 'noSouls' }, 'gear')).toBe('Not enough Souls.');
});
