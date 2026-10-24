import { CHAMPION_UNITS, MAX_ROOMS, MIN_ROOMS, MONSTER_BUDGET } from './balance';
import { bossName, championName, dungeonName } from './names';
import { hashN, mulberry32 } from './rng';
import { speciesOf } from './species';
import { CHAMPION_MODS, ELEMENTS, type ChampionMod, type Element, type Rank } from './types';

// World generation (round-2 §4.2): a pure function of (seed, position) that never reads game state.
export interface DungeonType {
  name: string;
  floor: { shades: [string, string, string]; pattern: 0 | 1 | 2 | 3 };
  bias: Element;
  species: number[];   // indices into speciesOf(tier)
  rooms: number;
  bossSpecies: number;
  bossName: string;
}

export interface LayoutMonster { species: number; rank: Rank; name: string; mods: ChampionMod[]; extra: number }

// Each feature gets its own salt as the first hash key, so no feature reuses another's hash.
const SALT_NAME = 0x4e41;
const SALT_FLOOR = 0xf100;
const SALT_BIAS = 0xb1a5;
const SALT_SPECIES = 0x5bec;
const SALT_SPECIES_COUNT = 0x5c47;
const SALT_ROOMS = 0x7003;
const SALT_BOSS_SPECIES = 0xb055;
const SALT_BOSS_NAME = 0xb0a3;
const SALT_BOSS = 0xb0e7;
const SALT_TYPE = 0x7e9e;
const SALT_ROOM_ORDER = 0x0de7;
const SALT_MONSTER = 0x3057;
const SALT_EXTRA = 0xe874;
const SALT_CHAMPION_NAME = 0xc4a3;
const SALT_MODS = 0x30d5;

const FLOOR_PATTERNS = [0, 1, 2, 3] as const;

function typeNames(seed: number, tier: number): string[] {
  const names: string[] = [];
  for (let index = 0; index < 3; index++) {
    for (let attempt = 0; ; attempt++) {
      const name = dungeonName(hashN(seed, SALT_NAME, tier, index, attempt), tier);
      if (!names.includes(name)) {
        names.push(name);
        break;
      }
    }
  }
  return names;
}

export function dungeonType(seed: number, tier: number, index: 0 | 1 | 2): DungeonType {
  const name = typeNames(seed, tier)[index] ?? '';

  const f = hashN(seed, SALT_FLOOR, tier, index);
  const hue = f % 360;
  const saturation = 8 + ((f >>> 9) % 13);
  const shade = (l: number) => `hsl(${hue}, ${saturation}%, ${l}%)`;
  const floor: DungeonType['floor'] = {
    shades: [shade(11), shade(13), shade(15)],
    pattern: FLOOR_PATTERNS[(f >>> 20) % FLOOR_PATTERNS.length] ?? 0,
  };

  const bias = ELEMENTS[hashN(seed, SALT_BIAS, tier, index) % ELEMENTS.length] ?? 'physical';

  // The bias only orders the pick: matching species first, each group in hash order.
  const band = speciesOf(tier);
  const key = band.map((s, i) => ({ i, first: s.element === bias ? 0 : 1, order: hashN(seed, SALT_SPECIES, tier, index, i) }));
  key.sort((a, b) => a.first - b.first || a.order - b.order);
  const count = 2 + (hashN(seed, SALT_SPECIES_COUNT, tier, index) % 2);
  const species = key.slice(0, count).map((k) => k.i);

  const rooms = MIN_ROOMS + (hashN(seed, SALT_ROOMS, tier, index) % (MAX_ROOMS - MIN_ROOMS + 1));
  const bossSpecies = species[hashN(seed, SALT_BOSS_SPECIES, tier, index) % species.length] ?? 0;
  return {
    name, floor, bias, species, rooms, bossSpecies,
    bossName: bossName(hashN(seed, SALT_BOSS_NAME, tier, index), name),
  };
}

export function dungeonIndexAt(seed: number, metre: number): 0 | 1 | 2 {
  const i = hashN(seed, SALT_TYPE, metre) % 3;
  return i === 1 || i === 2 ? i : 0;
}

// A deterministic Fisher-Yates over the room indices.
function roomOrder(seed: number, metre: number, rooms: number): number[] {
  const order = Array.from({ length: rooms }, (_, i) => i);
  let state = hashN(seed, SALT_ROOM_ORDER, metre);
  for (let i = rooms - 1; i > 0; i--) {
    const r = mulberry32(state);
    state = r.state;
    const j = Math.floor(r.value * (i + 1));
    const a = order[i] ?? i;
    order[i] = order[j] ?? j;
    order[j] = a;
  }
  return order;
}

function championMods(h: number): ChampionMod[] {
  const n = CHAMPION_MODS.length;
  const first = (h >>> 8) % n;
  const picks = h & 1 ? [first, (first + 1 + ((h >>> 16) % (n - 1))) % n] : [first];
  return picks.map((i) => CHAMPION_MODS[i] ?? 'brutal');
}

export function dungeonLayout(
  seed: number, map: { tier: number; metre: number },
): { type: DungeonType; rooms: LayoutMonster[][]; boss: LayoutMonster } {
  const { tier, metre } = map;
  const index = dungeonIndexAt(seed, metre);
  const type = dungeonType(seed, tier, index);
  const order = roomOrder(seed, metre, type.rooms);

  // Champions are placed first, then the normal units go one at a time to the emptiest room (earlier in the order on a tie).
  const champions = tier >= 8 ? 2 : 1;
  const hasChampion = new Array<boolean>(type.rooms).fill(false);
  const normals = new Array<number>(type.rooms).fill(0);
  const totals = new Array<number>(type.rooms).fill(0);
  for (const r of order.slice(0, champions)) {
    hasChampion[r] = true;
    totals[r] = CHAMPION_UNITS;
  }
  for (let unit = 0; unit < MONSTER_BUDGET - champions * CHAMPION_UNITS; unit++) {
    let best = order[0] ?? 0;
    for (const r of order) if ((totals[r] ?? 0) < (totals[best] ?? 0)) best = r;
    totals[best] = (totals[best] ?? 0) + 1;
    normals[best] = (normals[best] ?? 0) + 1;
  }

  const band = speciesOf(tier);
  const rooms = normals.map((n, room) => {
    const monster = (slot: number, rank: Rank): LayoutMonster => {
      const species = type.species[hashN(seed, SALT_MONSTER, metre, room, slot) % type.species.length] ?? type.bossSpecies;
      return {
        species,
        rank,
        name: rank === 'champion' ? championName(hashN(seed, SALT_CHAMPION_NAME, metre, room, slot)) : band[species]?.name ?? '',
        mods: rank === 'champion' ? championMods(hashN(seed, SALT_MODS, metre, room, slot)) : [],
        extra: hashN(seed, SALT_EXTRA, metre, room, slot),
      };
    };
    const list = Array.from({ length: n }, (_, slot) => monster(slot, 'normal'));
    if (hasChampion[room]) list.push(monster(n, 'champion'));
    return list;
  });

  const boss: LayoutMonster = {
    species: type.bossSpecies, rank: 'boss', name: type.bossName, mods: [], extra: hashN(seed, SALT_BOSS, tier, index),
  };
  return { type, rooms, boss };
}
