import { describe, expect, it } from 'vitest';
import { BAG_SIZE, STASH_SIZE, statRange } from '../../src/core/balance';
import { LEGENDARIES, STAT_WORDS, baseName, gemName, gemSizeName } from '../../src/core/itemData';
import { rollChest, rollGear, rollGem } from '../../src/core/itemGen';
import { SLOT_IMPLICIT, setOfSlot, statsOf, type GearItem, type GearSet, type Rarity } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import type { Item } from '../../src/core/items';

describe('stat ranges', () => {
  it('grow with item level and respect caps', () => {
    expect(statRange('digPower', 1)).toEqual({ min: 2, max: 4 });
    expect(statRange('digPower', 10)).toEqual({ min: 11, max: 22 });
    expect(statRange('lampSight', 1)).toEqual({ min: 1, max: 1 });
    expect(statRange('lampSight', 40)).toEqual({ min: 3, max: 6 });
    expect(statRange('ticksPerClick', 50)).toEqual({ min: 1, max: 1 });
    expect(statRange('offlineCap', 1)).toEqual({ min: 10, max: 20 });
    expect(statRange('offlineCap', 100)).toEqual({ min: 120, max: 240 });
    expect(statRange('critChance', 1)).toEqual({ min: 1, max: 2 });
  });
});

it('gem sizes grow with depth', () => {
  expect([1, 3, 4, 7, 10, 15, 99].map(gemSizeName)).toEqual(['Tiny', 'Tiny', 'Small', 'Big', 'Giant', 'Perfect', 'Perfect']);
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
      const imp = statRange(item.implicit.stat, 7);
      expect(item.implicit.value).toBeGreaterThanOrEqual(imp.min);
      expect(item.implicit.value).toBeLessThanOrEqual(imp.max);
      if (item.rarity === 'legendary') continue;
      const stats = item.affixes.map((a) => a.stat);
      expect(new Set(stats).size).toBe(stats.length);
      expect(stats).not.toContain(item.implicit.stat);
      for (const a of item.affixes) {
        expect(statsOf(set)).toContain(a.stat);
        const r = statRange(a.stat, 7);
        expect(a.value).toBeGreaterThanOrEqual(r.min);
        expect(a.value).toBeLessThanOrEqual(r.max);
      }
      const base = baseName(item.slot, 7);
      if (item.rarity === 'normal') expect([item.affixes, item.name]).toEqual([[], base]);
      if (item.rarity === 'magic') {
        expect(item.affixes).toHaveLength(2);
        expect(item.name).toBe(`${STAT_WORDS[item.affixes[0]!.stat].prefix} ${base} of ${STAT_WORDS[item.affixes[1]!.stat].suffix}`);
      }
      if (item.rarity === 'rare') expect([3, 4]).toContain(item.affixes.length);
    }
  }
});

it('rarity, socket and affix-count odds follow the weights', () => {
  const items = many('mining', 20_000, 3);
  const share = (f: (i: GearItem) => boolean) => items.filter(f).length / items.length;
  const r = (x: Rarity) => share((i) => i.rarity === x);
  expect(r('normal')).toBeGreaterThan(0.58); expect(r('normal')).toBeLessThan(0.62);
  expect(r('magic')).toBeGreaterThan(0.28); expect(r('magic')).toBeLessThan(0.32);
  expect(r('rare')).toBeGreaterThan(0.08); expect(r('rare')).toBeLessThan(0.10);
  expect(r('legendary')).toBeGreaterThan(0.006); expect(r('legendary')).toBeLessThan(0.014);
  expect(share((i) => i.sockets === 0)).toBeGreaterThan(0.38); expect(share((i) => i.sockets === 0)).toBeLessThan(0.42);
  expect(share((i) => i.sockets === 3)).toBeGreaterThan(0.06); expect(share((i) => i.sockets === 3)).toBeLessThan(0.08);
  const rares = items.filter((i) => i.rarity === 'rare');
  const four = rares.filter((i) => i.affixes.length === 4).length / rares.length;
  expect(four).toBeGreaterThan(0.44); expect(four).toBeLessThan(0.56);
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
    s.bags.mining = [];
    s.bags.battle = [];
    s.stash = [];
  };
  for (const item of items) {
    const bag = item.type === 'gear' ? s.bags[setOfSlot(item.slot)] : s.bags.mining;
    if (bag.length < BAG_SIZE) bag.push(item);
    else if (s.stash.length < STASH_SIZE) s.stash.push(item);
    else {
      flush();
      bag.push(item);
    }
  }
  flush();
});
