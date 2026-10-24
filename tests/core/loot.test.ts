import { describe, expect, it } from 'vitest';
import { LOOT_NOTES_KEPT } from '../../src/core/balance';
import { filledCount } from '../../src/core/cells';
import { applyTicks } from '../../src/core/dig';
import { itemName } from '../../src/core/itemData';
import { drainOverflow, lootAction, receiveItem, salvageValue, sellValue } from '../../src/core/loot';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
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
  expect(salvageValue(gear(s, 'ring', { rarity: 'rare', ilvl: 10 }))).toBe(12);
  expect(salvageValue(gem(s, 'ruby'))).toBe(2);
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
  expect([s.gold, s.diamonds, filledCount(s.bag)]).toEqual([15, 2, 0]);
  expect(s.lootTally).toEqual({ kept: 0, sold: 1, salvaged: 1 });
});

it('kept items go to the bag, then overflow into the stash', () => {
  const s = newGame(1, 0);
  expect(receiveItem(s, gear(s, 'weapon')).map((n) => n.outcome)).toEqual(['bag']);
  expect(receiveItem(s, gear(s, 'pickaxe')).map((n) => n.outcome)).toEqual(['bag']);
  expect(filledCount(s.bag)).toBe(2);
  s.bag = s.bag.map((c) => c ?? gear(s, 'boots'));
  expect(receiveItem(s, gear(s, 'pickaxe')).map((n) => n.outcome)).toEqual(['stash']);
  expect(filledCount(s.stash.general)).toBe(1);
});

it('found gear fills the bag, then General pages in order', () => {
  const s = newGame(1, 0);
  s.bag = s.bag.map(() => gear(s, 'boots'));
  for (let i = 0; i < 60; i++) s.stash.general[i] = gear(s, 'gloves');
  const ring = gear(s, 'ring');
  expect(receiveItem(s, ring).map((n) => n.outcome)).toEqual(['stash']);
  expect(s.stash.general[60]).toBe(ring);
});

it('sell-the-worst looks at the bag and every General page', () => {
  const s = newGame(1, 0);
  fill(s);
  s.stash.general[7] = gear(s, 'gloves', { rarity: 'rare', ilvl: 5 });
  s.stash.general[100] = gear(s, 'gloves', { rarity: 'normal', ilvl: 5 });
  const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 });
  expect(receiveItem(s, pick).map((n) => [n.outcome, n.value])).toEqual([['sold', 25], ['stash', 0]]);
  expect(s.stash.general[100]).toBe(pick);
});

describe('when the bag and the stash are full', () => {
  it('sellWorst sells the cheapest of the new item, the bag and the stash', () => {
    const s = newGame(1, 0);
    fill(s);
    const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 });
    expect(receiveItem(s, pick).map((n) => [n.outcome, n.value])).toEqual([['sold', 25], ['stash', 0]]);
    expect(s.gold).toBe(25);
    expect(s.stash.general[7]).toBe(pick);
    expect(filledCount(s.stash.general)).toBe(120);
    expect(s.lootTally).toEqual({ kept: 1, sold: 1, salvaged: 0 });
  });

  it('a new item that is the cheapest is sold itself', () => {
    const s = newGame(1, 0);
    fill(s);
    expect(receiveItem(s, gear(s, 'pickaxe', { rarity: 'normal', ilvl: 1 })).map((n) => n.outcome)).toEqual(['sold']);
    expect(s.gold).toBe(5);
  });

  it('sells the lowest rarity first, then the lowest Gold', () => {
    const s = newGame(1, 0);
    fill(s);
    s.stash.general[7] = gear(s, 'gloves', { rarity: 'legendary', ilvl: 2 });
    const pick = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 40 });
    expect(receiveItem(s, pick).map((n) => n.outcome)).toEqual(['sold']);
    expect(s.gold).toBe(200);
    expect(s.stash.general[7]?.rarity).toBe('legendary');
  });

  it('changing the loot filter applies to held loot', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
    fill(s);
    receiveItem(s, gear(s, 'pickaxe', { rarity: 'normal', ilvl: 5 }));
    expect(s.overflow).toHaveLength(1);
    s.settings.lootFilter = [{ rarity: 'normal', target: 'any', action: 'sell' }];
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.gold).toBe(25);
  });

  it('stop holds the item and idles until there is room', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
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
    expect(s.gold).toBeGreaterThan(before.gold);
  });

  it('a hold stops the rest of a multi-metre face tick', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
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

  it('switching to sellWorst lets held loot through', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
    fill(s);
    receiveItem(s, gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 }));
    s.settings.bagFull = 'sellWorst';
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.gold).toBe(25);
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

it('found gems stack in the bag, then go to the Gems tab, and never wait', () => {
  const s = newGame(1, 0);
  s.bag[3] = gem(s, 'ruby', { count: 24 });
  receiveItem(s, gem(s, 'ruby'));
  expect(s.bag[3]).toMatchObject({ count: 25 });
  receiveItem(s, gem(s, 'ruby'));
  expect(s.bag[0]).toMatchObject({ gem: 'ruby', grade: 'tiny', count: 1 });
  s.bag = s.bag.map((c, i) => c ?? gear(s, i % 2 ? 'pickaxe' : 'boots'));
  s.settings.bagFull = 'stop';
  expect(receiveItem(s, gem(s, 'emerald'))).toEqual([expect.objectContaining({ outcome: 'stash' })]);
  expect(s.stash.gems.emerald.tiny).toBe(1);
  s.stash.gems.emerald.tiny = 1_000_000;
  const gold = s.gold;
  expect(receiveItem(s, gem(s, 'emerald'))).toEqual([expect.objectContaining({ outcome: 'sold', value: 40 })]);
  expect(s.gold).toBe(gold + 40);
  expect(s.overflow).toEqual([]);
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

it('sell-the-worst skips single gems even when they rank below the new item', () => {
  const s = newGame(1, 0);
  const gems = s.bag.map(() => gem(s, 'ruby'));
  s.bag = [...gems];
  s.stash.general = s.stash.general.map(() => gear(s, 'pickaxe', { rarity: 'legendary' }));
  s.settings.bagFull = 'sellWorst';
  const notes = receiveItem(s, gear(s, 'boots', { rarity: 'rare' }));
  expect(notes).toEqual([expect.objectContaining({ outcome: 'sold' })]);
  expect(s.bag).toEqual(gems);
  expect(s.bag.every((c) => c?.type === 'gem' && c.count === 1)).toBe(true);
});

it('sell-the-worst never sells a gem stack', () => {
  const s = newGame(1, 0);
  s.bag = s.bag.map(() => gem(s, 'ruby', { count: 25 }));
  s.stash.general = s.stash.general.map(() => gear(s, 'pickaxe', { rarity: 'legendary' }));
  const notes = receiveItem(s, gear(s, 'boots', { rarity: 'normal' }));
  expect(notes).toEqual([expect.objectContaining({ outcome: 'sold' })]);
  expect(s.bag.every((c) => c?.type === 'gem' && c.count === 25)).toBe(true);
  const n = gear(s, 'boots', { rarity: 'normal' });
  s.bag[7] = n;
  receiveItem(s, gear(s, 'gloves', { rarity: 'magic' }));
  expect(s.bag[7]).toMatchObject({ slot: 'gloves' });
});
