import { describe, expect, it } from 'vitest';
import { GEM_STASH_STACK, MATERIAL_STASH_STACK, MAX_SOCKETS } from '../../src/core/balance';
import { canCraft, canTargetedCraft, craft, craftCost, targetedCraft, type CraftKind, type TemperOutcome } from '../../src/core/crafting';
import { dropItem } from '../../src/core/inventory';
import { baseName } from '../../src/core/itemData';
import { magicName, rollGear } from '../../src/core/itemGen';
import { GEAR_SETS, MATERIALS, MOD_SIDE, RARITIES, SLOT_IMPLICIT } from '../../src/core/items';
import type { GearItem, Material, MaterialItem, ModLine, StatKey } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import { tierRange } from '../../src/core/tiers';
import type { GameState, ItemLoc } from '../../src/core/types';
import { gear } from '../helpers/items';

const bagLoc = (index: number): ItemLoc => ({ where: 'bag', index });
const mat = (s: GameState, material: Material, count: number): MaterialItem => ({ id: s.nextId++, type: 'material', material, count });
const at = (s: GameState, index: number): GearItem => s.bag[index] as GearItem;
const count = (s: GameState, index: number): number | null => (s.bag[index] as MaterialItem | null)?.count ?? null;
const inTier = (l: ModLine): boolean => {
  const { lo, hi } = tierRange(l.stat, l.tier);
  return l.value >= lo && l.value <= hi;
};
const sides = (lines: readonly ModLine[]) => lines.map((l) => MOD_SIDE[l.stat]);
/** Everything a craft may spend or change. */
const snap = (s: GameState) =>
  structuredClone({ bag: s.bag, stash: s.stash, diamonds: s.diamonds, equipped: s.equipped, rng: s.rng, nextId: s.nextId });

/** A state with plenty of every material in the tab and Diamonds, and `item` at bag[0]. */
function withItem(item: (s: GameState) => GearItem, rng = 1): GameState {
  const s = newGame(1, 0);
  for (const m of MATERIALS) s.stash.materials[m] = 100;
  s.diamonds = 100;
  s.bag[0] = item(s);
  s.rng = rng;
  return s;
}

const line = (stat: StatKey, value: number, tier = 1): ModLine => ({ stat, value, tier });
// A rare pickaxe: two prefixes and two suffixes, values inside their tiers.
const rareLines = (): ModLine[] => [line('goldYield', 6, 2), line('diamondYield', 8, 3), line('chestFind', 5, 1), line('gemFind', 11, 4)];
const full = (): ModLine[] => [
  line('goldYield', 4), line('diamondYield', 4), line('veinYield', 3),
  line('chestFind', 5), line('gemFind', 5), line('mapFind', 5),
];

describe('craft costs', () => {
  it('grow with item level, and the retired Copper, Starsteel and Obsidian have no cost', () => {
    const s = newGame(1, 0);
    const item = gear(s, 'pickaxe', { ilvl: 9 });
    const costs = Object.fromEntries((['tin', 'iron', 'silver', 'mithril', 'voidCrystal', 'diamond', 'makeMagic', 'makeRare'] as CraftKind[])
      .map((k) => [k, craftCost(k, item.ilvl)]));
    expect(costs).toEqual({ tin: 5, iron: 5, silver: 3, mithril: 3, voidCrystal: 1, diamond: 4, makeMagic: 3, makeRare: 5 });
    expect(() => craftCost('copper', 9)).toThrow();
    expect(() => craftCost('starsteel', 9)).toThrow();
    expect(() => craftCost('obsidian', 9)).toThrow();
  });
});

describe('every effect', () => {
  it('makeMagic makes a normal item magic with 1–2 lines and a magic name, for Diamonds', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4, name: 'Iron Pick' }));
    s.diamonds = 2;
    expect(craft(s, bagLoc(0), 'makeMagic')).toEqual({ check: 'ok' });
    const item = at(s, 0);
    expect(item.rarity).toBe('magic');
    expect(item.affixes.length).toBeGreaterThanOrEqual(1);
    expect(item.affixes.length).toBeLessThanOrEqual(2);
    expect(new Set(sides(item.affixes)).size).toBe(item.affixes.length);
    expect(item.affixes.every(inTier)).toBe(true);
    expect(item.name).toBe(magicName('pickaxe', 4, item.affixes));
    expect(s.diamonds).toBe(0);
    expect(validateState(s)).toBe(true);
  });

  it('makeRare makes a magic item rare with 4–6 lines, for Diamonds', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'magic', ilvl: 4, affixes: [line('goldYield', 4)] }));
    s.diamonds = 3;
    expect(craft(s, bagLoc(0), 'makeRare')).toEqual({ check: 'ok' });
    const item = at(s, 0);
    expect(item.rarity).toBe('rare');
    expect(item.affixes.length).toBeGreaterThanOrEqual(4);
    expect(item.affixes.length).toBeLessThanOrEqual(6);
    expect(s.diamonds).toBe(0);
    expect(validateState(s)).toBe(true);
  });

  it('Tin rerolls a magic item\'s lines and renames it', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'magic', name: 'Old', affixes: [line('sellBonus', 5), line('salvageYield', 5)] }), 3);
    const before = structuredClone(at(s, 0).affixes);
    expect(craft(s, bagLoc(0), 'tin').check).toBe('ok');
    const item = at(s, 0);
    expect(item.rarity).toBe('magic');
    expect(item.affixes).not.toEqual(before);
    expect([1, 2]).toContain(item.affixes.length);
    expect(item.name).toBe(magicName('pickaxe', 4, item.affixes));
    expect(s.stash.materials.tin).toBe(97);
    expect(validateState(s)).toBe(true);
  });

  it('Copper and Iron are retired: they no longer craft, on gear', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', name: 'Keep' }));
    const before = snap(s);
    expect(craft(s, bagLoc(0), 'copper')).toEqual({ check: 'wrongRarity' });
    expect(craft(s, bagLoc(0), 'iron')).toEqual({ check: 'wrongRarity' });
    expect(snap(s)).toEqual(before);
    expect(validateState(s)).toBe(true);
  });

  it('Diamond adds a line to a rare on a side with room', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 7, name: 'Grim Pick', affixes: rareLines() }));
    expect(craft(s, bagLoc(0), 'diamond').check).toBe('ok');
    const item = at(s, 0);
    expect(item.affixes).toHaveLength(5);
    expect(item.affixes.slice(0, 4)).toEqual(rareLines());
    expect(s.diamonds).toBe(100 - (1 + Math.floor(7 / 3)));
    expect(item.name).toBe('Grim Pick');
    expect(validateState(s)).toBe(true);
  });

  it('Silver rerolls a rare item to 4–6 lines', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }), 5);
    expect(craft(s, bagLoc(0), 'silver').check).toBe('ok');
    const item = at(s, 0);
    expect(item.rarity).toBe('rare');
    expect(item.affixes.length).toBeGreaterThanOrEqual(4);
    expect(item.affixes.length).toBeLessThanOrEqual(6);
    expect(item.affixes).not.toEqual(rareLines());
    expect(s.stash.materials.silver).toBe(98);
    expect(validateState(s)).toBe(true);
  });

  it('Starsteel and Obsidian are retired: they refuse every gear craft', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }));
    const before = snap(s);
    expect(craft(s, bagLoc(0), 'starsteel')).toEqual({ check: 'wrongRarity' });
    expect(craft(s, bagLoc(0), 'obsidian')).toEqual({ check: 'wrongRarity' });
    expect(snap(s)).toEqual(before);
  });
});

describe('temper', () => {
  const setup = (rng: number): GameState =>
    withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4, affixes: [...rareLines().slice(0, 3), line('gemFind', 15, 6)] }), rng);
  const outcomes = new Map<TemperOutcome, number>();
  for (let rng = 1; outcomes.size < 4 && rng < 500; rng++) {
    const temper = craft(setup(rng), bagLoc(0), 'voidCrystal').temper;
    if (temper !== undefined && !outcomes.has(temper)) outcomes.set(temper, rng);
  }

  it('finds a seed for every outcome', () => {
    expect([...outcomes.keys()].sort()).toEqual(['craftedLine', 'nothing', 'raiseTiers', 'ruin']);
  });

  const effects: Record<TemperOutcome, (before: ModLine[], after: ModLine[]) => void> = {
    craftedLine: (before, after) => {
      expect(after.slice(0, 4)).toEqual(before);
      const added = after[4] as ModLine;
      expect(after).toHaveLength(5);
      expect(added.crafted).toBe(true);
      expect(added.tier).toBe(5);
      expect(inTier(added)).toBe(true);
      expect([...before.map((l) => l.stat), SLOT_IMPLICIT.pickaxe]).not.toContain(added.stat);
    },
    raiseTiers: (before, after) => {
      expect(after.map((l) => l.stat)).toEqual(before.map((l) => l.stat));
      expect(after.map((l) => l.tier)).toEqual([3, 4, 2, 6]);           // the T6 line is already at ilvl + 2
      expect(after.every(inTier)).toBe(true);
    },
    nothing: (before, after) => expect(after).toEqual(before),
    ruin: (before, after) => {
      expect(after.map((l) => l.stat)).toEqual(before.map((l) => l.stat));
      expect(after.every((l) => l.tier === 1 && inTier(l))).toBe(true);
    },
  };

  for (const outcome of ['craftedLine', 'raiseTiers', 'nothing', 'ruin'] as const) {
    it(`${outcome}: its effect, then the item is sealed and refuses every craft`, () => {
      const s = setup(outcomes.get(outcome) ?? 0);
      const before = structuredClone(at(s, 0).affixes);
      expect(craft(s, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: outcome });
      effects[outcome](before, at(s, 0).affixes);
      expect(at(s, 0).sealed).toBe(true);
      expect(s.stash.materials.voidCrystal).toBe(99);
      expect(validateState(s)).toBe(true);
      const sealed = snap(s);
      for (const kind of [...MATERIALS, 'diamond', 'makeMagic', 'makeRare'] as const) {
        expect(canCraft(s, bagLoc(0), kind)).toBe('sealed');
        expect(craft(s, bagLoc(0), kind)).toEqual({ check: 'sealed' });
      }
      expect(snap(s)).toEqual(sealed);
    });
  }

  it('at the crafted-line limit a crafted line becomes nothing', () => {
    const s = setup(outcomes.get('craftedLine') ?? 0);
    const item = at(s, 0);
    item.affixes.push({ stat: 'oreFind', value: 15, tier: 6, crafted: true }, { stat: 'hazardWard', value: 15, tier: 6, crafted: true });
    const before = structuredClone(item.affixes);
    expect(craft(s, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: 'nothing' });
    expect(at(s, 0).affixes).toEqual(before);
    expect(at(s, 0).sealed).toBe(true);
  });
});

describe('refusals spend nothing', () => {
  const legendary = (s: GameState) =>
    gear(s, 'ring', { rarity: 'legendary', ilvl: 5, uniqueId: 'x', affixes: [{ stat: 'damage', value: 5, tier: 0 }] });
  const normal = (s: GameState) => gear(s, 'pickaxe', { rarity: 'normal' });
  const magic = (s: GameState) => gear(s, 'pickaxe', { rarity: 'magic', affixes: [line('goldYield', 4)] });
  const rare = (s: GameState) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() });
  const cases: [string, (s: GameState) => GearItem, CraftKind, string][] = [
    ...(['makeMagic', 'makeRare', 'tin', 'iron', 'silver', 'starsteel', 'obsidian', 'voidCrystal', 'diamond'] as const)
      .map((k): [string, (s: GameState) => GearItem, CraftKind, string] => [`${k} on a legendary`, legendary, k, 'legendary']),
    ['makeMagic on magic', magic, 'makeMagic', 'wrongRarity'],
    ['makeMagic on rare', rare, 'makeMagic', 'wrongRarity'],
    ['makeRare on normal', normal, 'makeRare', 'wrongRarity'],
    ['makeRare on rare', rare, 'makeRare', 'wrongRarity'],
    ['copper on normal', normal, 'copper', 'wrongRarity'],
    ['tin on rare', rare, 'tin', 'wrongRarity'],
    ['tin on normal', normal, 'tin', 'wrongRarity'],
    ['iron on normal', normal, 'iron', 'wrongRarity'],
    ['silver on magic', magic, 'silver', 'wrongRarity'],
    ['void crystal on normal', normal, 'voidCrystal', 'wrongRarity'],
    ['diamond on magic', magic, 'diamond', 'wrongRarity'],
    ['diamond on a full rare', (s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: full() }), 'diamond', 'noRoom'],
    ['starsteel on a normal', normal, 'starsteel', 'wrongRarity'],
    ['obsidian on a rare', (s) => gear(s, 'pickaxe', { rarity: 'rare' }), 'obsidian', 'wrongRarity'],
  ];
  for (const [name, item, kind, check] of cases) {
    it(`${name} → ${check}`, () => {
      const s = withItem(item);
      s.bag[7] = mat(s, kind === 'diamond' || kind === 'makeMagic' || kind === 'makeRare' ? 'copper' : kind, 20);
      const before = snap(s);
      expect(canCraft(s, bagLoc(0), kind)).toBe(check);
      expect(craft(s, bagLoc(0), kind, bagLoc(7))).toEqual({ check });
      expect(snap(s)).toEqual(before);
    });
  }

  it('too little material is short; too few Diamonds too', () => {
    const s = withItem(normal);
    s.stash.materials.mithril = 0;
    s.diamonds = 0;
    s.bag[1] = gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() });
    const before = snap(s);
    expect(craft(s, bagLoc(0), 'mithril')).toEqual({ check: 'short' });
    expect(craft(s, bagLoc(0), 'makeMagic')).toEqual({ check: 'short' });
    expect(craft(s, bagLoc(1), 'diamond')).toEqual({ check: 'short' });
    expect(snap(s)).toEqual(before);
  });

  it('a craft on anything but gear is notGear', () => {
    const s = withItem(normal);
    s.bag[2] = mat(s, 'tin', 5);
    const before = snap(s);
    expect(craft(s, bagLoc(1), 'makeMagic')).toEqual({ check: 'notGear' });
    expect(craft(s, bagLoc(2), 'makeMagic')).toEqual({ check: 'notGear' });
    expect(craft(s, { where: 'worn', slot: 'lamp' }, 'makeMagic')).toEqual({ check: 'notGear' });
    expect(snap(s)).toEqual(before);
  });
});

describe('paying', () => {
  const setup = (): GameState => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 }));
    s.stash.materials.mithril = 50;
    s.bag[5] = mat(s, 'mithril', 2);
    s.bag[9] = mat(s, 'mithril', 10);
    return s;
  };

  it('takes from the dragged stack first', () => {
    const s = setup();
    expect(craft(s, bagLoc(0), 'mithril', bagLoc(9)).check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.mithril]).toEqual([2, 8, 50]);
  });

  it('without a stack, takes from the bag stacks in order', () => {
    const s = setup();
    expect(craft(s, bagLoc(0), 'mithril').check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.mithril]).toEqual([null, 10, 50]);
  });

  it('then from the Materials tab', () => {
    const s = setup();
    s.bag[5] = mat(s, 'mithril', 1);
    s.bag[9] = null;
    expect(craft(s, bagLoc(0), 'mithril').check).toBe('ok');
    expect([count(s, 5), s.stash.materials.mithril]).toEqual([null, 49]);
  });

  it('pays only once the effect is done, so a craft that fails part-way spends nothing', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', sockets: 1 }));
    Object.defineProperty(at(s, 0), 'sockets', { get: () => 1, set: () => { throw new Error('mid-craft'); } });
    expect(() => craft(s, bagLoc(0), 'mithril')).toThrow('mid-craft');
    expect(s.stash.materials.mithril).toBe(100);
  });

  it('from the tab slot first when that is the stack', () => {
    const s = setup();
    expect(craft(s, bagLoc(0), 'mithril', { where: 'materials', material: 'mithril' }).check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.mithril]).toEqual([2, 10, 48]);
  });
});

describe('Mithril', () => {
  const socketed = (s: GameState) =>
    gear(s, 'pickaxe', { rarity: 'rare', sockets: 2, gems: [{ gem: 'ruby', grade: 'tiny' }, { gem: 'ruby', grade: 'tiny' }] });

  it('rerolls the sockets and sends socketed gems to the Gems tab', () => {
    const s = withItem(socketed);
    expect(craft(s, bagLoc(0), 'mithril').check).toBe('ok');
    expect(at(s, 0).gems).toEqual([]);
    expect(at(s, 0).sockets).toBeGreaterThanOrEqual(0);
    expect(at(s, 0).sockets).toBeLessThanOrEqual(3);
    expect(s.stash.gems.ruby.tiny).toBe(2);
    expect(s.stash.materials.mithril).toBe(98);
    expect(validateState(s)).toBe(true);
  });

  it('works on a legendary', () => {
    const s = withItem((s) => gear(s, 'ring', { rarity: 'legendary', uniqueId: 'x', affixes: [{ stat: 'damage', value: 5, tier: 0 }] }));
    expect(craft(s, bagLoc(0), 'mithril').check).toBe('ok');
  });

  it('refuses when a gem count would pass the tab cap', () => {
    const s = withItem(socketed);
    s.stash.gems.ruby.tiny = GEM_STASH_STACK;
    const before = snap(s);
    expect(craft(s, bagLoc(0), 'mithril')).toEqual({ check: 'gemsFull' });
    expect(snap(s)).toEqual(before);
  });
});

describe('worn mining gear', () => {
  it('makeMagic on a worn lamp makes it magic', () => {
    const s = withItem((s) => gear(s, 'pickaxe'));
    s.equipped.mining.lamp = gear(s, 'lamp', { rarity: 'normal' });
    expect(craft(s, { where: 'worn', slot: 'lamp' }, 'makeMagic').check).toBe('ok');
    expect(s.equipped.mining.lamp?.rarity).toBe('magic');
    expect(validateState(s)).toBe(true);
  });

  // A lamp's own line is lamp sight, so it never rolls as a modifier there; worn boots can roll it.
  it('a new lamp sight line lights more metres ahead', () => {
    let found = false;
    for (let rng = 1; rng < 500 && !found; rng++) {
      const s = withItem((s) => gear(s, 'pickaxe'), rng);
      s.equipped.mining.boots = gear(s, 'boots', { rarity: 'normal' });
      const sight = deriveStats(s).lampSight;
      expect(craft(s, { where: 'worn', slot: 'boots' }, 'makeMagic').check).toBe('ok');
      if (!(s.equipped.mining.boots?.affixes ?? []).some((l) => l.stat === 'lampSight')) continue;
      found = true;
      expect(deriveStats(s).lampSight).toBeGreaterThan(sight);
      expect(Object.keys(s.ahead)).toHaveLength(deriveStats(s).lampSight);
    }
    expect(found).toBe(true);
  });
});

describe('dragging a material onto gear', () => {
  it('crafts, paying from the dragged stack', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4, sockets: 2 }));
    s.bag[9] = mat(s, 'mithril', 10);
    expect(dropItem(s, bagLoc(9), bagLoc(0))).toBe('ok');
    expect(at(s, 0).sockets).toBeGreaterThanOrEqual(0);
    expect(count(s, 9)).toBe(8);
  });

  it('a refused craft is craftRefused, and nothing moves or swaps', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }));
    s.bag[9] = mat(s, 'tin', 10);
    const before = snap(s);
    expect(dropItem(s, bagLoc(9), bagLoc(0))).toBe('craftRefused');
    expect(snap(s)).toEqual(before);
  });

  it('works on worn and General gear, and from the Materials tab', () => {
    const s = withItem((s) => gear(s, 'pickaxe'));
    s.equipped.mining.gloves = gear(s, 'gloves', { rarity: 'normal' });
    s.stash.general[3] = gear(s, 'ring', { rarity: 'normal' });
    expect(dropItem(s, { where: 'materials', material: 'mithril' }, { where: 'worn', slot: 'gloves' })).toBe('ok');
    s.bag[4] = mat(s, 'mithril', 5);
    expect(dropItem(s, bagLoc(4), { where: 'stash', index: 3 })).toBe('ok');
    expect(count(s, 4)).toBe(3);
    expect(validateState(s)).toBe(true);
  });
});

describe('random craft chains', () => {
  const KINDS: readonly CraftKind[] = ['makeMagic', 'makeRare', 'tin', 'silver', 'mithril', 'voidCrystal', 'diamond'];
  const GEMS = ['ruby', 'sapphire', 'emerald'] as const;

  // Generated gear of several levels, both sets and every rarity, in the bag or worn, crafted on at random with
  // plenty of everything: the state stays valid after every step, and a refused craft leaves it exactly as it was.
  it('keep the state valid, and a refusal changes nothing', () => {
    let pick = 12345;
    const next = (n: number): number => {
      pick = (Math.imul(pick, 1103515245) + 12345) >>> 0;
      return Math.floor((pick / 2 ** 32) * n);
    };
    const seen = new Set<string>();
    for (let chain = 0; chain < 300; chain++) {
      const s = newGame(100 + chain, 0);
      s.rng = 1 + chain * 7919;
      for (const m of MATERIALS) s.stash.materials[m] = MATERIAL_STASH_STACK;
      s.diamonds = 1_000_000;
      const item = rollGear(s, [1, 3, 8, 20, 60][chain % 5] as number, GEAR_SETS[chain % 2] as 'mining' | 'battle',
        RARITIES[Math.floor(chain / 2) % 4]);
      item.gems = Array.from({ length: next(item.sockets + 1) }, () => ({ gem: GEMS[next(3)] as 'ruby', grade: 'tiny' as const }));
      let target: ItemLoc = bagLoc(0);
      if (chain % 3 === 0) {
        s.equipped[GEAR_SETS[chain % 2] as 'mining' | 'battle'][item.slot] = item;
        target = { where: 'worn', slot: item.slot };
      } else {
        s.bag[0] = item;
      }
      expect(validateState(s)).toBe(true);
      for (let step = 0; step < 12; step++) {
        const kind = KINDS[next(KINDS.length)] as CraftKind;
        const before = structuredClone(s);
        const { check } = craft(s, target, kind);
        seen.add(check);
        if (check !== 'ok') expect(s).toEqual(before);
        expect(validateState(s), `chain ${chain} step ${step} ${kind}`).toBe(true);
      }
    }
    // the chains reached every kind of outcome a held item can have (Starsteel and Obsidian retired, so no value-only
    // or remove base crafts remain)
    expect([...seen].sort()).toEqual(['legendary', 'noRoom', 'ok', 'sealed', 'wrongRarity']);
  });
});

describe('targeted crafting', () => {
  const orb = (
    s: GameState,
    family: 'craft' | 'removal' | 'scattering' | 'socketing' | 'clearSockets',
    side: 'prefix' | 'suffix' | undefined,
    tier: 'minor' | 'normal' | 'greater' | undefined,
  ) => ({ id: s.nextId++, type: 'orb' as const, family, side, tier, count: 1 });
  const rare = (s: GameState, ilvl = 9) => gear(s, 'pickaxe', { rarity: 'rare', ilvl, affixes: rareLines() });

  it('a Greater craft orb adds a prefix at a tier of at least 7 on a cap-9 item', () => {
    const s = withItem((s) => rare(s, 9));
    s.bag[9] = orb(s, 'craft', 'prefix', 'greater');
    expect(targetedCraft(s, bagLoc(0), { kind: 'addPrefix', tier: 'greater' })).toEqual({ check: 'ok' });
    const added = at(s, 0).affixes[4];
    if (added === undefined) throw new Error('no line added');
    expect(MOD_SIDE[added.stat]).toBe('prefix');
    expect(added.tier).toBeGreaterThanOrEqual(7);
    expect(added.tier).toBeLessThanOrEqual(11);
    expect(inTier(added)).toBe(true);
    expect(s.bag[9]).toBeNull();
    expect(validateState(s)).toBe(true);
  });

  it('a craft orb only adds: it never rerolls an existing line', () => {
    const s = withItem((s) => rare(s, 9));
    s.bag[9] = orb(s, 'craft', 'prefix', 'minor');
    const before = structuredClone(at(s, 0).affixes);
    expect(targetedCraft(s, bagLoc(0), { kind: 'addPrefix', tier: 'minor' })).toEqual({ check: 'ok' });
    expect(at(s, 0).affixes.slice(0, before.length)).toEqual(before);   // every existing line is untouched
    expect(at(s, 0).affixes).toHaveLength(before.length + 1);
  });

  it('a removal orb removes one random prefix of any tier', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: [line('goldYield', 6, 2), line('diamondYield', 20, 9), line('chestFind', 5, 1), line('gemFind', 17, 7)] }));
    s.bag[9] = orb(s, 'removal', 'prefix', undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'removePrefix' })).toEqual({ check: 'ok' });
    const after = at(s, 0).affixes;
    expect(after).toHaveLength(3);
    // exactly one of the two prefixes went, and both suffixes stay
    const stats = after.map((l) => l.stat);
    expect(stats).toContain('chestFind');
    expect(stats).toContain('gemFind');
    expect(stats.filter((x) => x === 'goldYield' || x === 'diamondYield')).toHaveLength(1);
  });

  it('a removal orb refuses nothingToChange when the side has no rolled line', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: [line('chestFind', 5, 1)] }));
    s.bag[9] = orb(s, 'removal', 'prefix', undefined);
    const before = snap(s);
    expect(targetedCraft(s, bagLoc(0), { kind: 'removePrefix' })).toEqual({ check: 'nothingToChange' });
    expect(snap(s)).toEqual(before);
  });

  it('a scattering orb keeps stats and tiers and rerolls every value', () => {
    const lines = (): ModLine[] => [line('goldYield', 6, 2)];
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: lines() }), 5);
    s.bag[9] = orb(s, 'scattering', undefined, undefined);
    const before = structuredClone(at(s, 0).affixes);
    expect(targetedCraft(s, bagLoc(0), { kind: 'scatter' })).toEqual({ check: 'ok' });
    const m = at(s, 0).affixes[0];
    if (m === undefined) throw new Error('line lost');
    expect([m.stat, m.tier]).toEqual(['goldYield', 2]);   // the stat and tier stay
    expect(inTier(m)).toBe(true);
    expect(at(s, 0).affixes).not.toEqual(before);          // the value rerolled
    expect(s.bag[9]).toBeNull();
    expect(validateState(s)).toBe(true);
  });

  it('a scattering orb leaves crafted lines\' values alone', () => {
    const crafted: ModLine = { stat: 'oreFind', value: 30, tier: 6, crafted: true };
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: [line('goldYield', 6, 2), crafted] }), 5);
    s.bag[9] = orb(s, 'scattering', undefined, undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'scatter' })).toEqual({ check: 'ok' });
    expect(at(s, 0).affixes[1]).toEqual(crafted);
    expect(validateState(s)).toBe(true);
  });

  it('a socketing orb adds one socket, up to the maximum', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', sockets: 1 }));
    s.bag[9] = orb(s, 'socketing', undefined, undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'socketing' })).toEqual({ check: 'ok' });
    expect(at(s, 0).sockets).toBe(2);
    expect(validateState(s)).toBe(true);

    const full = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', sockets: MAX_SOCKETS }));
    full.bag[9] = orb(full, 'socketing', undefined, undefined);
    const before = snap(full);
    expect(targetedCraft(full, bagLoc(0), { kind: 'socketing' })).toEqual({ check: 'socketFull' });
    expect(snap(full)).toEqual(before);
  });

  it('a cleansing orb destroys the socketed runes and leaves the gems', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', sockets: 3, gems: [{ gem: 'ruby', grade: 'tiny' }, { rune: 'fehu' }, { rune: 'isa' }] }));
    s.bag[9] = orb(s, 'clearSockets', undefined, undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'clearSockets' })).toEqual({ check: 'ok' });
    expect(at(s, 0).gems).toEqual([{ gem: 'ruby', grade: 'tiny' }]);
    expect(at(s, 0).sockets).toBe(3);
    expect(s.stash.gems.ruby.tiny).toBe(0);
    expect(s.stash.runes.fehu).toBe(0);   // the runes are destroyed, never returned
    expect(s.stash.runes.isa).toBe(0);
    expect(validateState(s)).toBe(true);
  });

  it('a cleansing orb refuses an item with no runes', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', sockets: 2, gems: [{ gem: 'ruby', grade: 'tiny' }] }));
    s.bag[9] = orb(s, 'clearSockets', undefined, undefined);
    const before = snap(s);
    expect(targetedCraft(s, bagLoc(0), { kind: 'clearSockets' })).toEqual({ check: 'noRunes' });
    expect(snap(s)).toEqual(before);
  });

  it('a removal orb taking a magic item\'s last line makes it normal again, under its base name', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'magic', ilvl: 9, name: 'Old', affixes: [line('goldYield', 6, 2)] }));
    s.bag[9] = orb(s, 'removal', 'prefix', undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'removePrefix' })).toEqual({ check: 'ok' });
    const item = at(s, 0);
    expect([item.rarity, item.affixes, item.name]).toEqual(['normal', [], baseName('pickaxe', 9)]);
    expect(validateState(s)).toBe(true);
  });

  it('refusals change nothing', () => {
    const noOrb = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }));
    const b1 = snap(noOrb);
    expect(targetedCraft(noOrb, bagLoc(0), { kind: 'addPrefix', tier: 'minor' })).toEqual({ check: 'short' });
    expect(snap(noOrb)).toEqual(b1);

    const empty = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }));
    empty.bag[9] = orb(empty, 'clearSockets', undefined, undefined);
    const b2 = snap(empty);
    expect(targetedCraft(empty, bagLoc(0), { kind: 'clearSockets' })).toEqual({ check: 'noRunes' });
    expect(snap(empty)).toEqual(b2);

    expect(canTargetedCraft(withItem((x) => gear(x, 'pickaxe', { rarity: 'normal' })), bagLoc(0), { kind: 'addPrefix', tier: 'minor' }))
      .toBe('wrongRarity');
    expect(canTargetedCraft(withItem((x) => gear(x, 'pickaxe', { rarity: 'rare', sealed: true, affixes: rareLines() })), bagLoc(0), { kind: 'addPrefix', tier: 'minor' }))
      .toBe('sealed');
    // socketing works on a normal item, where modifier orbs don't
    expect(canTargetedCraft(withItem((x) => gear(x, 'pickaxe', { rarity: 'normal', sockets: 1 })), bagLoc(0), { kind: 'socketing' }))
      .toBe('short');
  });
});
