import { describe, expect, it } from 'vitest';
import { GEM_STASH_STACK, MATERIAL_STASH_STACK } from '../../src/core/balance';
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
  it('grow with item level, and the retired Starsteel and Obsidian have no cost', () => {
    const s = newGame(1, 0);
    const item = gear(s, 'pickaxe', { ilvl: 9 });
    const costs = Object.fromEntries((['copper', 'tin', 'iron', 'silver', 'mithril', 'voidCrystal', 'diamond'] as CraftKind[])
      .map((k) => [k, craftCost(k, item.ilvl)]));
    expect(costs).toEqual({ copper: 5, tin: 5, iron: 5, silver: 3, mithril: 3, voidCrystal: 1, diamond: 4 });
    expect(() => craftCost('starsteel', 9)).toThrow();
    expect(() => craftCost('obsidian', 9)).toThrow();
  });
});

describe('every effect', () => {
  it('Copper makes a normal item magic with 1–2 lines and a magic name, for 1 + 2 copper', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4, name: 'Iron Pick' }));
    s.stash.materials.copper = 0;
    s.bag[3] = mat(s, 'copper', 3);
    expect(craft(s, bagLoc(0), 'copper')).toEqual({ check: 'ok' });
    const item = at(s, 0);
    expect(item.rarity).toBe('magic');
    expect(item.affixes.length).toBeGreaterThanOrEqual(1);
    expect(item.affixes.length).toBeLessThanOrEqual(2);
    expect(new Set(sides(item.affixes)).size).toBe(item.affixes.length);
    expect(item.affixes.every(inTier)).toBe(true);
    expect(item.name).toBe(magicName('pickaxe', 4, item.affixes));
    expect(s.bag[3]).toBeNull();
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

  it('Iron is retired: it no longer adds a line, on gear or maps', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'magic', name: 'Keep', affixes: [line('goldYield', 4)] }));
    const before = snap(s);
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
      for (const kind of [...MATERIALS, 'diamond'] as const) {
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
    ...(['copper', 'tin', 'iron', 'silver', 'starsteel', 'obsidian', 'voidCrystal', 'diamond'] as const)
      .map((k): [string, (s: GameState) => GearItem, CraftKind, string] => [`${k} on a legendary`, legendary, k, 'legendary']),
    ['copper on magic', magic, 'copper', 'wrongRarity'],
    ['tin on rare', rare, 'tin', 'wrongRarity'],
    ['tin on normal', normal, 'tin', 'wrongRarity'],
    ['iron on normal', normal, 'iron', 'wrongRarity'],
    ['silver on magic', magic, 'silver', 'wrongRarity'],
    ['void crystal on normal', normal, 'voidCrystal', 'wrongRarity'],
    ['diamond on magic', magic, 'diamond', 'wrongRarity'],
    ['iron on a full rare', (s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: full() }), 'iron', 'wrongRarity'],
    ['diamond on a full rare', (s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: full() }), 'diamond', 'noRoom'],
    ['starsteel on a normal', normal, 'starsteel', 'wrongRarity'],
    ['obsidian on a rare', (s) => gear(s, 'pickaxe', { rarity: 'rare' }), 'obsidian', 'wrongRarity'],
  ];
  for (const [name, item, kind, check] of cases) {
    it(`${name} → ${check}`, () => {
      const s = withItem(item);
      s.bag[7] = mat(s, kind === 'diamond' ? 'copper' : kind, 20);
      const before = snap(s);
      expect(canCraft(s, bagLoc(0), kind)).toBe(check);
      expect(craft(s, bagLoc(0), kind, bagLoc(7))).toEqual({ check });
      expect(snap(s)).toEqual(before);
    });
  }

  it('too little material is short; too few Diamonds too', () => {
    const s = withItem(normal);
    s.stash.materials.copper = 0;
    s.bag[5] = mat(s, 'copper', 2);
    s.diamonds = 0;
    s.bag[1] = gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() });
    const before = snap(s);
    expect(craft(s, bagLoc(0), 'copper', bagLoc(5))).toEqual({ check: 'short' });
    expect(craft(s, bagLoc(1), 'diamond')).toEqual({ check: 'short' });
    expect(snap(s)).toEqual(before);
  });

  it('a craft on anything but gear is notGear', () => {
    const s = withItem(normal);
    s.bag[2] = mat(s, 'tin', 5);
    const before = snap(s);
    expect(craft(s, bagLoc(1), 'copper')).toEqual({ check: 'notGear' });
    expect(craft(s, bagLoc(2), 'copper')).toEqual({ check: 'notGear' });
    expect(craft(s, { where: 'worn', slot: 'lamp' }, 'copper')).toEqual({ check: 'notGear' });
    expect(snap(s)).toEqual(before);
  });
});

describe('paying', () => {
  const setup = (): GameState => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 }));
    s.stash.materials.copper = 50;
    s.bag[5] = mat(s, 'copper', 2);
    s.bag[9] = mat(s, 'copper', 10);
    return s;
  };

  it('takes from the dragged stack first', () => {
    const s = setup();
    expect(craft(s, bagLoc(0), 'copper', bagLoc(9)).check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.copper]).toEqual([2, 7, 50]);
  });

  it('without a stack, takes from the bag stacks in order', () => {
    const s = setup();
    expect(craft(s, bagLoc(0), 'copper').check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.copper]).toEqual([null, 9, 50]);
  });

  it('then from the Materials tab', () => {
    const s = setup();
    s.bag[5] = mat(s, 'copper', 1);
    s.bag[9] = null;
    expect(craft(s, bagLoc(0), 'copper').check).toBe('ok');
    expect([count(s, 5), s.stash.materials.copper]).toEqual([null, 48]);
  });

  it('pays only once the effect is done, so a craft that fails part-way spends nothing', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', sockets: 1 }));
    Object.defineProperty(at(s, 0), 'sockets', { get: () => 1, set: () => { throw new Error('mid-craft'); } });
    expect(() => craft(s, bagLoc(0), 'mithril')).toThrow('mid-craft');
    expect(s.stash.materials.mithril).toBe(100);
  });

  it('from the tab slot first when that is the stack', () => {
    const s = setup();
    expect(craft(s, bagLoc(0), 'copper', { where: 'materials', material: 'copper' }).check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.copper]).toEqual([2, 10, 47]);
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
  it('Copper on a worn lamp makes it magic', () => {
    const s = withItem((s) => gear(s, 'pickaxe'));
    s.equipped.mining.lamp = gear(s, 'lamp', { rarity: 'normal' });
    expect(craft(s, { where: 'worn', slot: 'lamp' }, 'copper').check).toBe('ok');
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
      expect(craft(s, { where: 'worn', slot: 'boots' }, 'copper').check).toBe('ok');
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
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 }));
    s.bag[9] = mat(s, 'copper', 10);
    expect(dropItem(s, bagLoc(9), bagLoc(0))).toBe('ok');
    expect(at(s, 0).rarity).toBe('magic');
    expect(count(s, 9)).toBe(7);
  });

  it('a refused craft is craftRefused, and nothing moves or swaps', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }));
    s.bag[9] = mat(s, 'copper', 10);
    const before = snap(s);
    expect(dropItem(s, bagLoc(9), bagLoc(0))).toBe('craftRefused');
    expect(snap(s)).toEqual(before);
  });

  it('works on worn and General gear, and from the Materials tab', () => {
    const s = withItem((s) => gear(s, 'pickaxe'));
    s.equipped.mining.gloves = gear(s, 'gloves', { rarity: 'normal' });
    s.stash.general[3] = gear(s, 'ring', { rarity: 'normal' });
    expect(dropItem(s, { where: 'materials', material: 'copper' }, { where: 'worn', slot: 'gloves' })).toBe('ok');
    expect(s.equipped.mining.gloves?.rarity).toBe('magic');
    s.bag[4] = mat(s, 'copper', 5);
    expect(dropItem(s, bagLoc(4), { where: 'stash', index: 3 })).toBe('ok');
    expect(s.stash.general[3]?.rarity).toBe('magic');
    expect(count(s, 4)).toBe(2);
    expect(validateState(s)).toBe(true);
  });
});

describe('random craft chains', () => {
  const KINDS: readonly CraftKind[] = [...MATERIALS, 'diamond'];
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
  const orb = (s: GameState, family: 'craft' | 'removal' | 'scattering', side: 'prefix' | 'suffix' | undefined, tier: 'minor' | 'normal' | 'greater') =>
    ({ id: s.nextId++, type: 'orb' as const, family, side, tier, count: 1 });
  const rare = (s: GameState, ilvl = 9) => gear(s, 'pickaxe', { rarity: 'rare', ilvl, affixes: rareLines() });
  // A rare whose prefixes span the bands: goldYield at T2 (low), diamondYield at T9 (high), plus a low suffix and a
  // high suffix, on a cap-9 item (⌊9/3⌋ = 3, ⌊18/3⌋ = 6).
  const mixedLines = (): ModLine[] => [line('goldYield', 6, 2), line('diamondYield', 20, 9), line('chestFind', 5, 1), line('gemFind', 17, 7)];

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

  it('a Minor craft orb rerolls a chosen line, keeping its stat, in tiers 1–3', () => {
    const s = withItem((s) => rare(s, 9), 9);
    s.bag[9] = orb(s, 'craft', 'prefix', 'minor');
    const before = structuredClone(at(s, 0).affixes);
    expect(targetedCraft(s, bagLoc(0), { kind: 'rerollPrefix', index: 0, tier: 'minor' })).toEqual({ check: 'ok' });
    const item = at(s, 0);
    expect(item.affixes.map((l) => l.stat)).toEqual(before.map((l) => l.stat));
    const first = item.affixes[0];
    if (first === undefined) throw new Error('affix lost');
    expect(first.tier).toBeGreaterThanOrEqual(1);
    expect(first.tier).toBeLessThanOrEqual(3);
    expect(inTier(first)).toBe(true);
    expect(s.bag[9]).toBeNull();
    expect(validateState(s)).toBe(true);
  });

  it('a Minor removal orb removes only a low-band prefix; a Greater one only a high-band prefix', () => {
    const low = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: mixedLines() }));
    low.bag[9] = orb(low, 'removal', 'prefix', 'minor');
    expect(targetedCraft(low, bagLoc(0), { kind: 'removePrefix', tier: 'minor' })).toEqual({ check: 'ok' });
    expect(at(low, 0).affixes).toHaveLength(3);
    expect(at(low, 0).affixes.map((l) => l.stat)).toContain('diamondYield');   // the high prefix survives
    expect(at(low, 0).affixes.map((l) => l.stat)).not.toContain('goldYield');  // the low prefix went

    const high = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: mixedLines() }));
    high.bag[9] = orb(high, 'removal', 'prefix', 'greater');
    expect(targetedCraft(high, bagLoc(0), { kind: 'removePrefix', tier: 'greater' })).toEqual({ check: 'ok' });
    expect(at(high, 0).affixes).toHaveLength(3);
    expect(at(high, 0).affixes.map((l) => l.stat)).toContain('goldYield');     // the low prefix survives
    expect(at(high, 0).affixes.map((l) => l.stat)).not.toContain('diamondYield'); // the high prefix went
  });

  it('a Normal removal orb removes a line at any tier, and refuses nothingToChange when its band is empty', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: [line('goldYield', 20, 9), line('chestFind', 5, 1)] }));
    s.bag[9] = orb(s, 'removal', 'prefix', 'normal');
    expect(targetedCraft(s, bagLoc(0), { kind: 'removePrefix', tier: 'normal' })).toEqual({ check: 'ok' });
    expect(at(s, 0).affixes).toEqual([line('chestFind', 5, 1)]);   // the only prefix (T9) went

    const none = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: [line('goldYield', 20, 9), line('chestFind', 5, 1)] }));
    none.bag[9] = orb(none, 'removal', 'prefix', 'minor');   // no prefix ≤ T3
    const before = snap(none);
    expect(targetedCraft(none, bagLoc(0), { kind: 'removePrefix', tier: 'minor' })).toEqual({ check: 'nothingToChange' });
    expect(snap(none)).toEqual(before);
  });

  it('a scattering orb keeps stats and tiers, rerolls values, and a Greater keeps at least a Minor\'s value', () => {
    const lines = (): ModLine[] => [line('goldYield', 6, 2)];
    const run = (tier: 'minor' | 'greater') => {
      const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: lines() }), 5);
      s.bag[9] = orb(s, 'scattering', undefined, tier);
      return s;
    };
    const minor = run('minor');
    const greater = run('greater');
    expect(targetedCraft(minor, bagLoc(0), { kind: 'scatter', tier: 'minor' })).toEqual({ check: 'ok' });
    expect(targetedCraft(greater, bagLoc(0), { kind: 'scatter', tier: 'greater' })).toEqual({ check: 'ok' });
    const m = at(minor, 0).affixes[0];
    const g = at(greater, 0).affixes[0];
    if (m === undefined || g === undefined) throw new Error('line lost');
    expect([m.stat, m.tier]).toEqual(['goldYield', 2]);
    expect([g.stat, g.tier]).toEqual(['goldYield', 2]);
    expect(inTier(m)).toBe(true);
    expect(inTier(g)).toBe(true);
    expect(g.value).toBeGreaterThanOrEqual(m.value);   // the same first roll, plus two more
    expect(validateState(minor)).toBe(true);
    expect(validateState(greater)).toBe(true);
  });

  it('a scattering orb leaves crafted lines\' values alone', () => {
    const crafted: ModLine = { stat: 'oreFind', value: 30, tier: 6, crafted: true };
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', ilvl: 9, affixes: [line('goldYield', 6, 2), crafted] }), 5);
    s.bag[9] = orb(s, 'scattering', undefined, 'normal');
    expect(targetedCraft(s, bagLoc(0), { kind: 'scatter', tier: 'normal' })).toEqual({ check: 'ok' });
    expect(at(s, 0).affixes[1]).toEqual(crafted);
    expect(validateState(s)).toBe(true);
  });

  it('a removal orb taking a magic item\'s last line makes it normal again, under its base name', () => {
    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'magic', ilvl: 9, name: 'Old', affixes: [line('goldYield', 6, 2)] }));
    s.bag[9] = orb(s, 'removal', 'prefix', 'normal');
    expect(targetedCraft(s, bagLoc(0), { kind: 'removePrefix', tier: 'normal' })).toEqual({ check: 'ok' });
    const item = at(s, 0);
    expect([item.rarity, item.affixes, item.name]).toEqual(['normal', [], baseName('pickaxe', 9)]);
    expect(validateState(s)).toBe(true);
  });

  it('refusals change nothing', () => {
    const noOrb = withItem((s) => gear(s, 'pickaxe', { rarity: 'rare', affixes: rareLines() }));
    const b1 = snap(noOrb);
    expect(targetedCraft(noOrb, bagLoc(0), { kind: 'addPrefix', tier: 'minor' })).toEqual({ check: 'short' });
    expect(snap(noOrb)).toEqual(b1);

    const s = withItem((s) => gear(s, 'pickaxe', { rarity: 'magic', affixes: [line('goldYield', 4)] }));
    const b2 = snap(s);
    expect(targetedCraft(s, bagLoc(0), { kind: 'rerollSuffix', index: 0, tier: 'minor' })).toEqual({ check: 'noSuchAffix' });
    expect(snap(s)).toEqual(b2);

    expect(canTargetedCraft(withItem((x) => gear(x, 'pickaxe', { rarity: 'normal' })), bagLoc(0), { kind: 'addPrefix', tier: 'minor' }))
      .toBe('wrongRarity');
    expect(canTargetedCraft(withItem((x) => gear(x, 'pickaxe', { rarity: 'rare', sealed: true, affixes: rareLines() })), bagLoc(0), { kind: 'addPrefix', tier: 'minor' }))
      .toBe('sealed');
  });
});
