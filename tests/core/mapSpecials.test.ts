import { describe, expect, it } from 'vitest';
import { MAP_SPECIAL_CHANCE, TREASURE_CHESTS } from '../../src/core/balance';
import { applyTicks } from '../../src/core/dig';
import { dungeonLayout } from '../../src/core/dungeons';
import { craft, held, type CraftKind, type TemperOutcome } from '../../src/core/crafting';
import { MAP_SPECIALS, MATERIALS } from '../../src/core/items';
import type { MapItem, MapMod, MapSpecial } from '../../src/core/items';
import { MAP_SPECIAL_TEXT, mapEffects } from '../../src/core/mapMods';
import { putMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GameState, ItemLoc, MapRun, MonsterState, Stats } from '../../src/core/types';
import { gear } from '../helpers/items';

const bagLoc = (index: number): ItemLoc => ({ where: 'bag', index });
const mod = (kind: MapMod['kind'], tier = 2): MapMod => ({ kind, tier, value: 10 });

function mapOf(s: GameState, p: Partial<MapItem> = {}): MapItem {
  return { id: s.nextId++, type: 'map', tier: 4, metre: 327, rarity: 'normal', mods: [], ...p };
}

/** A state with plenty of every material, Diamonds and Souls, the map at bag[0] and the loot stream at `rng`. */
function withMap(map: (s: GameState) => MapItem, rng: number): GameState {
  const s = newGame(1, 0);
  for (const m of MATERIALS) s.stash.materials[m] = 100;
  s.diamonds = 100;
  s.souls = 10_000;
  s.bag[0] = map(s);
  s.rng = rng;
  return s;
}

/** Each enchant that may add a special, on a map it works on. */
const ENCHANTS: [CraftKind, (s: GameState, p?: Partial<MapItem>) => MapItem][] = [
  ['copper', (s, p) => mapOf(s, p)],
  ['iron', (s, p) => mapOf(s, { rarity: 'magic', mods: [mod('monsterLife')], ...p })],
  ['silver', (s, p) => mapOf(s, { rarity: 'rare', mods: [mod('monsterLife'), mod('monsterSpeed'), mod('hardened')], ...p })],
  ['voidCrystal', (s, p) => mapOf(s, { rarity: 'rare', mods: [mod('monsterLife'), mod('monsterSpeed'), mod('hardened')], ...p })],
];

describe('rolls', () => {
  it('a Copper, Iron, Silver or Void enchant adds a special about one time in ten, only to a map with none', () => {
    expect(MAP_SPECIAL_CHANCE).toBe(0.1);
    for (const [kind, make] of ENCHANTS) {
      let added = 0;
      const seen = new Set<MapSpecial>();
      for (let rng = 1; rng <= 2000; rng++) {
        const s = withMap((s) => make(s), rng);
        expect(craft(s, bagLoc(0), kind).check).toBe('ok');
        const special = (s.bag[0] as MapItem).special;
        if (special !== undefined) {
          added++;
          seen.add(special);
          expect(validateState(s)).toBe(true);
        }
      }
      expect(added, kind).toBeGreaterThanOrEqual(140);
      expect(added, kind).toBeLessThanOrEqual(260);
      expect([...seen].sort(), kind).toEqual([...MAP_SPECIALS].sort());
    }

    // A map that has one keeps it through every enchant, Obsidian and every temper outcome too.
    const kept: [CraftKind, (s: GameState) => MapItem][] = [
      ...ENCHANTS.filter(([k]) => k !== 'voidCrystal').map(([k, make]) => [k, (s: GameState) => make(s, { special: 'secondBoss' })] as [CraftKind, (s: GameState) => MapItem]),
      ['obsidian', (s) => mapOf(s, { rarity: 'magic', mods: [mod('monsterLife')], special: 'secondBoss' })],
      ['obsidian', (s) => mapOf(s, { rarity: 'rare', mods: [mod('monsterLife'), mod('hardened'), mod('bossPower')], special: 'secondBoss' })],
    ];
    for (const [kind, make] of kept) {
      for (let rng = 1; rng <= 300; rng++) {
        const s = withMap(make, rng);
        expect(craft(s, bagLoc(0), kind).check).toBe('ok');
        expect((s.bag[0] as MapItem).special, `${kind} rng ${rng}`).toBe('secondBoss');
      }
    }
    const outcomes = new Set<TemperOutcome>();
    for (let rng = 1; rng <= 300; rng++) {
      const s = withMap((s) => mapOf(s, { rarity: 'rare', mods: [mod('monsterLife'), mod('hardened')], special: 'tripleSouls' }), rng);
      const temper = craft(s, bagLoc(0), 'voidCrystal').temper;
      if (temper !== undefined) outcomes.add(temper);
      expect((s.bag[0] as MapItem).special, `temper ${temper} rng ${rng}`).toBe('tripleSouls');
      expect((s.bag[0] as MapItem).sealed).toBe(true);
    }
    expect(outcomes.size).toBe(4);

    // Tin does nothing to a map: refused before any draw.
    const s = withMap((s) => mapOf(s), 7);
    expect(craft(s, bagLoc(0), 'tin')).toEqual({ check: 'notForMaps' });
    expect(s.rng).toBe(7);
  });

  it('the special roll draws from state.rng', () => {
    for (let rng = 1; rng <= 20; rng++) {
      const plain = withMap((s) => mapOf(s), rng);
      const twin = withMap((s) => mapOf(s), rng);
      const marked = withMap((s) => mapOf(s, { special: 'championPacks' }), rng);
      for (const s of [plain, twin, marked]) expect(craft(s, bagLoc(0), 'copper').check).toBe('ok');
      expect(twin.rng).toBe(plain.rng);
      expect(twin.bag[0]).toEqual(plain.bag[0]);
      expect(marked.rng, `rng ${rng}`).not.toBe(plain.rng);
    }
  });
});

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

/** A run on a map of `tier` at `metre`, with or without `special`, from the same world and loot stream. */
function started(special: MapSpecial | undefined, tier = 1, metre = 2, rng = 1): { s: GameState; run: MapRun } {
  const s = newGame(1, 0);
  const map: MapItem = { id: s.nextId++, type: 'map', tier, metre, rarity: 'normal', mods: [] };
  if (special !== undefined) map.special = special;
  expect(putMap(s, map)).toBe('ok');
  expect(startMap(s, map.id)).toBe('ok');
  s.rng = rng;
  const run = runOf(s);
  run.life = 1_000;
  return { s, run };
}

function monster(p: Partial<MonsterState> = {}): MonsterState {
  return {
    name: 'Test Monster', species: 0, rank: 'normal', mods: [], extra: 0,
    element: 'physical', life: 1, maxLife: 1, damage: 1, intervalS: 1, xp: 0, ...p,
  };
}

const at = (s: GameState, autoTicksPerSecond: number): Stats => ({ ...deriveStats(s), autoTicksPerSecond });
/** One automatic strike, at once. */
function swing(s: GameState): void {
  runOf(s).hitCarry = 1;
  applyTicks(s, 1, at(s, 1000));
}

describe('effects', () => {
  it('a treasure room drops three chests before the boss', () => {
    expect(TREASURE_CHESTS).toBe(3);
    for (let rng = 1; rng <= 40; rng++) {
      const sides = ([undefined, 'treasureRoom'] as const).map((special) => {
        const { s, run } = started(special, 3, 5, rng);
        run.room = run.bossRoom - 1;
        run.queue = [monster()];
        const drops = s.drops.length;
        swing(s);
        return { s, run, items: run.items, logged: s.drops.slice(drops) };
      });
      const [plain, treasure] = sides as [typeof sides[0], typeof sides[0]];
      const chests = treasure.items - plain.items;
      expect(chests, `rng ${rng}`).toBeGreaterThanOrEqual(TREASURE_CHESTS);
      expect(chests, `rng ${rng}`).toBeLessThanOrEqual(2 * TREASURE_CHESTS);
      // The kill's own drops come first, drawn as on the plain map; the chests follow, from the room just cleared.
      expect(treasure.logged.slice(0, plain.logged.length)).toEqual(plain.logged);
      const extra = treasure.logged.slice(plain.logged.length);
      expect(extra).toHaveLength(chests);
      for (const e of extra) {
        expect(e.kind).toBe('gear');
        expect(e.origin).toEqual({ kind: 'map', tier: 3, room: treasure.run.bossRoom - 1 });
      }
      expect(treasure.run.room).toBe(treasure.run.bossRoom);
      expect(treasure.run.queue.map((m) => m.rank)).toEqual(['boss']);
    }
    // No chest after any other room.
    const { s, run } = started('treasureRoom', 3, 5);
    run.queue = [monster()];
    const plain = started(undefined, 3, 5);
    plain.run.queue = [monster()];
    swing(s);
    swing(plain.s);
    expect(run.items).toBe(plain.run.items);
  });

  it('the boss drops a legendary', () => {
    for (let rng = 1; rng <= 20; rng++) {
      const sides = ([undefined, 'bossLegendary'] as const).map((special) => {
        const { s, run } = started(special, 3, 5, rng);
        run.room = run.bossRoom;
        run.queue = [monster({ rank: 'boss' })];
        const drops = s.drops.length;
        swing(s);
        return { s, items: s.lastRun?.items ?? 0, logged: s.drops.slice(drops) };
      });
      const [plain, legend] = sides as [typeof sides[0], typeof sides[0]];
      expect(legend.s.lastRun?.outcome).toBe('cleared');
      expect(legend.items).toBe(plain.items + 1);
      expect(legend.logged.slice(0, plain.logged.length)).toEqual(plain.logged);
      const extra = legend.logged.slice(plain.logged.length);
      expect(extra).toHaveLength(1);
      expect(extra[0]).toMatchObject({ kind: 'gear', rarity: 'legendary', origin: { kind: 'map', tier: 3 } });
    }
    // A normal kill on the same map drops no legendary of its own.
    const { s, run } = started('bossLegendary', 3, 5);
    const plain = started(undefined, 3, 5);
    for (const r of [run, plain.run]) r.queue = [monster(), monster()];
    swing(s);
    swing(plain.s);
    expect(s.drops).toEqual(plain.s.drops);
  });

  it('every pack has a champion', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const tier of [1, 3, 7, 8, 12]) {
        const plain = dungeonLayout(seed, { tier, metre: seed * 37 });
        const packs = dungeonLayout(seed, { tier, metre: seed * 37, special: 'championPacks' });
        expect(packs.type).toEqual(plain.type);
        expect(packs.boss).toEqual(plain.boss);
        expect(packs.boss2).toBeNull();
        expect(packs.rooms).toHaveLength(plain.rooms.length);
        packs.rooms.forEach((room, i) => {
          const before = plain.rooms[i] ?? [];
          expect(room.filter((m) => m.rank === 'champion'), `seed ${seed} tier ${tier} room ${i}`).toHaveLength(1);
          expect(room[room.length - 1]?.rank).toBe('champion');   // the champion still fights last
          // the normals are the plain map's, seeded names and species unchanged
          expect(room.filter((m) => m.rank === 'normal')).toEqual(before.filter((m) => m.rank === 'normal'));
          if (before.some((m) => m.rank === 'champion')) expect(room).toEqual(before);
        });
      }
    }
  });

  it('materials drop twice', () => {
    let tried = 0;
    for (let rng = 1; rng <= 60; rng++) {
      const sides = ([undefined, 'doubleMaterials'] as const).map((special) => {
        const { s, run } = started(special, 3, 5, rng);
        run.queue = [monster({ rank: 'boss' }), monster()];
        const before = MATERIALS.map((m) => held(s, m));
        swing(s);
        return { s, gained: MATERIALS.map((m, i) => held(s, m) - (before[i] ?? 0)) };
      });
      const [plain, double] = sides as [typeof sides[0], typeof sides[0]];
      expect(double.s.rng).toBe(plain.s.rng);
      expect(double.gained, `rng ${rng}`).toEqual(plain.gained.map((n) => 2 * n));
      if (plain.gained.some((n) => n > 0)) tried++;
    }
    expect(tried).toBeGreaterThan(5);
    expect(mapEffects({ id: 1, type: 'map', tier: 1, metre: 1, rarity: 'normal', mods: [], special: 'doubleMaterials' }).materialMult).toBe(2);
  });

  it('Souls ×3 and no healing', () => {
    // A tier-4 normal kill is worth exactly 1 Soul, so three times it is exact for every draw.
    for (let rng = 1; rng <= 20; rng++) {
      const sides = ([undefined, 'tripleSouls'] as const).map((special) => {
        const { s, run } = started(special, 4, 5, rng);
        run.queue = [monster(), monster()];
        swing(s);
        return { s, souls: run.gained.souls };
      });
      const [plain, triple] = sides as [typeof sides[0], typeof sides[0]];
      expect(plain.souls).toBe(1);
      expect(triple.souls).toBe(3 * plain.souls);
      expect(triple.s.rng).toBe(plain.s.rng);
    }
    const plain = started(undefined, 4, 5);
    const triple = started('tripleSouls', 4, 5);
    for (const { s, run } of [plain, triple]) {
      run.queue = [monster()];
      run.life = 1;
      swing(s);
      expect(run.room).toBe(2);
    }
    expect(plain.run.life).toBeGreaterThan(1);
    expect(triple.run.life).toBe(1);
    expect(mapEffects(triple.run.map)).toMatchObject({ healMult: 0, soulsMult: 3, quantity: 0, rarity: 0, souls: 0 });
  });

  it('a second boss', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const tier of [1, 4, 9]) {
        const { boss, boss2 } = dungeonLayout(seed, { tier, metre: seed * 13, special: 'secondBoss' });
        expect(boss2).toMatchObject({ rank: 'boss', species: boss.species, name: `${boss.name}'s Twin`, mods: [] });
        expect(boss2?.extra).not.toBe(boss.extra);
        expect(boss2?.name.length).toBeLessThanOrEqual(80);
        expect(dungeonLayout(seed, { tier, metre: seed * 13 }).boss2).toBeNull();
      }
    }

    for (const seed of [1, 2, 3]) {
      const s = newGame(seed, 0);
      // strong enough to clear a tier-1 map with two bosses
      s.equipped.battle.weapon = gear(s, 'weapon', { rarity: 'rare', implicit: { stat: 'damage', value: 400 } });
      s.equipped.battle.armor = gear(s, 'armor', { rarity: 'rare', implicit: { stat: 'life', value: 2_000 } });
      const map: MapItem = { id: s.nextId++, type: 'map', tier: 1, metre: 10 + seed, rarity: 'normal', mods: [], special: 'secondBoss' };
      expect(putMap(s, map)).toBe('ok');
      expect(startMap(s, map.id)).toBe('ok');
      const run = runOf(s);
      const { boss } = dungeonLayout(s.seed, map);
      const stats = at(s, 1);
      const bossQueues: string[][] = [];
      for (let t = 0; t < 20_000 && s.activity.kind === 'map'; t++) {
        applyTicks(s, 1, stats);
        expect(validateState(s), `seed ${seed} tick ${t}`).toBe(true);
        if (s.activity.kind === 'map' && run.room === run.bossRoom) {
          const names = run.queue.map((m) => m.name);
          if (bossQueues[bossQueues.length - 1]?.join() !== names.join()) bossQueues.push(names);
        }
      }
      expect(bossQueues, `seed ${seed}`).toEqual([[boss.name, `${boss.name}'s Twin`], [`${boss.name}'s Twin`]]);
      expect(s.lastRun?.outcome).toBe('cleared');
      expect(s.lastRun?.room).toBe(run.bossRoom);
    }
  });

  it('a run on a special map replays identically after a save', () => {
    for (const special of MAP_SPECIALS) {
      const s = newGame(5, 0);
      s.equipped.battle.weapon = gear(s, 'weapon', { rarity: 'rare', implicit: { stat: 'damage', value: 60 } });
      s.equipped.battle.armor = gear(s, 'armor', { rarity: 'rare', implicit: { stat: 'life', value: 300 } });
      const map: MapItem = { id: s.nextId++, type: 'map', tier: 2, metre: 21, rarity: 'magic', mods: [mod('monsterLife', 1)], special };
      expect(putMap(s, map)).toBe('ok');
      expect(startMap(s, map.id)).toBe('ok');
      const stats = deriveStats(s);
      // saved mid-run, in room 2, so the special's own moments come after the load
      while (s.activity.kind === 'map' && s.activity.run.room < 2) applyTicks(s, 1, stats);
      expect(s.activity.kind, special).toBe('map');
      const r = decodeSave(encodeSave(s, 0));
      if (!r.ok) throw new Error(`save rejected: ${r.reason}`);
      const copy = r.state;
      expect(runOf(copy).map.special).toBe(special);
      for (let t = 0; t < 20_000 && (s.activity.kind === 'map' || copy.activity.kind === 'map'); t++) {
        applyTicks(s, 1, stats);
        applyTicks(copy, 1, stats);
        expect(copy.activity.kind, `${special} tick ${t}`).toBe(s.activity.kind);
        if (s.activity.kind === 'map') expect(runOf(copy).log).toEqual(runOf(s).log);
      }
      expect(s.lastRun?.outcome, special).toBe('cleared');   // played through every special's moment
      expect(copy.rng, special).toBe(s.rng);
      expect(copy.lastRun, special).toEqual(s.lastRun);
      expect(copy.drops, special).toEqual(s.drops);
      expect([copy.souls, copy.gold, copy.xp, copy.level]).toEqual([s.souls, s.gold, s.xp, s.level]);
    }
  });
});

describe('text', () => {
  it('each special reads as spec §11 says', () => {
    expect(MAP_SPECIAL_TEXT).toEqual({
      bossLegendary: 'The boss drops a legendary',
      treasureRoom: 'A treasure room before the boss',
      championPacks: 'Every pack has a champion',
      doubleMaterials: 'Materials drop twice',
      tripleSouls: 'Souls ×3, but rooms don\'t heal',
      secondBoss: 'A second boss',
    });
  });
});
