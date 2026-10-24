import { describe, expect, it } from 'vitest';
import { emptyInventory, firstEmpty } from '../../src/core/cells';
import { LEGENDARIES, RARE_FIRST, RARE_SECOND, baseName, gemName } from '../../src/core/itemData';
import { magicName, rareName, rollChest, rollGear, rollGem, rollLines, rollModLine, sideCount } from '../../src/core/itemGen';
import { MOD_SIDE, SLOT_IMPLICIT, setOfSlot, statsOf, type GearItem, type GearSet, type ModLine, type Rarity } from '../../src/core/items';
import { tierRange } from '../../src/core/tiers';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import type { Item } from '../../src/core/items';

it('gems roll the grade their tier allows, one at a time', () => {
  const gems = [1, 4, 7, 10, 15].map((tier) => rollGem(newGame(1, 0), tier));
  expect(gems.map((g) => g.grade)).toEqual(['tiny', 'small', 'big', 'giant', 'perfect']);
  expect(gems.every((g) => g.count === 1)).toBe(true);
  expect(gemName(rollGem(newGame(1, 0), 5))).toMatch(/^Small (Ruby|Sapphire|Emerald|Amethyst|Starstone)$/);
});

it('rolls are deterministic and take fresh ids', () => {
  const a = newGame(3, 0);
  const b = newGame(3, 0);
  expect(rollGear(a, 6, 'mining')).toEqual(rollGear(b, 6, 'mining'));
  expect(a.rng).toBe(b.rng);
  const first = rollGem(a, 6).id;
  expect(rollGem(a, 6).id).toBe(first + 1);
  expect(a.nextId).toBe(first + 2);
});

const many = (set: GearSet, n: number, ilvl: number) => {
  const s = newGame(11, 0);
  return Array.from({ length: n }, () => rollGear(s, ilvl, set));
};

it('every item fits its set, rarity and item level', () => {
  for (const set of ['mining', 'battle'] as const) {
    for (const item of many(set, 2000, 7)) {
      expect(setOfSlot(item.slot)).toBe(set);
      expect(item.ilvl).toBe(7);
      expect(item.gems).toEqual([]);
      expect([0, 1, 2, 3]).toContain(item.sockets);
      expect(item.implicit.stat).toBe(SLOT_IMPLICIT[item.slot]);
      const imp = tierRange(item.implicit.stat, 7);
      expect(item.implicit.value).toBeGreaterThanOrEqual(imp.lo);
      expect(item.implicit.value).toBeLessThanOrEqual(imp.hi);
      if (item.rarity === 'legendary') continue;
      for (const a of item.affixes) expect(statsOf(set)).toContain(a.stat);
      const base = baseName(item.slot, 7);
      if (item.rarity === 'normal') expect([item.affixes, item.name]).toEqual([[], base]);
      if (item.rarity === 'magic') expect(item.name).toBe(magicName(item.slot, 7, item.affixes));
    }
  }
});

it('lines follow the rarity, the sides and the tiers', () => {
  for (const set of ['mining', 'battle'] as const) {
    const tiers: number[] = [];
    for (const item of many(set, 2000, 8)) {
      const n = item.affixes.length;
      const sides = [sideCount(item.affixes, 'prefix'), sideCount(item.affixes, 'suffix')];
      if (item.rarity === 'normal') expect(n).toBe(0);
      if (item.rarity === 'magic') {
        expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(2);
        for (const c of sides) expect(c).toBeLessThanOrEqual(1);
      }
      if (item.rarity === 'rare') {
        expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(6);
        for (const c of sides) expect(c).toBeLessThanOrEqual(3);
      }
      if (item.rarity === 'legendary') {                                          // hand-written lines, which may share the implicit's stat
        for (const a of item.affixes) expect(a.tier).toBe(0);
        continue;
      }
      const stats = item.affixes.map((a) => a.stat);
      expect(new Set(stats).size).toBe(stats.length);
      expect(stats).not.toContain(item.implicit.stat);
      for (const a of item.affixes) {
        expect(a.tier).toBeGreaterThanOrEqual(1);
        expect(a.tier).toBeLessThanOrEqual(8);
        const { lo, hi } = tierRange(a.stat, a.tier);
        expect(a.value).toBeGreaterThanOrEqual(lo);
        expect(a.value).toBeLessThanOrEqual(hi);
        tiers.push(a.tier);
      }
    }
    const share = (t: number) => tiers.filter((x) => x === t).length / tiers.length;
    expect(share(1)).toBeGreaterThan(share(8));
  }
});

it('magic names take a prefix word and a suffix word', () => {
  const sharp: ModLine = { stat: 'digPower', value: 2, tier: 1 };
  const treasure: ModLine = { stat: 'chestFind', value: 5, tier: 1 };
  expect(magicName('pickaxe', 4, [sharp, treasure])).toBe('Sharp Iron Pick of Treasure');
  expect(magicName('pickaxe', 4, [treasure, sharp])).toBe('Sharp Iron Pick of Treasure');
  expect(magicName('pickaxe', 4, [treasure])).toBe('Iron Pick of Treasure');
  expect(magicName('pickaxe', 4, [sharp])).toBe('Sharp Iron Pick');
});

it('rolled lines add to what an item has without breaking its sides', () => {
  const s = newGame(4, 0);
  for (let i = 0; i < 500; i++) {
    const one = rollLines(s, 'pickaxe', 6, 1);
    const two = rollLines(s, 'pickaxe', 6, 1, one);
    expect(MOD_SIDE[two[0]!.stat]).not.toBe(MOD_SIDE[one[0]!.stat]);          // a magic item's second line takes the free side
    const rare = rollLines(s, 'pickaxe', 6, 4, [...one, ...two]);
    const all = [...one, ...two, ...rare];
    expect(new Set(all.map((a) => a.stat)).size).toBe(6);
    expect(all.map((a) => a.stat)).not.toContain('digPower');
    expect([sideCount(all, 'prefix'), sideCount(all, 'suffix')]).toEqual([3, 3]);
  }
  const line = rollModLine(s, 'goldYield', 1);
  expect(line).toEqual({ stat: 'goldYield', value: line.value, tier: 1 });
  expect(rareName(s, 'pickaxe')).toMatch(new RegExp(`^(${RARE_FIRST.join('|')}) (${RARE_SECOND.pickaxe.join('|')})$`));
});

it('rarity, socket and line-count odds follow the weights', () => {
  const items = many('mining', 20_000, 3);
  const share = (f: (i: GearItem) => boolean) => items.filter(f).length / items.length;
  const r = (x: Rarity) => share((i) => i.rarity === x);
  expect(r('normal')).toBeGreaterThan(0.58); expect(r('normal')).toBeLessThan(0.62);
  expect(r('magic')).toBeGreaterThan(0.28); expect(r('magic')).toBeLessThan(0.32);
  expect(r('rare')).toBeGreaterThan(0.08); expect(r('rare')).toBeLessThan(0.10);
  expect(r('legendary')).toBeGreaterThan(0.006); expect(r('legendary')).toBeLessThan(0.014);
  expect(share((i) => i.sockets === 0)).toBeGreaterThan(0.38); expect(share((i) => i.sockets === 0)).toBeLessThan(0.42);
  expect(share((i) => i.sockets === 3)).toBeGreaterThan(0.06); expect(share((i) => i.sockets === 3)).toBeLessThan(0.08);
  const of = (rarity: Rarity, n: number) => {
    const all = items.filter((i) => i.rarity === rarity);
    return all.filter((i) => i.affixes.length === n).length / all.length;
  };
  expect(of('magic', 1)).toBeGreaterThan(0.46); expect(of('magic', 1)).toBeLessThan(0.54);
  expect(of('rare', 4)).toBeGreaterThan(0.44); expect(of('rare', 4)).toBeLessThan(0.56);
  expect(of('rare', 6)).toBeGreaterThan(0.11); expect(of('rare', 6)).toBeLessThan(0.19);
});

it('legendaries come from the hand-written list', () => {
  const s = newGame(5, 0);
  const seen = new Map<string, GearItem>();
  for (let i = 0; i < 300; i++) {
    const item = rollGear(s, 10, 'mining', 'legendary');
    seen.set(item.name, item);
  }
  const mining = LEGENDARIES.filter((d) => setOfSlot(d.slot) === 'mining').map((d) => d.name);
  expect([...seen.keys()].sort()).toEqual(mining.sort());
  const dd = seen.get('Deepdelver');
  expect(dd).toMatchObject({ slot: 'pickaxe', rarity: 'legendary', uniqueId: 'deepdelver' });
  expect(dd?.affixes.map((a) => a.stat)).toEqual(['digPower', 'ticksPerClick', 'chestFind']);
  expect(dd?.affixes.slice(1).map((a) => a.value)).toEqual([1, -10]);
  expect(dd?.affixes.map((a) => a.tier)).toEqual([0, 0, 0]);
  expect(dd?.affixes[0]?.value).toBeGreaterThanOrEqual(17);
  expect(dd?.affixes[0]?.value).toBeLessThanOrEqual(33);
});

it('chests hold one or two items, mostly mining gear', () => {
  const s = newGame(8, 0);
  let doubles = 0;
  let items = 0;
  let battle = 0;
  for (let i = 0; i < 5000; i++) {
    const loot = rollChest(s, 4);
    expect([1, 2]).toContain(loot.length);
    if (loot.length === 2) doubles++;
    for (const item of loot) {
      items++;
      if (setOfSlot(item.slot) === 'battle') battle++;
      expect(item.ilvl).toBe(4);
    }
  }
  expect(doubles / 5000).toBeGreaterThan(0.17); expect(doubles / 5000).toBeLessThan(0.23);
  expect(battle / items).toBeGreaterThan(0.17); expect(battle / items).toBeLessThan(0.23);
});

it.each([1, 60])('generated items at ilvl %i always pass the save validator', (ilvl) => {
  const s = newGame(7, 0);
  const items: Item[] = [];
  for (let i = 0; i < 300; i++) items.push(...rollChest(s, ilvl));
  for (let i = 0; i < 100; i++) items.push(rollGem(s, ilvl));
  const flush = () => {
    expect(validateState(s)).toBe(true);
    Object.assign(s, emptyInventory());
  };
  // Anything takes the bag, then gear takes General; a full inventory is checked and emptied.
  const place = (item: Item): boolean => {
    const inBag = firstEmpty(s.bag);
    if (inBag >= 0) { s.bag[inBag] = item; return true; }
    const inGeneral = firstEmpty(s.stash.general);
    if (item.type === 'gear' && inGeneral >= 0) { s.stash.general[inGeneral] = item; return true; }
    return false;
  };
  for (const item of items) {
    if (!place(item)) {
      flush();
      place(item);
    }
  }
  flush();
});
