import { describe, expect, it } from 'vitest';
import { MATERIAL_STASH_STACK, MAP_CRAFT_SOULS_PER_TIER, MAX_MAP_MODS } from '../../src/core/balance';
import { canCraft, craft, craftCost, mapCraftSouls, rollMapMods, type CraftKind, type TemperOutcome } from '../../src/core/crafting';
import { dropItem } from '../../src/core/inventory';
import { MAP_MOD_KINDS, MATERIALS } from '../../src/core/items';
import type { MapItem, MapMod, MapModKind, Material, MaterialItem } from '../../src/core/items';
import { mapModRange } from '../../src/core/mapMods';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import type { CraftResult, GameState, ItemLoc } from '../../src/core/types';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';

const bagLoc = (index: number): ItemLoc => ({ where: 'bag', index });
const mapsLoc = (index: number): ItemLoc => ({ where: 'maps', index });
const mat = (s: GameState, material: Material, count: number): MaterialItem => ({ id: s.nextId++, type: 'material', material, count });
const at = (s: GameState, index: number): MapItem => s.bag[index] as MapItem;
const count = (s: GameState, index: number): number | null => (s.bag[index] as MaterialItem | null)?.count ?? null;
/** A modifier at the bottom of its tier's range. */
const mod = (kind: MapModKind, tier = 1): MapMod => ({ kind, tier, value: mapModRange(kind, tier).lo });
const inRange = (m: MapMod): boolean => {
  const { lo, hi } = mapModRange(m.kind, m.tier);
  return m.value >= lo && m.value <= hi;
};
const kinds = (mods: readonly MapMod[]) => mods.map((m) => m.kind);
const unique = (mods: readonly MapMod[]): boolean => new Set(kinds(mods)).size === mods.length;
const identity = (m: MapItem) => [m.id, m.tier, m.metre];
/** Everything a craft may spend or change. */
const snap = (s: GameState) => structuredClone({
  bag: s.bag, stash: s.stash, diamonds: s.diamonds, souls: s.souls, equipped: s.equipped, rng: s.rng, nextId: s.nextId,
});

function mapOf(s: GameState, p: Partial<MapItem> = {}): MapItem {
  return { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [], ...p };
}

/** A state with plenty of every material, Diamonds and Souls, and the map at bag[0]. */
function withMap(map: (s: GameState) => MapItem, rng = 1): GameState {
  const s = newGame(1, 0);
  for (const m of MATERIALS) s.stash.materials[m] = 100;
  s.diamonds = 100;
  s.souls = 10_000;
  s.bag[0] = map(s);
  s.rng = rng;
  return s;
}

const magic = (s: GameState, mods: MapMod[] = [mod('monsterLife', 2)]) => mapOf(s, { rarity: 'magic', mods });
const rare = (s: GameState, mods: MapMod[] = [mod('monsterLife', 2), mod('monsterSpeed', 3), mod('hardened', 1)]) =>
  mapOf(s, { rarity: 'rare', mods });
const allSix = (): MapMod[] => MAP_MOD_KINDS.map((k) => mod(k, 2));

describe('costs', () => {
  it('a map pays its material by tier, and 5 Souls a tier', () => {
    expect(MAP_CRAFT_SOULS_PER_TIER).toBe(5);
    const s = newGame(1, 0);
    expect(mapCraftSouls(mapOf(s, { tier: 4 }))).toBe(20);
    expect(mapCraftSouls(mapOf(s, { tier: 11 }))).toBe(55);
    expect(craftCost('copper', 4)).toBe(3);
    expect(craftCost('silver', 9)).toBe(3);
    expect(craftCost('voidCrystal', 40)).toBe(1);
  });

  it('Copper on a normal tier-4 map spends 1 + 2 = 3 copper and 20 Souls', () => {
    const s = withMap((s) => mapOf(s, { tier: 4 }));
    s.stash.materials.copper = 0;
    s.bag[3] = mat(s, 'copper', 3);
    s.souls = 20;
    expect(craft(s, bagLoc(0), 'copper')).toEqual({ check: 'ok' });
    expect([s.bag[3], s.souls]).toEqual([null, 0]);
    expect(validateState(s)).toBe(true);
  });

  it('pays from the dragged stack first, then the other stacks, then the Materials tab', () => {
    const s = withMap((s) => mapOf(s, { tier: 4 }));
    s.stash.materials.copper = 50;
    s.bag[5] = mat(s, 'copper', 2);
    s.bag[9] = mat(s, 'copper', 10);
    expect(craft(s, bagLoc(0), 'copper', bagLoc(9)).check).toBe('ok');
    expect([count(s, 5), count(s, 9), s.stash.materials.copper, s.souls]).toEqual([2, 7, 50, 10_000 - 20]);
  });
});

describe('rolling map modifiers', () => {
  it('picks kinds the map lacks, tiers up to its own and values in range, from state.rng', () => {
    for (let rng = 1; rng < 60; rng++) {
      const s = withMap((s) => mapOf(s, { tier: 3, rarity: 'rare', mods: [mod('monsterLife'), mod('bossPower')] }), rng);
      const map = at(s, 0);
      const mods = rollMapMods(s, map, 4);
      expect(s.rng).not.toBe(rng);
      expect(mods).toHaveLength(4);
      expect(unique([...map.mods, ...mods])).toBe(true);
      for (const m of mods) {
        expect(m.tier).toBeGreaterThanOrEqual(1);
        expect(m.tier).toBeLessThanOrEqual(3);
        expect(inRange(m)).toBe(true);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = withMap((s) => mapOf(s, { tier: 9 }), 77);
    const b = withMap((s) => mapOf(s, { tier: 9 }), 77);
    expect(rollMapMods(a, at(a, 0), 6)).toEqual(rollMapMods(b, at(b, 0), 6));
    expect(a.rng).toBe(b.rng);
  });
});

describe('every rule', () => {
  it('Copper makes a normal map magic with 1–2 modifiers', () => {
    const counts = new Set<number>();
    for (let rng = 1; rng < 40; rng++) {
      const s = withMap((s) => mapOf(s), rng);
      const before = identity(at(s, 0));
      expect(craft(s, bagLoc(0), 'copper')).toEqual({ check: 'ok' });
      const map = at(s, 0);
      expect(map.rarity).toBe('magic');
      expect([1, 2]).toContain(map.mods.length);
      expect(unique(map.mods) && map.mods.every(inRange)).toBe(true);
      expect(map.mods.every((m) => m.tier <= map.tier)).toBe(true);
      expect(identity(map)).toEqual(before);
      expect(validateState(s)).toBe(true);
      counts.add(map.mods.length);
    }
    expect([...counts].sort()).toEqual([1, 2]);
  });

  it('Iron adds to a 1-modifier magic map, then turns a 2-modifier one rare with 3', () => {
    const s = withMap((s) => magic(s));
    const before = identity(at(s, 0));
    expect(craft(s, bagLoc(0), 'iron')).toEqual({ check: 'ok' });
    expect(at(s, 0).rarity).toBe('magic');
    expect(at(s, 0).mods).toHaveLength(2);
    expect(at(s, 0).mods[0]).toEqual(mod('monsterLife', 2));
    const two = structuredClone(at(s, 0).mods);
    expect(craft(s, bagLoc(0), 'iron')).toEqual({ check: 'ok' });
    const map = at(s, 0);
    expect(map.rarity).toBe('rare');
    expect(map.mods).toHaveLength(3);
    expect(map.mods.slice(0, 2)).toEqual(two);
    expect(unique(map.mods) && map.mods.every(inRange)).toBe(true);
    expect(identity(map)).toEqual(before);
    expect(s.stash.materials.iron).toBe(100 - 2 * 3);
    expect(s.souls).toBe(10_000 - 2 * 20);
    expect(validateState(s)).toBe(true);
  });

  it('Iron adds a modifier to a rare map with room', () => {
    const s = withMap((s) => rare(s));
    const before = structuredClone(at(s, 0).mods);
    expect(craft(s, bagLoc(0), 'iron')).toEqual({ check: 'ok' });
    expect(at(s, 0).rarity).toBe('rare');
    expect(at(s, 0).mods.slice(0, 3)).toEqual(before);
    expect(at(s, 0).mods).toHaveLength(4);
    expect(unique(at(s, 0).mods)).toBe(true);
    expect(validateState(s)).toBe(true);
  });

  it('Silver rerolls a rare map to 4–6 new modifiers', () => {
    const counts = new Set<number>();
    for (let rng = 1; rng < 60; rng++) {
      const s = withMap((s) => rare(s), rng);
      const before = identity(at(s, 0));
      expect(craft(s, bagLoc(0), 'silver')).toEqual({ check: 'ok' });
      const map = at(s, 0);
      expect(map.rarity).toBe('rare');
      expect(map.mods.length).toBeGreaterThanOrEqual(4);
      expect(map.mods.length).toBeLessThanOrEqual(MAX_MAP_MODS);
      expect(unique(map.mods) && map.mods.every(inRange)).toBe(true);
      expect(map.mods.every((m) => m.tier <= map.tier)).toBe(true);
      expect(identity(map)).toEqual(before);
      expect(validateState(s)).toBe(true);
      counts.add(map.mods.length);
    }
    expect([...counts].sort()).toEqual([4, 5, 6]);
  });

  it('Obsidian removes one modifier from a rare map, which stays rare', () => {
    const s = withMap((s) => rare(s));
    const before = structuredClone(at(s, 0).mods);
    expect(craft(s, bagLoc(0), 'obsidian')).toEqual({ check: 'ok' });
    expect(at(s, 0).rarity).toBe('rare');
    expect(at(s, 0).mods).toHaveLength(2);
    for (const m of at(s, 0).mods) expect(before).toContainEqual(m);
    expect(s.stash.materials.obsidian).toBe(99);
  });

  it('Obsidian taking a rare map\'s last modifier leaves it rare', () => {
    const s = withMap((s) => rare(s, [mod('bossPower', 3)]));
    expect(craft(s, bagLoc(0), 'obsidian')).toEqual({ check: 'ok' });
    expect([at(s, 0).rarity, at(s, 0).mods]).toEqual(['rare', []]);
    expect(validateState(s)).toBe(true);
  });

  it('Obsidian keeps a 2-modifier magic map magic, and its last modifier makes it normal, for Copper', () => {
    const s = withMap((s) => magic(s, [mod('monsterLife', 2), mod('weakHealing', 1)]));
    const before = identity(at(s, 0));
    expect(craft(s, bagLoc(0), 'obsidian')).toEqual({ check: 'ok' });
    expect(at(s, 0).rarity).toBe('magic');
    expect(at(s, 0).mods).toHaveLength(1);
    expect(craft(s, bagLoc(0), 'obsidian')).toEqual({ check: 'ok' });
    expect([at(s, 0).rarity, at(s, 0).mods]).toEqual(['normal', []]);
    expect(identity(at(s, 0))).toEqual(before);
    expect(validateState(s)).toBe(true);
    expect(canCraft(s, bagLoc(0), 'copper')).toBe('ok');
    expect(canCraft(s, bagLoc(0), 'obsidian')).toBe('nothingToChange');
  });
});

describe('temper', () => {
  // The T6 modifier already sits at the map's tier + 2.
  const tempered = (): MapMod[] => [mod('monsterLife', 2), mod('monsterDamage', 3), mod('weakHealing', 1), mod('hardened', 6)];
  const setup = (rng: number, map: (s: GameState) => MapItem = (s) => rare(s, tempered())): GameState => withMap(map, rng);
  const outcomes = new Map<TemperOutcome, number>();
  for (let rng = 1; outcomes.size < 4 && rng < 500; rng++) {
    const temper = craft(setup(rng), bagLoc(0), 'voidCrystal').temper;
    if (temper !== undefined && !outcomes.has(temper)) outcomes.set(temper, rng);
  }
  const seed = (o: TemperOutcome): number => outcomes.get(o) ?? 0;

  it('finds a seed for every outcome', () => {
    expect([...outcomes.keys()].sort()).toEqual(['craftedLine', 'nothing', 'raiseTiers', 'ruin']);
  });

  const effects: Record<TemperOutcome, (before: MapMod[], after: MapMod[]) => void> = {
    craftedLine: (before, after) => {
      expect(after.slice(0, 4)).toEqual(before);
      expect(after).toHaveLength(5);
      const added = after[4] as MapMod;
      expect(added.tier).toBe(5);
      expect(inRange(added)).toBe(true);
      expect(kinds(before)).not.toContain(added.kind);
    },
    raiseTiers: (before, after) => {
      expect(kinds(after)).toEqual(kinds(before));
      expect(after.map((m) => m.tier)).toEqual([3, 4, 2, 6]);
      expect(after.every(inRange)).toBe(true);
    },
    nothing: (before, after) => expect(after).toEqual(before),
    ruin: (before, after) => {
      expect(kinds(after)).toEqual(kinds(before));
      expect(after.every((m) => m.tier === 1 && inRange(m))).toBe(true);
    },
  };

  for (const outcome of ['craftedLine', 'raiseTiers', 'nothing', 'ruin'] as const) {
    it(`${outcome}: its effect, then the map is sealed and refuses every craft`, () => {
      const s = setup(seed(outcome));
      const before = structuredClone(at(s, 0).mods);
      const id = identity(at(s, 0));
      expect(craft(s, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: outcome });
      effects[outcome](before, at(s, 0).mods);
      expect(at(s, 0).sealed).toBe(true);
      expect(at(s, 0).rarity).toBe('rare');
      expect(identity(at(s, 0))).toEqual(id);
      expect([s.stash.materials.voidCrystal, s.souls]).toEqual([99, 10_000 - 20]);
      expect(validateState(s)).toBe(true);
      const sealed = snap(s);
      for (const kind of [...MATERIALS, 'diamond'] as const) {
        expect(canCraft(s, bagLoc(0), kind)).toBe('sealed');
        expect(craft(s, bagLoc(0), kind)).toEqual({ check: 'sealed' });
      }
      expect(snap(s)).toEqual(sealed);
    });
  }

  it('a crafted line on a map with all 6 kinds is nothing', () => {
    const s = setup(seed('craftedLine'), (s) => rare(s, allSix()));
    expect(craft(s, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: 'nothing' });
    expect(at(s, 0).mods).toEqual(allSix());
    expect(at(s, 0).sealed).toBe(true);
  });

  it('a crafted line turns a 2-modifier magic map rare with 3, and gives a 1-modifier one a second', () => {
    const two = setup(seed('craftedLine'), (s) => magic(s, [mod('monsterLife', 2), mod('bossPower', 1)]));
    expect(craft(two, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: 'craftedLine' });
    expect([at(two, 0).rarity, at(two, 0).mods.length, at(two, 0).mods[2]?.tier]).toEqual(['rare', 3, 5]);
    expect(validateState(two)).toBe(true);
    const one = setup(seed('craftedLine'), (s) => magic(s));
    expect(craft(one, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: 'craftedLine' });
    expect([at(one, 0).rarity, at(one, 0).mods.length, at(one, 0).mods[1]?.tier]).toEqual(['magic', 2, 5]);
    expect(validateState(one)).toBe(true);
  });

  it('works on a magic map and keeps it magic for the other outcomes', () => {
    for (const outcome of ['raiseTiers', 'nothing', 'ruin'] as const) {
      const s = setup(seed(outcome), (s) => magic(s));
      expect(craft(s, bagLoc(0), 'voidCrystal')).toEqual({ check: 'ok', temper: outcome });
      expect([at(s, 0).rarity, at(s, 0).mods.length, at(s, 0).sealed]).toEqual(['magic', 1, true]);
      expect(validateState(s)).toBe(true);
    }
  });
});

describe('refusals change nothing', () => {
  const normal = (s: GameState) => mapOf(s);
  const fullRare = (s: GameState) => rare(s, allSix());
  const cases: [string, (s: GameState) => MapItem, CraftKind, string][] = [
    ...(['tin', 'mithril', 'starsteel', 'diamond'] as const).flatMap((k) =>
      [['normal', normal], ['magic', magic], ['rare', rare]].map(([r, m]): [string, (s: GameState) => MapItem, CraftKind, string] =>
        [`${k} on a ${r as string} map`, m as (s: GameState) => MapItem, k, 'notForMaps'])),
    ['copper on magic', magic, 'copper', 'wrongRarity'],
    ['copper on rare', rare, 'copper', 'wrongRarity'],
    ['iron on normal', normal, 'iron', 'wrongRarity'],
    ['silver on normal', normal, 'silver', 'wrongRarity'],
    ['silver on magic', magic, 'silver', 'wrongRarity'],
    ['void crystal on normal', normal, 'voidCrystal', 'wrongRarity'],
    ['iron on a rare with 6', fullRare, 'iron', 'noRoom'],
    ['obsidian on normal', normal, 'obsidian', 'nothingToChange'],
    ['obsidian on a rare with none', (s) => rare(s, []), 'obsidian', 'nothingToChange'],
    ['tin on a sealed map', (s) => ({ ...rare(s), sealed: true }), 'tin', 'sealed'],
    ['obsidian on a sealed map', (s) => ({ ...rare(s), sealed: true }), 'obsidian', 'sealed'],
  ];
  for (const [name, map, kind, check] of cases) {
    it(`${name} → ${check}`, () => {
      const s = withMap(map);
      s.bag[7] = mat(s, kind === 'diamond' ? 'copper' : kind, 20);
      const before = snap(s);
      expect(canCraft(s, bagLoc(0), kind)).toBe(check);
      expect(craft(s, bagLoc(0), kind, bagLoc(7))).toEqual({ check });
      expect(snap(s)).toEqual(before);
    });
  }

  it('a material that is not for maps is refused before its own rule or the cost', () => {
    const s = withMap(normal);
    s.stash.materials.starsteel = 0;
    s.souls = 0;
    const before = snap(s);
    expect(craft(s, bagLoc(0), 'starsteel')).toEqual({ check: 'notForMaps' });
    expect(snap(s)).toEqual(before);
  });

  it('too little material is short, checked before the Souls', () => {
    const s = withMap(normal);
    s.stash.materials.copper = 0;
    s.bag[5] = mat(s, 'copper', 2);
    s.souls = 0;
    const before = snap(s);
    expect(canCraft(s, bagLoc(0), 'copper')).toBe('short');
    expect(craft(s, bagLoc(0), 'copper', bagLoc(5))).toEqual({ check: 'short' });
    expect(snap(s)).toEqual(before);
  });

  it('too few Souls is noSouls', () => {
    const s = withMap(normal);
    s.souls = 19;
    const before = snap(s);
    expect(canCraft(s, bagLoc(0), 'copper')).toBe('noSouls');
    expect(craft(s, bagLoc(0), 'copper')).toEqual({ check: 'noSouls' });
    expect(snap(s)).toEqual(before);
    s.souls = 20;
    expect(craft(s, bagLoc(0), 'copper')).toEqual({ check: 'ok' });
  });

  it('a sealed map refuses every craft', () => {
    const s = withMap((s) => ({ ...rare(s), sealed: true }));
    const before = snap(s);
    for (const kind of [...MATERIALS, 'diamond'] as const) expect(craft(s, bagLoc(0), kind)).toEqual({ check: 'sealed' });
    expect(snap(s)).toEqual(before);
  });
});

describe('dragging a material onto a map', () => {
  it('crafts a map in the bag, paying from the dragged stack', () => {
    const s = withMap((s) => mapOf(s));
    s.bag[9] = mat(s, 'copper', 10);
    expect(dropItem(s, bagLoc(9), bagLoc(0))).toBe('ok');
    expect(at(s, 0).rarity).toBe('magic');
    expect([count(s, 9), s.souls]).toEqual([7, 10_000 - 20]);
  });

  it('crafts a map in the Maps tab, from a bag stack or the Materials tab', () => {
    const s = withMap((s) => mapOf(s));
    s.stash.maps[2] = mapOf(s, { tier: 6 });
    s.bag[4] = mat(s, 'copper', 5);
    expect(dropItem(s, bagLoc(4), mapsLoc(2))).toBe('ok');
    expect(s.stash.maps[2]?.rarity).toBe('magic');
    expect(count(s, 4)).toBe(1);
    expect(dropItem(s, { where: 'materials', material: 'obsidian' }, mapsLoc(2))).toBe('ok');
    expect(s.stash.materials.obsidian).toBe(99);
    expect(validateState(s)).toBe(true);
  });

  it('a refused craft is craftRefused, tells the listener why, and nothing moves or swaps', () => {
    const s = withMap((s) => magic(s));
    s.stash.maps[1] = mapOf(s);
    s.bag[9] = mat(s, 'copper', 10);
    s.bag[8] = mat(s, 'tin', 10);
    const before = snap(s);
    const heard: CraftResult[] = [];
    expect(dropItem(s, bagLoc(9), bagLoc(0), (_t, _i, r) => heard.push(r))).toBe('craftRefused');
    expect(dropItem(s, bagLoc(8), mapsLoc(1), (_t, _i, r) => heard.push(r))).toBe('craftRefused');
    expect(heard).toEqual([{ check: 'wrongRarity' }, { check: 'notForMaps' }]);
    expect(snap(s)).toEqual(before);
  });

  it('goes through the store, which notes the craft', () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    const s = store.state;
    s.souls = 100;
    s.stash.maps[0] = mapOf(s);
    s.stash.materials.copper = 10;
    expect(store.craft(mapsLoc(0), 'copper')).toEqual({ check: 'ok' });
    expect(store.lastCraft).toMatchObject({ kind: 'copper', check: 'ok', target: mapsLoc(0) });
    expect([s.stash.maps[0]?.rarity, s.souls]).toEqual(['magic', 80]);
    expect(store.craft(mapsLoc(0), 'tin')).toEqual({ check: 'notForMaps' });
  });
});

describe('random craft chains on maps', () => {
  const KINDS: readonly CraftKind[] = [...MATERIALS, 'diamond'];

  // Maps of tier 1–20 and every rarity, in the bag or the Maps tab, crafted on at random with plenty of everything:
  // the state stays valid after every step, and a refused craft leaves it exactly as it was.
  it('keep the state valid, and a refusal changes nothing', () => {
    let pick = 54321;
    const next = (n: number): number => {
      pick = (Math.imul(pick, 1103515245) + 12345) >>> 0;
      return Math.floor((pick / 2 ** 32) * n);
    };
    const seen = new Set<string>();
    for (let chain = 0; chain < 300; chain++) {
      const s = newGame(200 + chain, 0);
      s.rng = 1 + chain * 7919;
      for (const m of MATERIALS) s.stash.materials[m] = MATERIAL_STASH_STACK;
      s.diamonds = 1_000_000;
      s.souls = 1_000_000_000;
      const map = mapOf(s, { tier: 1 + (chain % 20), metre: 1 + chain });
      const rarity = (['normal', 'magic', 'rare'] as const)[Math.floor(chain / 20) % 3] as MapItem['rarity'];
      map.rarity = rarity;
      map.mods = rarity === 'normal' ? [] : rollMapMods(s, map, rarity === 'magic' ? 1 + next(2) : next(MAX_MAP_MODS + 1));
      const inBag = chain % 2 === 0;
      const target = inBag ? bagLoc(0) : mapsLoc(chain % 10);
      if (inBag) s.bag[0] = map;
      else s.stash.maps[chain % 10] = map;
      expect(validateState(s)).toBe(true);
      for (let step = 0; step < 16; step++) {
        const kind = KINDS[next(KINDS.length)] as CraftKind;
        const before = structuredClone(s);
        const { check } = craft(s, target, kind);
        seen.add(check);
        if (check !== 'ok') expect(s).toEqual(before);
        expect(validateState(s), `chain ${chain} step ${step} ${kind}`).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual(['noRoom', 'notForMaps', 'nothingToChange', 'ok', 'sealed', 'wrongRarity']);
  });
});
