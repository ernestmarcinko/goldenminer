import { hash2 } from './rng';

// Curated word and syllable lists for generated names (round-2 §2: never unpronounceable, never offensive).
// Joins stay pronounceable by construction: every start ends in one consonant after a vowel, every middle starts
// with a vowel, and every end starts with one consonant then a vowel, so a join never has three consonants in a row.
export const SYLLABLE_START: readonly string[] = [
  'Gor', 'Thul', 'Bram', 'Mor', 'Vel', 'Dur', 'Kel', 'Yor', 'Zor', 'Bel', 'Grol',
  'Tor', 'Ul', 'Ven', 'Dral', 'Kor', 'Fen', 'Ghal', 'Rul', 'Sol', 'Var', 'Hal',
];
export const SYLLABLE_MIDDLE: readonly string[] = ['a', 'o', 'ar', 'ul', 'om', 'il', 'ir', 'or'];
export const SYLLABLE_END: readonly string[] = [
  'vash', 'mar', 'dok', 'rin', 'gath', 'bor', 'dun', 'rik', 'mund', 'zul',
  'gan', 'loth', 'ver', 'kas', 'mok', 'ran', 'tar', 'vek',
];

export const EPITHETS: readonly string[] = [
  'Hollow', 'Unbroken', 'Grim', 'Patient', 'Restless', 'Old', 'Pale', 'Gnawing', 'Silent', 'Stubborn',
  'Ravenous', 'Watchful', 'Crooked', 'Ashen', 'Lightless', 'Unyielding', 'Tireless', 'Gleaming', 'Sleepless', 'Mighty',
];

export const BOSS_TITLES: readonly string[] = [
  'Warden', 'Keeper', 'Tyrant', 'Matron', 'Lord', 'Howler', 'Devourer', 'Shepherd',
];

export const DUNGEON_ADJECTIVES: readonly string[] = [
  'Weeping', 'Sunken', 'Mossy', 'Silent', 'Forgotten', 'Drowned', 'Crooked', 'Shattered', 'Whispering', 'Smouldering',
  'Echoing', 'Starless', 'Crumbling', 'Tangled', 'Restless', 'Ancient', 'Murky', 'Twisting', 'Lonely', 'Gloaming',
];

// Compounds follow the same rule as creature names: a prefix ends in at most one consonant, a suffix starts with one.
export const DUNGEON_PREFIXES: readonly string[] = [
  'Gloom', 'Iron', 'Slate', 'Grim', 'Mire', 'Ember', 'Shade', 'Deep', 'Cinder', 'Pale', 'Dim', 'Rune',
];
export const DUNGEON_SUFFIXES: readonly string[] = [
  'vein', 'hold', 'mouth', 'fall', 'gate', 'maw', 'delve', 'reach', 'lode', 'rock',
];

// Place nouns themed by band: keys 1-6 are the named tiers, 7 serves every deep tier.
export const DUNGEON_PLACES: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, readonly string[]>> = {
  1: ['Burrows', 'Hollows', 'Warrens', 'Roots', 'Tunnels'],
  2: ['Pits', 'Kilns', 'Mudworks', 'Ovens'],
  3: ['Caverns', 'Grottoes', 'Galleries', 'Halls'],
  4: ['Quarries', 'Shafts', 'Vaults', 'Diggings'],
  5: ['Forges', 'Vents', 'Furnaces', 'Calderas'],
  6: ['Spires', 'Mirrors', 'Glassworks', 'Sanctums'],
  7: ['Depths', 'Chasms', 'Rifts', 'Catacombs', 'Vaults'],
};

// Second words of a champion or boss name come from a rehash of the same key, not from overlapping bits.
const SALT_EPITHET = 0xe917;
const SALT_TITLE = 0x7171;

function pick(list: readonly string[], n: number): string {
  return list[n % list.length] ?? '';
}

function placeSlot(tier: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const t = Math.max(1, Math.floor(tier));
  return t === 1 || t === 2 || t === 3 || t === 4 || t === 5 || t === 6 ? t : 7;
}

// A middle that would stutter ("Gororan", "Bramamar") or double a consonant into the end ("Thulommok") is left out.
const STUTTER = /(..+)\1/i;

export function creatureWord(start: string, middle: string, end: string): string {
  const word = start + middle + end;
  if (middle === '' || (!STUTTER.test(word) && middle.slice(-1) !== end.charAt(0))) return word;
  return start + end;
}

export function creatureName(h: number): string {
  const middle = (h >>> 24) % 3 === 0 ? pick(SYLLABLE_MIDDLE, h >>> 16) : '';
  return creatureWord(pick(SYLLABLE_START, h), middle, pick(SYLLABLE_END, h >>> 8));
}

/** The most characters a character name may hold; `creatureName` tops out around 10, so this is generous. */
export const MAX_CHARACTER_NAME = 24;
export const SALT_CHARACTER_NAME = 0x6b6b;

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** A character name is trimmed non-empty, at most MAX_CHARACTER_NAME, and free of control characters. */
export function isValidCharacterName(text: string): boolean {
  const t = text.trim();
  return t.length >= 1 && t.length <= MAX_CHARACTER_NAME && !CONTROL_CHARACTER.test(t);
}

/** A random character name drawn from the generator; `next` returns uint32 values, as `creatureName` expects. */
export function randomCharacterName(next: () => number): string {
  return creatureName(next());
}

/** The deterministic name for a seed: the same seed always names the same miner. */
export function defaultCharacterName(seed: number): string {
  return creatureName(hash2(seed, SALT_CHARACTER_NAME));
}

export function championName(h: number): string {
  return `${creatureName(h)} the ${pick(EPITHETS, hash2(h, SALT_EPITHET))}`;
}

/** Every dungeon name a tier can have, in list order: the adjective form, then the compounds. */
export function allDungeonNames(tier: number): string[] {
  const places = DUNGEON_PLACES[placeSlot(tier)];
  return [
    ...DUNGEON_ADJECTIVES.flatMap((a) => places.map((p) => `The ${a} ${p}`)),
    ...DUNGEON_PREFIXES.flatMap((pre) => DUNGEON_SUFFIXES.flatMap((suf) => places.map((p) => `${pre}${suf} ${p}`))),
  ];
}

export function dungeonName(h: number, tier: number): string {
  const place = pick(DUNGEON_PLACES[placeSlot(tier)], h >>> 16);
  if (h & 1) return `The ${pick(DUNGEON_ADJECTIVES, h >>> 1)} ${place}`;
  return `${pick(DUNGEON_PREFIXES, h >>> 1)}${pick(DUNGEON_SUFFIXES, h >>> 8)} ${place}`;
}

export function bossName(h: number, dungeon: string): string {
  const of = dungeon.startsWith('The ') ? `the ${dungeon.slice(4)}` : dungeon;
  return `${creatureName(h)}, ${pick(BOSS_TITLES, hash2(h, SALT_TITLE))} of ${of}`;
}
