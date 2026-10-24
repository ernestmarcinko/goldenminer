import { newGame } from './newGame';
import type { GameState } from './types';

export const ADJECTIVES = [
  'amber', 'ashen', 'brave', 'bright', 'calm', 'copper', 'crimson', 'dusky', 'eager', 'ember',
  'fallen', 'frosty', 'gentle', 'gilded', 'golden', 'hidden', 'hollow', 'iron', 'jolly', 'lucky',
  'mellow', 'misty', 'mossy', 'noble', 'quiet', 'rusty', 'sandy', 'scarlet', 'shady', 'silent',
  'silver', 'sleepy', 'smoky', 'stony', 'sunny', 'swift', 'velvet', 'wild', 'windy', 'young',
] as const;

export const ANIMALS = [
  'badger', 'bat', 'bear', 'beetle', 'boar', 'crow', 'deer', 'eel', 'falcon', 'ferret',
  'finch', 'fox', 'frog', 'gecko', 'goat', 'hare', 'hawk', 'heron', 'ibis', 'lark',
  'lynx', 'magpie', 'marten', 'mole', 'moth', 'newt', 'otter', 'owl', 'pike', 'raven',
  'robin', 'salmon', 'shrew', 'snail', 'stoat', 'swan', 'toad', 'vole', 'weasel', 'wren',
] as const;

const MAX_SEED_TEXT = 64;

export function isValidSeedText(text: string): boolean {
  const n = text.trim().length;
  return n >= 1 && n <= MAX_SEED_TEXT;
}

/** Plain numbers up to 2^32 - 1 are their own seed; any other text is hashed (FNV-1a over UTF-8). */
export function seedFromText(text: string): number {
  const t = text.trim();
  if (/^\d{1,10}$/.test(t) && Number(t) <= 4294967295) return Number(t);
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(t.toLowerCase())) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** `next` returns uint32 values; it is called three times, in this order. */
export function randomSeedText(next: () => number): string {
  const adjective = ADJECTIVES[next() % ADJECTIVES.length];
  const animal = ANIMALS[next() % ANIMALS.length];
  return `${adjective}-${animal}-${1 + (next() % 999)}`;
}

/** A brand-new random world; calls `next` four times (three for the text, one for the loot stream). */
export function freshWorld(next: () => number, nowMs: number): GameState {
  const text = randomSeedText(next);
  return newGame(seedFromText(text), nowMs, { seedText: text, lootSeed: next() });
}
