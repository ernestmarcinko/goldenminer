import { expect, it } from 'vitest';
import { CHAMPION_UNITS, MAX_ROOMS, MIN_ROOMS, MONSTER_BUDGET } from '../../src/core/balance';
import { dungeonIndexAt, dungeonLayout, dungeonType, spreadUnits, uniqueName } from '../../src/core/dungeons';
import { DEEP_SPECIES, NAMED_SPECIES, speciesOf } from '../../src/core/species';
import { seedFromText } from '../../src/core/seed';
import { allDungeonNames, creatureWord, DUNGEON_PREFIXES, DUNGEON_SUFFIXES, SYLLABLE_END, SYLLABLE_MIDDLE, SYLLABLE_START } from '../../src/core/names';

const units = (room: { rank: string }[]) => room.reduce((n, m) => n + (m.rank === 'champion' ? CHAMPION_UNITS : 1), 0);

it('species lists are fixed per tier and cycle in the deep', () => {
  expect(speciesOf(1).map((s) => s.name)).toEqual(['Mole Rat', 'Cave Beetle', 'Tunnel Bat', 'Root Grub']);
  expect(speciesOf(7)).toBe(DEEP_SPECIES[0]);
  expect(speciesOf(11)).toBe(DEEP_SPECIES[0]);
  expect(speciesOf(10)).toBe(DEEP_SPECIES[3]);
  expect(NAMED_SPECIES.every((list) => list.length === 4)).toBe(true);
});

it('the same seed and metre give the same dungeon, for everyone', () => {
  const seed = seedFromText('golden mole');
  const a = dungeonLayout(seed, { tier: 3, metre: 214 });
  const b = dungeonLayout(seed, { tier: 3, metre: 214 });
  expect(a).toEqual(b);
  const other = dungeonLayout(seedFromText('amber-fox-427'), { tier: 3, metre: 214 });
  expect(JSON.stringify(other)).not.toEqual(JSON.stringify(a));
});

it('every layout spends exactly the budget, champions first', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const tier of [1, 3, 7, 8, 12]) {
      const { type, rooms, boss } = dungeonLayout(seed, { tier, metre: seed * 37 });
      expect(rooms).toHaveLength(type.rooms);
      expect(type.rooms).toBeGreaterThanOrEqual(MIN_ROOMS);
      expect(type.rooms).toBeLessThanOrEqual(MAX_ROOMS);
      expect(rooms.reduce((n, r) => n + units(r), 0)).toBe(MONSTER_BUDGET);
      expect(rooms.flat().filter((m) => m.rank === 'champion')).toHaveLength(tier >= 8 ? 2 : 1);
      for (const r of rooms) {
        expect(r.length).toBeGreaterThan(0);
        expect(r.slice(0, -1).every((m) => m.rank === 'normal')).toBe(true);   // a champion, if any, fights last
      }
      if (type.rooms === 4) expect(rooms.map(units).every((u) => u === 3 || u === 4)).toBe(true);
      expect(boss).toMatchObject({ rank: 'boss', species: type.bossSpecies, name: type.bossName });
      for (const m of rooms.flat()) {
        expect(type.species).toContain(m.species);
        if (m.rank === 'champion') expect([1, 2]).toContain(new Set(m.mods).size);
        else expect(m.mods).toEqual([]);
      }
    }
  }
});

it('dungeon types: three per tier with distinct names, 2–3 species, a valid boss', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const tier of [1, 6, 9]) {
      const types = ([0, 1, 2] as const).map((i) => dungeonType(seed, tier, i));
      expect(new Set(types.map((t) => t.name)).size).toBe(3);
      for (const t of types) {
        expect([2, 3]).toContain(t.species.length);
        expect(t.species).toContain(t.bossSpecies);
        expect(t.bossName).toMatch(/^[A-Z][a-z]+, [A-Z][a-z]+ of /);
        expect(t.name.length).toBeGreaterThan(5);
        expect(t.floor.shades.every((c) => /^hsl\(\d+, \d+%, \d+%\)$/.test(c))).toBe(true);
      }
    }
  }
  expect([0, 1, 2]).toContain(dungeonIndexAt(5, 214));
});

it('a map without a special gives the layout it always did, with no second boss', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const tier of [1, 4, 8]) {
      const map = { tier, metre: seed * 19 };
      const layout = dungeonLayout(seed, map);
      expect(layout.boss2).toBeNull();
      expect(dungeonLayout(seed, { ...map, special: undefined })).toEqual(layout);
      // the specials that leave the rooms alone change nothing in the layout
      for (const special of ['bossLegendary', 'treasureRoom', 'doubleMaterials', 'tripleSouls'] as const) {
        expect(dungeonLayout(seed, { ...map, special })).toEqual(layout);
      }
    }
  }
});

it('world generation ignores the loot stream and the player', () => {
  const seed = 42;
  const layout = JSON.stringify(dungeonLayout(seed, { tier: 4, metre: 333 }));
  // dungeonLayout takes no GameState at all; this guards against a future signature that would
  expect(dungeonLayout.length).toBe(2);
  expect(JSON.stringify(dungeonLayout(seed, { tier: 4, metre: 333 }))).toBe(layout);
});

it('every syllable and compound join is pronounceable: never three consonants in a row', () => {
  const words: string[] = [];
  for (const a of SYLLABLE_START) for (const m of ['', ...SYLLABLE_MIDDLE]) for (const e of SYLLABLE_END) words.push(creatureWord(a, m, e));
  for (const p of DUNGEON_PREFIXES) for (const s of DUNGEON_SUFFIXES) words.push(p + s);
  expect(words.filter((w) => /[^aeiouy]{3}/i.test(w))).toEqual([]);
});

const championRooms = (rooms: { rank: string }[][]) =>
  rooms.flatMap((r, i) => (r.some((m) => m.rank === 'champion') ? [i] : []));

it('spreads the budget: champions first in order, then each unit to the emptiest room, earlier on a tie', () => {
  const T = true;
  const F = false;
  const cases: [number[], number, number[], boolean[]][] = [
    [[2, 0, 3, 1], 1, [4, 3, 1, 4], [F, F, T, F]],
    [[2, 0, 3, 1], 2, [1, 3, 1, 4], [T, F, T, F]],
    [[4, 1, 0, 3, 2], 1, [3, 3, 3, 3, 0], [F, F, F, F, T]],
    [[4, 1, 0, 3, 2], 2, [3, 0, 3, 3, 0], [F, T, F, F, T]],
    [[5, 2, 4, 0, 1, 3], 1, [2, 2, 3, 2, 3, 0], [F, F, F, F, F, T]],
    [[5, 2, 4, 0, 1, 3], 2, [2, 2, 0, 2, 3, 0], [F, F, T, F, F, T]],
    [[3, 6, 0, 5, 1, 4, 2], 1, [2, 2, 2, 0, 2, 2, 2], [F, F, F, T, F, F, F]],
    [[3, 6, 0, 5, 1, 4, 2], 2, [2, 2, 1, 0, 2, 2, 0], [F, F, F, T, F, F, T]],
  ];
  for (const [order, champions, normals, champion] of cases) {
    expect(spreadUnits(order, order.length, champions)).toEqual({ normals, champion });
  }
});

it('champions land in seed-picked rooms, with one or two modifiers', () => {
  const rooms = new Set<number>();
  const modCounts = new Set<number>();
  for (let seed = 1; seed <= 300; seed++) {
    const { type, rooms: layout } = dungeonLayout(seed, { tier: 3, metre: seed * 37 });
    if (type.rooms === 4) for (const r of championRooms(layout)) rooms.add(r);
    for (const m of layout.flat()) if (m.rank === 'champion') modCounts.add(m.mods.length);
  }
  expect(rooms.size).toBeGreaterThanOrEqual(3);
  expect([...modCounts].sort()).toEqual([1, 2]);
});

it('the element bias puts matching species first', () => {
  let checked = 0;
  for (let seed = 1; seed <= 100; seed++) {
    for (const tier of [2, 3, 4, 5, 6]) {
      const band = speciesOf(tier);
      for (const i of [0, 1, 2] as const) {
        const t = dungeonType(seed, tier, i);
        const matches = band.filter((s) => s.element === t.bias).length;
        if (matches < 2) continue;
        checked++;
        const first = t.species.slice(0, Math.min(t.species.length, matches));
        expect(first.every((k) => band[k]?.element === t.bias)).toBe(true);
      }
    }
  }
  expect(checked).toBeGreaterThan(100);
});

it('the dungeon index covers all three types and does not decide the room order', () => {
  expect(new Set(Array.from({ length: 300 }, (_, m) => dungeonIndexAt(9, m + 1))).size).toBe(3);
  const roomsByIndex = new Map<number, Set<number>>();
  for (let metre = 1; metre <= 400; metre++) {
    const { rooms } = dungeonLayout(9, { tier: 3, metre });
    const set = roomsByIndex.get(dungeonIndexAt(9, metre)) ?? new Set<number>();
    for (const r of championRooms(rooms)) set.add(r);
    roomsByIndex.set(dungeonIndexAt(9, metre), set);
  }
  expect(roomsByIndex.size).toBe(3);
  for (const set of roomsByIndex.values()) expect(set.size).toBeGreaterThanOrEqual(2);
});

it('pinned vectors: a seed keeps reproducing its dungeons', () => {
  // Changing a salt, the room order, the spread or a name must fail here, since saves rely on it: a run's boss room and
  // the dungeon a map opens are regenerated from the seed. An intended change to world generation needs a worldGen bump.
  expect(Array.from({ length: 12 }, (_, m) => dungeonIndexAt(42, m + 1))).toEqual([0, 1, 1, 1, 2, 1, 0, 0, 1, 2, 1, 1]);
  const layout = dungeonLayout(42, { tier: 4, metre: 333 });
  expect({
    rooms: layout.type.rooms, species: layout.type.species, bossSpecies: layout.type.bossSpecies, bias: layout.type.bias,
    ranks: layout.rooms.map((r) => r.map((m) => m.rank[0]).join('')), bossExtra: layout.boss.extra,
  }).toEqual({ rooms: 7, species: [0, 2], bossSpecies: 0, bias: 'physical', ranks: ['c', 'nn', 'nn', 'nn', 'nn', 'nn', 'nn'], bossExtra: 3083684602 });
  expect([layout.boss.name, layout.rooms[0]?.find((m) => m.rank === 'champion')?.name])
    .toEqual(['Bramulrin, Warden of the Lonely Diggings', 'Rulilkas the Ravenous']);
  expect([100, 101, 102, 103, 104, 105, 106, 107].map((metre) => championRooms(dungeonLayout(42, { tier: 8, metre }).rooms)))
    .toEqual([[0, 1], [0, 1], [1, 3], [0, 1], [0, 1], [1, 2], [0, 1], [2, 4]]);
});

it('each normal monster has its own pick: species mix within a room, and distinct look seeds', () => {
  let mixed = 0;
  for (let seed = 1; seed <= 100; seed++) {
    for (const r of dungeonLayout(seed, { tier: 3, metre: seed * 11 }).rooms) {
      const normals = r.filter((m) => m.rank === 'normal');
      if (normals.length >= 2) expect(new Set(normals.map((m) => m.extra)).size).toBe(normals.length);
      if (normals.length >= 3 && new Set(normals.map((m) => m.species)).size >= 2) mixed++;
    }
  }
  expect(mixed).toBeGreaterThan(0);
});

it('the boss species is a seeded pick from the type, not always the first', () => {
  for (const tier of [1, 3, 6, 9]) {
    const types = Array.from({ length: 60 }, (_, s) => dungeonType(s + 1, tier, 0));
    expect(new Set(types.map((t) => t.bossSpecies)).size).toBeGreaterThan(1);
    expect(types.some((t) => t.bossSpecies !== t.species[0])).toBe(true);
  }
});

it('a name that keeps clashing falls back to the first unused name of the tier', () => {
  const all = allDungeonNames(1);
  let calls = 0;
  const stuck = () => {
    calls++;
    return all[0] ?? '';
  };
  expect(uniqueName([all[0] ?? ''], 1, stuck)).toBe(all[1]);
  expect(calls).toBe(32);
  expect(uniqueName([all[0] ?? '', all[1] ?? ''], 1, stuck)).toBe(all[2]);
  expect(uniqueName([all[0] ?? ''], 1, (attempt) => all[attempt] ?? '')).toBe(all[1]);
  expect(new Set(all).size).toBe(all.length);
});

it('creature names never stutter', () => {
  expect(creatureWord('Gor', 'a', 'vash')).toBe('Goravash');
  expect(creatureWord('Gor', 'or', 'ran')).toBe('Gorran');
  expect(creatureWord('Thul', 'om', 'mok')).toBe('Thulmok');
  const words: string[] = [];
  for (const a of SYLLABLE_START) for (const m of ['', ...SYLLABLE_MIDDLE]) for (const e of SYLLABLE_END) words.push(creatureWord(a, m, e));
  expect(words.filter((w) => /(..+)\1/i.test(w))).toEqual([]);
});
