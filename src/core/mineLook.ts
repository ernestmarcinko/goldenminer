import { ABYSS_BAND_HEIGHT, ABYSS_START, bandAt, type Band } from './bands';
import { WALL_DETAIL_PERCENT } from './balance';
import { hash2 } from './rng';
import type { GameState } from './types';

export type DetailKind = 'root' | 'pebble' | 'shard' | 'chalk' | 'fossil' | 'quartz' | 'ember' | 'glass' | 'crystal' | 'bone';
export type Palette = [string, string, string, string];

export interface WorldRef { seed: number; gen: 1 | 2 }

export function worldOf(state: Pick<GameState, 'seed' | 'worldGen'>): WorldRef {
  return { seed: state.seed, gen: state.worldGen };
}

// Each deep-band feature gets its own salt so neighbouring bands are not chained.
const SALT_ADJECTIVE = 0xdee9;
const SALT_NOUN = 0x1d0e;
const SALT_HUE = 0xc010;
const SALT_SATURATION = 0x5a7a;
const SALT_DETAILS = 0xde7a;


export const DEEP_ADJECTIVES: readonly string[] = [
  'Weeping', 'Ashen', 'Hollow', 'Silent', 'Gloaming', 'Sunless', 'Shattered', 'Drowned',
  'Whispering', 'Brimstone', 'Pale', 'Starless', 'Ember', 'Frozen', 'Bleeding', 'Forgotten',
];
export const DEEP_NOUNS: readonly string[] = [
  'Deep', 'Seam', 'Vault', 'Maw', 'Reach', 'Hollows', 'Chasm', 'Depths',
  'Warren', 'Rift', 'Grotto', 'Abyss', 'Underdark', 'Lode', 'Cradle', 'Gulf',
];

const ABYSS_PALETTE: readonly [string, string, string, string] = ['#1a1620', '#201a27', '#17131c', '#241d2c'];

// Indexed by band tier - 1 (tiers 1-6 are the named bands).
const NAMED_PALETTES: readonly (readonly [string, string, string, string])[] = [
  ['#5a4030', '#4e3828', '#614634', '#553b2b'],
  ['#6b4a35', '#5c3f2d', '#734f39', '#63442f'],
  ['#6a5f4f', '#5e5446', '#716553', '#665b4a'],
  ['#4a4550', '#524c59', '#433e49', '#5a5462'],
  ['#2c2832', '#332e3a', '#28242d', '#38323f'],
  ['#1f1b24', '#241f2a', '#1b1820', '#2a2430'],
];

const NAMED_DETAILS: readonly (readonly DetailKind[])[] = [
  ['root', 'pebble'],
  ['shard', 'pebble'],
  ['chalk', 'fossil'],
  ['quartz'],
  ['ember'],
  ['glass'],
];
const ABYSS_DETAILS: readonly DetailKind[] = ['crystal'];

const DEEP_DETAIL_POOL: readonly DetailKind[] = ['crystal', 'bone', 'fossil', 'ember', 'quartz', 'glass'];
const DEEP_LIGHTNESS: readonly [number, number, number, number] = [13, 11, 15, 12];

function deepIndex(band: Band): number {
  return (band.start - ABYSS_START) / ABYSS_BAND_HEIGHT + 1;
}

export function bandTitle(world: WorldRef, band: Band): string {
  if (band.start < ABYSS_START || world.gen === 1) return band.name;
  const k = deepIndex(band);
  const adjective = DEEP_ADJECTIVES[hash2(world.seed ^ SALT_ADJECTIVE, k) % DEEP_ADJECTIVES.length];
  const noun = DEEP_NOUNS[hash2(world.seed ^ SALT_NOUN, k) % DEEP_NOUNS.length];
  return `The ${adjective} ${noun}`;
}

export function bandLook(world: WorldRef, band: Band): { palette: Palette; details: DetailKind[] } {
  if (band.start < ABYSS_START || world.gen === 1) {
    const i = Math.max(Math.floor(band.tier), 1) - 1;
    const palette = NAMED_PALETTES[i] ?? ABYSS_PALETTE;
    const details = NAMED_DETAILS[i] ?? ABYSS_DETAILS;
    return { palette: [palette[0], palette[1], palette[2], palette[3]], details: [...details] };
  }
  const k = deepIndex(band);
  const hue = hash2(world.seed ^ SALT_HUE, k) % 360;
  const saturation = 14 + (hash2(world.seed ^ SALT_SATURATION, k) % 14);
  const [l0, l1, l2, l3] = DEEP_LIGHTNESS;
  const hsl = (l: number) => `hsl(${hue}, ${saturation}%, ${l}%)`;
  const pick = hash2(world.seed ^ SALT_DETAILS, k);
  const first = pick % DEEP_DETAIL_POOL.length;
  const second = (first + 1 + ((pick >>> 8) % (DEEP_DETAIL_POOL.length - 1))) % DEEP_DETAIL_POOL.length;
  const details: DetailKind[] = [];
  for (const i of [first, second]) {
    const kind = DEEP_DETAIL_POOL[i];
    if (kind) details.push(kind);
  }
  return { palette: [hsl(l0), hsl(l1), hsl(l2), hsl(l3)], details };
}

export type WallTile = { shade: string; detail: DetailKind | null; bits: number };

export function wallTile(world: WorldRef, metre: number, side: 0 | 1, column: number): WallTile {
  const { palette, details } = bandLook(world, bandAt(metre - 1));
  const h = hash2(world.seed ^ (side ? 0x9e37 : 0x7f4a), metre * 8 + column);
  const hasDetail = (h >>> 8) % 100 < WALL_DETAIL_PERCENT;
  return {
    shade: palette[h % 4] ?? palette[0],
    detail: hasDetail ? details[(h >>> 16) % details.length] ?? null : null,
    bits: h >>> 24,
  };
}
