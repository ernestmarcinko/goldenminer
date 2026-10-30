import { describe, expect, it } from 'vitest';
import { MATERIAL_STASH_STACK, MAP_CRAFT_SOULS_PER_TIER, MAX_MAP_MODS } from '../../src/core/balance';
import { canCraft, craft, craftCost, mapUpgradeSouls, rollMapMods, targetedCraft, type CraftKind } from '../../src/core/crafting';
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
const mapsLoc = (tier: number, index = 0): ItemLoc => ({ where: 'maps', tier, index });
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
  it('a map upgrade spends Souls alone: 5 a tier to magic, twice that to rare', () => {
    expect(MAP_CRAFT_SOULS_PER_TIER).toBe(5);
    const s = newGame(1, 0);
    expect(mapUpgradeSouls(mapOf(s, { tier: 4 }), 'magic')).toBe(20);
    expect(mapUpgradeSouls(mapOf(s, { tier: 4 }), 'rare')).toBe(40);
    expect(mapUpgradeSouls(mapOf(s, { tier: 11 }), 'magic')).toBe(55);
    expect(craftCost('voidCrystal', 40)).toBe(1);
  });

  it('makeMagic on a normal tier-4 map spends 20 Souls and no material', () => {
    const s = withMap((s) => mapOf(s, { tier: 4 }));
    s.stash.materials.copper = 0;
    s.diamonds = 0;
    s.souls = 20;
    expect(craft(s, bagLoc(0), 'makeMagic')).toEqual({ check: 'ok' });
    expect([s.souls, s.diamonds]).toEqual([0, 0]);
    expect(validateState(s)).toBe(true);
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
  it('makeMagic makes a normal map magic with 1–2 modifiers', () => {
    const counts = new Set<number>();
    for (let rng = 1; rng < 40; rng++) {
      const s = withMap((s) => mapOf(s), rng);
      const before = identity(at(s, 0));
      expect(craft(s, bagLoc(0), 'makeMagic')).toEqual({ check: 'ok' });
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

  it('makeRare makes a magic map rare with 4–6 new modifiers', () => {
    const counts = new Set<number>();
    for (let rng = 1; rng < 60; rng++) {
      const s = withMap((s) => magic(s), rng);
      const before = identity(at(s, 0));
      expect(craft(s, bagLoc(0), 'makeRare')).toEqual({ check: 'ok' });
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
});

describe('refusals change nothing', () => {
  const normal = (s: GameState) => mapOf(s);
  const cases: [string, (s: GameState) => MapItem, CraftKind, string][] = [
    ...(['copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal', 'diamond'] as const).flatMap((k) =>
      [['normal', normal], ['magic', magic], ['rare', rare]].map(([r, m]): [string, (s: GameState) => MapItem, CraftKind, string] =>
        [`${k} on a ${r as string} map`, m as (s: GameState) => MapItem, k, 'notForMaps'])),
    ['makeMagic on magic', magic, 'makeMagic', 'wrongRarity'],
    ['makeMagic on rare', rare, 'makeMagic', 'wrongRarity'],
    ['makeRare on normal', normal, 'makeRare', 'wrongRarity'],
    ['makeRare on rare', rare, 'makeRare', 'wrongRarity'],
    ['makeMagic on a sealed map', (s) => ({ ...rare(s), sealed: true }), 'makeMagic', 'sealed'],
  ];
  for (const [name, map, kind, check] of cases) {
    it(`${name} → ${check}`, () => {
      const s = withMap(map);
      s.bag[7] = mat(s, 'copper', 20);
      const before = snap(s);
      expect(canCraft(s, bagLoc(0), kind)).toBe(check);
      expect(craft(s, bagLoc(0), kind, bagLoc(7))).toEqual({ check });
      expect(snap(s)).toEqual(before);
    });
  }

  it('too few Souls is noSouls', () => {
    const s = withMap(normal);
    s.souls = 19;
    const before = snap(s);
    expect(canCraft(s, bagLoc(0), 'makeMagic')).toBe('noSouls');
    expect(craft(s, bagLoc(0), 'makeMagic')).toEqual({ check: 'noSouls' });
    expect(snap(s)).toEqual(before);
    s.souls = 20;
    expect(craft(s, bagLoc(0), 'makeMagic')).toEqual({ check: 'ok' });
  });

  it('a sealed map refuses every upgrade', () => {
    const s = withMap((s) => ({ ...rare(s), sealed: true }));
    const before = snap(s);
    for (const kind of ['makeMagic', 'makeRare'] as const) expect(craft(s, bagLoc(0), kind)).toEqual({ check: 'sealed' });
    expect(snap(s)).toEqual(before);
  });
});

describe('orb enchants on maps', () => {
  const orb = (
    s: GameState,
    family: 'craft' | 'removal' | 'scattering' | 'socketing' | 'clearSockets',
    side: 'prefix' | 'suffix' | undefined,
    tier: 'minor' | 'normal' | 'greater' | undefined,
  ) => ({ id: s.nextId++, type: 'orb' as const, family, side, tier, count: 1 });

  it('a craft orb adds a random modifier the map lacks, up to its cap', () => {
    const s = withMap((s) => rare(s, [mod('monsterLife', 2), mod('monsterSpeed', 3), mod('hardened', 1)]));
    s.bag[9] = orb(s, 'craft', 'prefix', 'minor');
    expect(targetedCraft(s, bagLoc(0), { kind: 'addPrefix', tier: 'minor' })).toEqual({ check: 'ok' });
    const map = at(s, 0);
    expect(map.mods).toHaveLength(4);
    expect(unique(map.mods) && map.mods.every(inRange)).toBe(true);
    expect(s.bag[9]).toBeNull();
    expect(validateState(s)).toBe(true);
  });

  it('a craft orb refuses a rare map with all six kinds', () => {
    const s = withMap((s) => rare(s, allSix()));
    s.bag[9] = orb(s, 'craft', 'prefix', 'minor');
    const before = snap(s);
    expect(targetedCraft(s, bagLoc(0), { kind: 'addPrefix', tier: 'minor' })).toEqual({ check: 'noRoom' });
    expect(snap(s)).toEqual(before);
  });

  it('a craft orb refuses a normal map: it must be upgraded with Souls first', () => {
    const s = withMap((s) => mapOf(s));
    s.bag[9] = orb(s, 'craft', 'prefix', 'minor');
    const before = snap(s);
    expect(targetedCraft(s, bagLoc(0), { kind: 'addPrefix', tier: 'minor' })).toEqual({ check: 'wrongRarity' });
    expect(snap(s)).toEqual(before);
  });

  it('a removal orb removes one random modifier', () => {
    const s = withMap((s) => rare(s));
    s.bag[9] = orb(s, 'removal', 'prefix', undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'removePrefix' })).toEqual({ check: 'ok' });
    expect(at(s, 0).mods).toHaveLength(2);
  });

  it('a scattering orb keeps kinds and tiers and rerolls every value', () => {
    const s = withMap((s) => rare(s, [mod('monsterLife', 2)]), 5);
    s.bag[9] = orb(s, 'scattering', undefined, undefined);
    const before = structuredClone(at(s, 0).mods);
    expect(targetedCraft(s, bagLoc(0), { kind: 'scatter' })).toEqual({ check: 'ok' });
    const m = at(s, 0).mods[0];
    if (m === undefined) throw new Error('modifier lost');
    expect([m.kind, m.tier]).toEqual(['monsterLife', 2]);
    expect(inRange(m)).toBe(true);
    expect(at(s, 0).mods).not.toEqual(before);
    expect(validateState(s)).toBe(true);
  });

  it('socketing and clearing orbs are not for maps', () => {
    const s = withMap((s) => rare(s));
    s.bag[9] = orb(s, 'socketing', undefined, undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'socketing' })).toEqual({ check: 'notForMaps' });
    s.bag[8] = orb(s, 'clearSockets', undefined, undefined);
    expect(targetedCraft(s, bagLoc(0), { kind: 'clearSockets' })).toEqual({ check: 'notForMaps' });
  });
});

describe('dragging a material onto a map', () => {
  it('no longer crafts: a material does nothing to a map', () => {
    const s = withMap((s) => mapOf(s));
    s.bag[9] = mat(s, 'copper', 10);
    const before = snap(s);
    expect(dropItem(s, bagLoc(9), bagLoc(0))).toBe('craftRefused');
    expect(snap(s)).toEqual(before);
  });
});

describe('the store notes an upgrade', () => {
  it('goes through the store, which notes the craft', () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    const s = store.state;
    s.souls = 100;
    s.stash.maps[4] = [mapOf(s)];
    expect(store.craft(mapsLoc(4), 'makeMagic')).toEqual({ check: 'ok' });
    expect(store.lastCraft).toMatchObject({ kind: 'makeMagic', check: 'ok', target: mapsLoc(4) });
    expect([s.stash.maps[4]?.[0]?.rarity, s.souls]).toEqual(['magic', 80]);
    expect(store.craft(mapsLoc(4), 'tin')).toEqual({ check: 'notForMaps' });
  });
});

describe('random craft chains on maps', () => {
  const KINDS: readonly CraftKind[] = ['makeMagic', 'makeRare', 'copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal', 'diamond'];

  // Maps of tier 1–20 and every rarity, in the bag or the Maps tab, crafted on at random with plenty of everything:
  // the state stays valid after every step, and a refused craft leaves it exactly as it was.
  it('keep the state valid, and a refusal changes nothing', () => {
    let pick = 54321;
    const next = (n: number): number => {
      pick = (Math.imul(pick, 1103515245) + 12345) >>> 0;
      return Math.floor((pick / 2 ** 32) * n);
    };
    const seen = new Set<string>();
    let specials = 0;
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
      const target = inBag ? bagLoc(0) : mapsLoc(map.tier);
      if (inBag) s.bag[0] = map;
      else s.stash.maps[map.tier] = [map];
      expect(validateState(s)).toBe(true);
      for (let step = 0; step < 16; step++) {
        const kind = KINDS[next(KINDS.length)] as CraftKind;
        const before = structuredClone(s);
        const { check } = craft(s, target, kind);
        seen.add(check);
        if (check !== 'ok') expect(s).toEqual(before);
        expect(validateState(s), `chain ${chain} step ${step} ${kind}`).toBe(true);
      }
      if (map.special !== undefined) specials++;
    }
    expect([...seen].sort()).toEqual(['notForMaps', 'ok', 'wrongRarity']);
    expect(specials).toBeGreaterThan(0);   // the chains roll specials too, and stay valid with them
  });
});
