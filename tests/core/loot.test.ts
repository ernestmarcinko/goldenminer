import { describe, expect, it } from 'vitest';
import { BAG_SIZE, LOOT_NOTES_KEPT, STASH_SIZE } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import { itemName } from '../../src/core/itemData';
import { drainOverflow, lootAction, receiveItem, salvageValue, sellValue } from '../../src/core/loot';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
import type { GameState, LootRule } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const stats = deriveStats(newGame(1, 0));

// Bag: 24 rare boots (150 Gold each). Stash: 60 rare gloves (150) except index 7, a normal pair (25).
function fill(s: GameState) {
  for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gear(s, 'boots', { rarity: 'rare', ilvl: 5 }));
  for (let i = 0; i < STASH_SIZE; i++) s.stash.push(gear(s, 'gloves', { rarity: i === 7 ? 'normal' : 'rare', ilvl: 5 }));
}

it('sell and salvage values', () => {
  const s = newGame(1, 0);
  expect(sellValue(gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4 }))).toBe(48);
  expect(sellValue(gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, sockets: 1, gems: [gem(s, 'ruby', { ilvl: 4 })] }))).toBe(200);
  expect(salvageValue(gear(s, 'ring', { rarity: 'rare', ilvl: 10 }))).toBe(12);
  expect(salvageValue(gem(s, 'ruby', { ilvl: 4 }))).toBe(2);
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
  receiveItem(s, gear(s, 'boots', { rarity: 'normal', ilvl: 3 }), 'mining');
  receiveItem(s, gear(s, 'boots', { rarity: 'magic', ilvl: 3 }), 'mining');
  expect([s.gold, s.diamonds, s.bags.mining.length]).toEqual([15, 2, 0]);
  expect(s.lootTally).toEqual({ kept: 0, sold: 1, salvaged: 1 });
});

it('kept items go to the bag of their set, then overflow into the stash', () => {
  const s = newGame(1, 0);
  expect(receiveItem(s, gear(s, 'weapon'), 'mining').map((n) => n.outcome)).toEqual(['bag']);
  expect(s.bags.battle).toHaveLength(1);
  for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
  expect(receiveItem(s, gem(s, 'emerald'), 'mining').map((n) => n.outcome)).toEqual(['stash']);
  expect(s.stash).toHaveLength(1);
});

describe('when the bag and the stash are full', () => {
  it('sellWorst sells the cheapest of the new item, the bag and the stash', () => {
    const s = newGame(1, 0);
    fill(s);
    const pick = gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 });
    expect(receiveItem(s, pick, 'mining').map((n) => [n.outcome, n.value])).toEqual([['sold', 25], ['stash', 0]]);
    expect(s.gold).toBe(25);
    expect(s.stash[7]).toBe(pick);
    expect(s.stash).toHaveLength(STASH_SIZE);
    expect(s.lootTally).toEqual({ kept: 1, sold: 1, salvaged: 0 });
  });

  it('a new item that is the cheapest is sold itself', () => {
    const s = newGame(1, 0);
    fill(s);
    expect(receiveItem(s, gear(s, 'pickaxe', { rarity: 'normal', ilvl: 1 }), 'mining').map((n) => n.outcome)).toEqual(['sold']);
    expect(s.gold).toBe(5);
  });

  it('stop holds the item and idles until there is room', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
    fill(s);
    const pick = gear(s, 'pickaxe');
    expect(receiveItem(s, pick, 'mining').map((n) => n.outcome)).toEqual(['held']);
    expect(s.overflow).toEqual([{ bag: 'mining', item: pick }]);
    const before = { gold: s.gold, progress: s.progress, ticks: s.tickCount };
    applyTicks(s, 50, stats);
    expect([s.gold, s.progress, s.tickCount]).toEqual([before.gold, before.progress, before.ticks + 50]);
    s.bags.mining.pop();
    drainOverflow(s);
    expect(s.overflow).toEqual([]);
    expect(s.bags.mining.at(-1)).toBe(pick);
    applyTicks(s, 1, stats);
    expect(s.gold).toBeGreaterThan(before.gold);
  });

  it('switching to sellWorst lets held loot through', () => {
    const s = newGame(1, 0);
    s.settings.bagFull = 'stop';
    fill(s);
    receiveItem(s, gear(s, 'pickaxe', { rarity: 'magic', ilvl: 5 }), 'mining');
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
  const kept = [...s.bags.mining, ...s.bags.battle];
  expect(kept.every((i) => i.ilvl === 1)).toBe(true);
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
  after.overflow = [{ bag: 'mining', item: gem(after) }];
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum.items).toEqual({ kept: 3, sold: 2, salvaged: 1 });
  expect(sum.stoppedFull).toBe(true);
});
