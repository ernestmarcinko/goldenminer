import { expect, it } from 'vitest';
import { CHAMPION_UNITS, MAX_ROOMS, MIN_ROOMS, MONSTER_BUDGET } from '../../src/core/balance';
import { dungeonIndexAt, dungeonLayout, dungeonType } from '../../src/core/dungeons';
import { DEEP_SPECIES, NAMED_SPECIES, speciesOf } from '../../src/core/species';
import { seedFromText } from '../../src/core/seed';
import { DUNGEON_PREFIXES, DUNGEON_SUFFIXES, SYLLABLE_END, SYLLABLE_MIDDLE, SYLLABLE_START } from '../../src/core/names';

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

it('world generation ignores the loot stream and the player', () => {
  const seed = 42;
  const layout = JSON.stringify(dungeonLayout(seed, { tier: 4, metre: 333 }));
  // dungeonLayout takes no GameState at all; this guards against a future signature that would
  expect(dungeonLayout.length).toBe(2);
  expect(JSON.stringify(dungeonLayout(seed, { tier: 4, metre: 333 }))).toBe(layout);
});

it('every syllable and compound join is pronounceable: never three consonants in a row', () => {
  const words: string[] = [];
  for (const a of SYLLABLE_START) for (const m of ['', ...SYLLABLE_MIDDLE]) for (const e of SYLLABLE_END) words.push(a + m + e);
  for (const p of DUNGEON_PREFIXES) for (const s of DUNGEON_SUFFIXES) words.push(p + s);
  expect(words.filter((w) => /[^aeiouy]{3}/i.test(w))).toEqual([]);
});
