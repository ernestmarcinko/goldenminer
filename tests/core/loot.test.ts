import { describe, expect, it } from 'vitest';
import { LOOT_NOTES_KEPT, MAX_HELD } from '../../src/core/balance';
import { filledCount } from '../../src/core/cells';
import { applyTicks } from '../../src/core/dig';
import { itemName } from '../../src/core/itemData';
import { salvage, sell } from '../../src/core/inventory';
import {
  drainOverflow, lootAction, receiveItem, receiveMaterial, salvagePay, salvageYield, sellPay, sellValue,
} from '../../src/core/loot';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
import type { MapItem, MaterialItem } from '../../src/core/items';
import type { GameState, LootRule } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const stats = deriveStats(newGame(1, 0));

// Bag: 60 rare boots (150 Gold each). Stash: 120 rare gloves (150) except index 7, a normal pair (25).
function fill(s: GameState) {
  s.bag = s.bag.map(() => gear(s, 'boots', { rarity: 'rare', ilvl: 5 }));
  s.stash.general = s.stash.general.map((_, i) => gear(s, 'gloves', { rarity: i === 7 ? 'normal' : 'rare', ilvl: 5 }));
}

it('sell and salvage values', () => {
  const s = newGame(1, 0);
  expect(sellValue(gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 }))).toBe(48);
  expect(sellValue(gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, sockets: 1, gems: [gem(s, 'ruby')] }))).toBe(160);
  expect(salvageYield(gear(s, 'ring', { rarity: 'rare', ilvl: 10 }))).toEqual({ copper: 9, tin: 6, iron: 3 });
  expect(salvageYield(gem(s, 'ruby'))).toEqual({ tin: 1 });
});

it('a map sells for 25 × tier² Gold, × 1.5 if magic and × 2.5 if rare', () => {
  const s = newGame(1, 0);
  const map = (tier: number, rarity: MapItem['rarity']): MapItem => ({ id: s.nextId++, type: 'map', tier, metre: 10, rarity, mods: [] });
  expect([sellValue(map(4, 'normal')), sellValue(map(4, 'magic')), sellValue(map(4, 'rare')), sellValue(map(3, 'magic'))])
    .toEqual([400, 600, 1000, 338]);
});

it('the first matching rule decides, and nothing matching keeps', () => {
  const s = newGame(1, 0);
  const rules: LootRule[] = [
    { rarity: 'legendary', target: 'any', action: 'keep' },
    { rarity: 'any', target: 'battle', action: 'salvage' },
    { rarity: 'normal', target: 'any', action: 'sell' },
    { rarity: 'any', target: 'gem', action: 'sell' },
  ];
  expect(lootAction(rules, gear(s, 'ring', { rarity: 'legendary' }))).toBe('keep');
  expect(lootAction(rules, gear(s, 'ring', { rarity: 'normal' }))).toBe('salvage');
  expect(lootAction(rules, gear(s, 'pickaxe', { rarity: 'normal' }))).toBe('sell');
  expect(lootAction(rules, gear(s, 'pickaxe', { rarity: 'magic' }))).toBe('keep');
  expect(lootAction(rules, gem(s))).toBe('sell');
  expect(lootAction([{ rarity: 'normal', target: 'any', action: 'sell' }], gem(s))).toBe('keep');
  expect(lootAction([{ rarity: 'any', target: 'lamp', action: 'sell' }], gear(s, 'lamp'))).toBe('sell');
});

it('the filter sells and salvages before anything is stowed', () => {
  const s = newGame(1, 0);
  s.settings.lootFilter = [
    { rarity: 'normal', target: 'any', action: 'sell' },
    { rarity: 'magic', target: 'any', action: 'salvage' },
  ];
  receiveItem(s, gear(s, 'boots', { rarity: 'normal', ilvl: 3 }));
  receiveItem(s, gear(s, 'boots', { rarity: 'magic', ilvl: 3 }));
  expect([s.gold, s.diamonds, s.stash.materials.copper, s.stash.materials.tin, filledCount(s.bag)]).toEqual([15, 0, 2, 1, 0]);
  expect(s.lootTally).toEqual({ kept: 0, sold: 1, salvaged: 1 });
});

it('kept items go to the bag, then are held', () => {
  const s = newGame(1, 0);
  expect(receiveItem(s, gear(s, 'weapon')).map((n) => n.outcome)).toEqual(['bag']);
  expect(receiveItem(s, gear(s, 'pickaxe')).map((n) => n.outcome)).toEqual(['bag']);
  expect(filledCount(s.bag)).toBe(2);
  s.bag = s.bag.map((c) => c ?? gear(s, 'boots'));
  const pick = gear(s, 'pickaxe');
  expect(receiveItem(s, pick).map((n) => n.outcome)).toEqual(['held']);
  expect([filledCount(s.stash.general), s.overflow]).toEqual([0, [pick]]);
});

const mapOf = (s: GameState, tier: number, rarity: MapItem['rarity'] = 'normal'): MapItem => (
  { id: s.nextId++, type: 'map', tier, metre: 10, rarity, mods: [] }
);
const ore = (s: GameState, count: number, material: MaterialItem['material'] = 'copper'): MaterialItem => (
  { id: s.nextId++, type: 'material', material, count }
);
const fullBag = (s: GameState): void => { s.bag = s.bag.map(() => gear(s, 'boots')); };

describe('every find goes to the bag', () => {
  it('a found map goes to the bag\'s first empty cell, never to the stash', () => {
    const s = newGame(1, 0);
    s.bag[0] = gear(s, 'boots');
    const map = mapOf(s, 4);
    expect(receiveItem(s, map)).toEqual([{ name: 'Tier 4 map', rarity: 'normal', base: 'map', outcome: 'bag', value: 0 }]);
    expect(s.bag[1]).toBe(map);
    expect(s.stash.maps).toEqual({});
  });

  it('a found gem tops up bag stacks, then opens one new cell, and the rest is held', () => {
    const s = newGame(1, 0);
    fullBag(s);
    for (const i of [4, 9, 30]) s.bag[i] = gem(s, 'ruby', { count: 24 });
    const found = gem(s, 'ruby', { count: 10 });
    expect(receiveItem(s, found)).toEqual([expect.objectContaining({ outcome: 'bag' })]);
    expect([4, 9, 30].map((i) => s.bag[i]?.type === 'gem' && s.bag[i].count)).toEqual([25, 25, 25]);
    expect(s.overflow).toEqual([{ ...found, count: 7 }]);

    // one new cell only: a second empty cell stays empty, and the held rest takes a fresh id
    const t = newGame(1, 0);
    fullBag(t);
    t.bag[2] = null;
    t.bag[3] = null;
    const big = gem(t, 'emerald', { count: 30 });
    const next = t.nextId;
    expect(receiveItem(t, big)).toEqual([expect.objectContaining({ outcome: 'bag' })]);
    expect([t.bag[2], t.bag[3]]).toEqual([{ ...big, count: 25 }, null]);
    expect(t.overflow).toEqual([{ ...big, id: next, count: 5 }]);
  });

  it('a found material fills existing stacks, then new cells, and the rest is held as a stack', () => {
    const s = newGame(1, 0);
    fullBag(s);
    const copper = ore(s, 40);
    s.bag[7] = copper;
    s.bag[20] = null;
    s.bag[41] = null;
    expect(receiveMaterial(s, 'copper', 130)).toEqual([
      { name: 'Copper ore', rarity: 'material', base: 'copper', outcome: 'bag', value: 130 },
    ]);
    expect([7, 20, 41].map((i) => s.bag[i])).toEqual([
      copper, expect.objectContaining({ type: 'material', material: 'copper', count: 50 }),
      expect.objectContaining({ type: 'material', material: 'copper', count: 50 }),
    ]);
    expect(copper.count).toBe(50);
    expect(s.overflow).toEqual([expect.objectContaining({ type: 'material', material: 'copper', count: 20 })]);
    expect(s.stash.materials.copper).toBe(0);
    expect(validateState(s)).toBe(true);
  });

  it('with the bag full, any find is held, up to 60', () => {
    const s = newGame(1, 0);
    fullBag(s);
    const ring = gear(s, 'ring');
    const ruby = gem(s, 'ruby', { count: 3 });
    const map = mapOf(s, 2);
    expect([
      ...receiveItem(s, ring), ...receiveItem(s, ruby), ...receiveItem(s, map), ...receiveMaterial(s, 'tin', 12),
    ].map((n) => n.outcome)).toEqual(['held', 'held', 'held', 'held']);
    expect(s.overflow).toEqual([ring, ruby, map, expect.objectContaining({ type: 'material', material: 'tin', count: 12 })]);
    while (s.overflow.length < MAX_HELD) receiveItem(s, gear(s, 'boots'));
    expect(s.overflow).toHaveLength(MAX_HELD);
    expect(validateState(s)).toBe(true);
  });

  it('past 60 held, gear, gems and maps are sold and materials go to the Materials tab', () => {
    const s = newGame(1, 0);
    fullBag(s);
    for (let i = 0; i < MAX_HELD; i++) s.overflow.push(gear(s, 'boots'));
    const held = structuredClone(s.overflow);
    expect(receiveItem(s, mapOf(s, 4))).toEqual([{ name: 'Tier 4 map', rarity: 'normal', base: 'map', outcome: 'sold', value: 400 }]);
    expect(s.gold).toBe(400);
    expect(receiveItem(s, gear(s, 'ring', { rarity: 'rare', ilvl: 5 })).map((n) => [n.outcome, n.value])).toEqual([['sold', 150]]);
    expect(receiveItem(s, gem(s, 'ruby')).map((n) => [n.outcome, n.value])).toEqual([['sold', 40]]);
    expect(s.gold).toBe(590);
    expect(receiveMaterial(s, 'iron', 9)).toEqual([
      { name: 'Iron ore', rarity: 'material', base: 'iron', outcome: 'stash', value: 9 },
    ]);
    expect(s.stash.materials.iron).toBe(9);
    expect(s.overflow).toEqual(held);
  });

  it('held finds move into the bag as room frees, in order, the loot filter first', () => {
    const s = newGame(1, 0);
    fullBag(s);
    const first = gear(s, 'ring', { rarity: 'magic' });
    const second = gear(s, 'gloves', { rarity: 'normal', ilvl: 4 });
    receiveItem(s, first);
    receiveItem(s, second);
    s.bag[12] = null;
    drainOverflow(s);
    expect([s.bag[12], s.overflow]).toEqual([first, [second]]);
    s.settings.lootFilter = [{ rarity: 'normal', target: 'any', action: 'sell' }];
    drainOverflow(s);
    expect([s.overflow, s.gold]).toEqual([[], 20]);
  });

  it('nothing goes to the stash on its own', () => {
    const s = newGame(1, 0);
    fullBag(s);
    const before = structuredClone([s.stash.general, s.stash.gems, s.stash.maps]);
    for (let i = 0; i < 500; i++) receiveItem(s, i % 2 ? gear(s, 'ring') : gem(s, 'sapphire'));
    expect([s.stash.general, s.stash.gems, s.stash.maps]).toEqual(before);
    expect(s.overflow).toHaveLength(MAX_HELD);
  });

  it('the loot filter never matches a map', () => {
    const s = newGame(1, 0);
    s.settings.lootFilter = [{ rarity: 'any', target: 'any', action: 'sell' }];
    expect(receiveItem(s, gem(s)).map((n) => n.outcome)).toEqual(['sold']);
    const map = mapOf(s, 3);
    expect(lootAction(s.settings.lootFilter, map)).toBe('keep');
    expect(receiveItem(s, map).map((n) => n.outcome)).toEqual(['bag']);
    expect(s.bag[0]).toBe(map);
  });

  it('a map salvages into Copper ore, plus Tin ore from tier 3', () => {
    const s = newGame(1, 0);
    expect([1, 3, 5, 10].map((tier) => salvageYield(mapOf(s, tier)))).toEqual([
      { copper: 2 }, { copper: 2, tin: 1 }, { copper: 4, tin: 2 }, { copper: 6, tin: 3 },
    ]);
    expect(salvageYield(mapOf(s, 5, 'rare'))).toEqual({ copper: 4, tin: 2 });
  });
});

describe('when the bag and the General tab are full', () => {
  it('a find is held, up to 60, and the 61st is sold at its sell pay', () => {
    const s = newGame(1, 0);
    fill(s);
    for (let i = 0; i < MAX_HELD; i++) {
      expect(receiveItem(s, gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 })).map((n) => n.outcome)).toEqual(['held']);
    }
    expect(s.overflow).toHaveLength(MAX_HELD);
    const last = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 5 });
    expect(receiveItem(s, last).map((n) => [n.outcome, n.value])).toEqual([['sold', 25]]);
    expect(s.gold).toBe(25);
    expect(s.overflow).toHaveLength(MAX_HELD);
    expect(s.overflow).not.toContain(last);
    expect(s.lootTally).toEqual({ kept: MAX_HELD, sold: 1, salvaged: 0 });
  });

  it('no carried item is ever sold to make room', () => {
    const s = newGame(1, 0);
    fill(s);
    s.stash.general[100] = gear(s, 'gloves', { rarity: 'normal', ilvl: 1 });
    const before = structuredClone([s.bag, s.stash.general]);
    for (let i = 0; i < 100; i++) receiveItem(s, gear(s, 'ring', { rarity: 'legendary', ilvl: 9 }));
    expect([s.bag, s.stash.general]).toEqual(before);
    expect(s.overflow).toHaveLength(MAX_HELD);
  });

  it('a bag of gem stacks is never sold from: the find is held', () => {
    const s = newGame(1, 0);
    s.bag = s.bag.map(() => gem(s, 'ruby', { count: 25 }));
    s.stash.general = s.stash.general.map(() => gear(s, 'pickaxe', { rarity: 'legendary' }));
    const boots = gear(s, 'boots', { rarity: 'normal' });
    expect(receiveItem(s, boots)).toEqual([expect.objectContaining({ outcome: 'held' })]);
    expect(s.bag.every((c) => c?.type === 'gem' && c.count === 25)).toBe(true);
    expect(s.overflow).toEqual([boots]);
  });

  it('changing the loot filter applies to held loot', () => {
    const s = newGame(1, 0);
    fill(s);
    receiveItem(s, gear(s, 'pickaxe', { rarity: 'normal', ilvl: 5 }));
    expect(s.overflow).toHaveLength(1);
    s.settings.lootFilter = [{ rarity: 'normal', target: 'any', action: 'sell' }];
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.gold).toBe(25);
  });

  it('held loot the filter now salvages goes into materials', () => {
    const s = newGame(1, 0);
    fill(s);
    receiveItem(s, gear(s, 'pickaxe', { rarity: 'rare', ilvl: 5 }));
    s.settings.lootFilter = [{ rarity: 'rare', target: 'any', action: 'salvage' }];
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect([s.stash.materials.copper, s.stash.materials.tin, s.stash.materials.iron, s.diamonds]).toEqual([6, 4, 2, 0]);
  });

  it('a held find idles digging until there is room', () => {
    const s = newGame(1, 0);
    fill(s);
    const pick = gear(s, 'pickaxe');
    expect(receiveItem(s, pick).map((n) => n.outcome)).toEqual(['held']);
    expect(s.overflow).toEqual([pick]);
    const before = { gold: s.gold, progress: s.progress, ticks: s.tickCount };
    applyTicks(s, 50, stats);
    expect([s.gold, s.progress, s.tickCount]).toEqual([before.gold, before.progress, before.ticks + 50]);
    s.bag[59] = null;
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.bag[59]).toBe(pick);
    applyTicks(s, 1, stats);
    expect(s.progress).toBeGreaterThan(before.progress);
  });

  it('a hold stops the rest of a multi-metre face tick', () => {
    const s = newGame(1, 0);
    fill(s);
    s.ahead[1] = { feature: 'chest', amount: 0, hardRock: false };
    s.ahead[2] = { feature: 'goldVein', amount: 19, hardRock: false };
    applyTicks(s, 1, { ...stats, digPower: 3 * 10.13 * 25 }); // 3 metres of metre 1's work
    expect(s.deepest).toBe(1);
    expect(s.progress).toBeGreaterThanOrEqual(0);
    expect(s.progress).toBeLessThan(1);
    expect(s.ahead[2]).toEqual({ feature: 'goldVein', amount: 19, hardRock: false });
    expect(s.finds.map((f) => f.kind)).toEqual(['chest']);
    expect(s.overflow.length).toBeGreaterThan(0);
  });

  it('the held list drains in order, and stops at the first held find with no room', () => {
    const s = newGame(1, 0);
    fill(s);
    const tin: MaterialItem = { id: s.nextId++, type: 'material', material: 'tin', count: 20 };
    s.bag[5] = tin;
    const map: MapItem = { id: s.nextId++, type: 'map', tier: 2, metre: 9, rarity: 'normal', mods: [] };
    const ore: MaterialItem = { id: s.nextId++, type: 'material', material: 'tin', count: 30 };
    s.overflow.push(map, ore);
    drainOverflow(s);
    expect(s.overflow).toEqual([map, ore]);   // the ore would top up the tin stack, but the map is first
    expect(tin.count).toBe(20);
    s.bag[10] = null;
    drainOverflow(s);
    expect(s.bag[10]).toBe(map);
    expect(tin.count).toBe(50);
    expect(s.overflow).toEqual([]);
  });
});

it('chest and gem finds carry their loot notes', () => {
  const s = newGame(1, 0);
  s.ahead[1] = { feature: 'chest', amount: 0, hardRock: false };
  s.ahead[2] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 2) applyTicks(s, 1, stats);
  const [chest, found] = s.finds;
  expect(chest).toMatchObject({ id: 1, kind: 'chest', depth: 1 });
  expect(chest?.loot?.every((n) => n.outcome === 'bag')).toBe(true);
  expect(found?.loot).toEqual([expect.objectContaining({ rarity: 'gem', outcome: 'bag' })]);
  expect(found?.id).toBeGreaterThan(chest?.id ?? Infinity);
  const kept = s.bag.filter((c) => c !== null);
  expect(kept.every((i) => (i.type === 'gear' ? i.ilvl === 1 : i.type === 'gem' && i.grade === 'tiny'))).toBe(true);
  expect(new Set([...(chest?.loot ?? []), ...(found?.loot ?? [])].map((n) => n.name))).toEqual(new Set(kept.map(itemName)));
});

it('only the newest finds keep their loot notes', () => {
  const s = newGame(1, 0);
  const last = LOOT_NOTES_KEPT + 5;
  for (let m = 1; m <= last; m++) s.ahead[m] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < last) applyTicks(s, 1, stats);
  expect(s.finds).toHaveLength(last);
  expect(s.finds.filter((f) => f.loot).length).toBe(LOOT_NOTES_KEPT);
  expect(s.finds[0]?.loot).toBeUndefined();
  expect(s.finds.at(-1)?.loot).toHaveLength(1);
});

it('the offline summary counts loot and notices a full stop', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  after.lootTally = { kept: 3, sold: 2, salvaged: 1 };
  after.overflow = [gear(after, 'pickaxe')];
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum.items).toEqual({ kept: 3, sold: 2, salvaged: 1 });
  expect(sum.bagStopped).toBe(true);
  expect(summarize(before, before, 600_000, 600, 28_800_000).bagStopped).toBe(false);
});

it('found gems stack in the bag, then are held, and past the held cap are sold', () => {
  const s = newGame(1, 0);
  s.bag[3] = gem(s, 'ruby', { count: 24 });
  receiveItem(s, gem(s, 'ruby'));
  expect(s.bag[3]).toMatchObject({ count: 25 });
  receiveItem(s, gem(s, 'ruby'));
  expect(s.bag[0]).toMatchObject({ gem: 'ruby', grade: 'tiny', count: 1 });
  s.bag = s.bag.map((c, i) => c ?? gear(s, i % 2 ? 'pickaxe' : 'boots'));
  const emerald = gem(s, 'emerald');
  expect(receiveItem(s, emerald)).toEqual([expect.objectContaining({ outcome: 'held' })]);
  expect([s.stash.gems.emerald.tiny, s.overflow]).toEqual([0, [emerald]]);
  while (s.overflow.length < MAX_HELD) s.overflow.push(gear(s, 'boots'));
  const gold = s.gold;
  expect(receiveItem(s, gem(s, 'emerald'))).toEqual([expect.objectContaining({ outcome: 'sold', value: 40 })]);
  expect(s.gold).toBe(gold + 40);
  expect(s.overflow).toHaveLength(MAX_HELD);
});

it('a found stack of 3 tops up a stack of 24, then takes an empty cell with its own id', () => {
  const s = newGame(1, 0);
  s.bag[3] = gem(s, 'ruby', { count: 24 });
  const found = gem(s, 'ruby', { count: 3 });
  expect(receiveItem(s, found)).toEqual([expect.objectContaining({ outcome: 'bag' })]);
  expect(s.bag[3]).toMatchObject({ count: 25 });
  expect(s.bag[0]).toEqual({ ...found, count: 2 });
  expect(s.stash.gems.ruby.tiny).toBe(0);
});

/** A fresh state wearing gloves of `stat`. */
function wearing(stat: 'sellBonus' | 'salvageYield', value: number): GameState {
  const s = newGame(1, 0);
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat, value }] });
  return s;
}

it('sell bonus raises what selling pays, by hand and by the loot filter', () => {
  const s = wearing('sellBonus', 50);
  const boots = gear(s, 'boots', { rarity: 'rare', ilvl: 5 });
  expect(sellValue(boots)).toBe(150);
  expect(sellPay(boots, deriveStats(s))).toBe(225);
  s.bag[0] = boots;
  expect(sell(s, { where: 'bag', index: 0 })).toBe('ok');
  expect(s.gold).toBe(225);
  s.settings.lootFilter = [{ rarity: 'rare', target: 'any', action: 'sell' }];
  expect(receiveItem(s, gear(s, 'boots', { rarity: 'rare', ilvl: 5 }))).toEqual([expect.objectContaining({ outcome: 'sold', value: 225 })]);
  expect(s.gold).toBe(450);
});

it('sell bonus raises a find sold past the held cap, held loot sold by the filter, and a found gem stack sold past the held cap', () => {
  const s = wearing('sellBonus', 50);
  fill(s);
  for (let i = 0; i < MAX_HELD; i++) receiveItem(s, gear(s, 'pickaxe'));
  const pick = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 5 });
  expect(receiveItem(s, pick).map((n) => [n.outcome, n.value])).toEqual([['sold', 38]]);   // round(25 × 1.5)
  expect(s.gold).toBe(38);

  const held = wearing('sellBonus', 50);
  fill(held);
  receiveItem(held, gear(held, 'pickaxe', { rarity: 'normal', ilvl: 5 }));
  held.settings.lootFilter = [{ rarity: 'normal', target: 'any', action: 'sell' }];
  drainOverflow(held);
  expect(held.gold).toBe(38);

  const gems = wearing('sellBonus', 50);
  gems.bag = gems.bag.map(() => gear(gems, 'boots'));
  for (let i = 0; i < MAX_HELD; i++) gems.overflow.push(gear(gems, 'boots'));
  expect(receiveItem(gems, gem(gems, 'emerald'))).toEqual([expect.objectContaining({ outcome: 'sold', value: 60 })]);
  expect(gems.gold).toBe(60);
});

it('salvage yield raises held loot the filter now salvages', () => {
  const s = wearing('salvageYield', 100);
  fill(s);
  receiveItem(s, gear(s, 'ring', { rarity: 'rare', ilvl: 10 }));
  expect(s.overflow).toHaveLength(1);
  s.settings.lootFilter = [{ rarity: 'rare', target: 'any', action: 'salvage' }];
  drainOverflow(s);
  expect(s.overflow).toEqual([]);
  expect([s.stash.materials.copper, s.stash.materials.tin, s.stash.materials.iron]).toEqual([18, 12, 6]);   // 9, 6 and 3, doubled
});

it('salvage yield raises each material salvage gives, rounded', () => {
  const s = wearing('salvageYield', 100);
  const ring = gear(s, 'ring', { rarity: 'rare', ilvl: 10 });
  expect(salvagePay(ring, deriveStats(s))).toEqual({ copper: 18, tin: 12, iron: 6 });
  expect(salvagePay(ring, deriveStats(wearing('salvageYield', 50)))).toEqual({ copper: 14, tin: 9, iron: 5 });   // 13.5, 9 and 4.5
  s.bag[0] = ring;
  expect(salvage(s, { where: 'bag', index: 0 })).toBe('ok');
  expect([s.stash.materials.copper, s.stash.materials.tin, s.stash.materials.iron]).toEqual([18, 12, 6]);
  s.settings.lootFilter = [{ rarity: 'rare', target: 'any', action: 'salvage' }];
  expect(receiveItem(s, gear(s, 'ring', { rarity: 'rare', ilvl: 10 }))).toEqual([expect.objectContaining({ outcome: 'salvaged', value: 36 })]);
  expect(s.stash.materials.copper).toBe(36);
});
