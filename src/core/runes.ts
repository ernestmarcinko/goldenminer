import { RUNE_WEIGHT_BASE } from './balance';
import { GEAR_SETS, RUNE_TYPES, slotsOf } from './items';
import type { Rune, RuneType } from './items';
import type { Gen } from './itemGen';
import type { GameState } from './types';

/** The special stat a rune can multiply: a derived output, never a flat gear line. */
export type RuneStat = 'gold' | 'digPower' | 'damage' | 'autoTicks' | 'souls' | 'xp' | 'critMultiplier';
/** A rule-changing flag a rune can grant, read once at the point of use. */
export type RuneFlag = 'ignoreHardRock' | 'hazardImmune' | 'extraChest' | 'slowMonsters';

/**
 * What a rune does: multiplicative factors on derived outputs, and/or flags. Nothing a rune does is expressible as a
 * flat `StatKey` line — that is the whole point of the second socketable.
 */
export interface RuneEffect {
  mults?: Partial<Record<RuneStat, number>>;
  flags?: readonly RuneFlag[];
}

export const RUNE_LABELS: Readonly<Record<RuneType, string>> = {
  fehu: 'Fehu', uruz: 'Uruz', thurisaz: 'Thurisaz', ansuz: 'Ansuz', raidho: 'Raidho',
  kenaz: 'Kenaz', gebo: 'Gebo', wunjo: 'Wunjo', hagalaz: 'Hagalaz', isa: 'Isa',
};

export const RUNE_EFFECTS: Readonly<Record<RuneType, RuneEffect>> = {
  fehu: { mults: { gold: 2 } },
  uruz: { mults: { digPower: 1.5, damage: 1.5 } },
  thurisaz: { flags: ['ignoreHardRock'] },
  ansuz: { mults: { souls: 2 } },
  raidho: { mults: { autoTicks: 1.5 } },
  kenaz: { flags: ['hazardImmune'] },
  gebo: { flags: ['extraChest'] },
  wunjo: { mults: { xp: 1.5 } },
  hagalaz: { mults: { critMultiplier: 1.5 } },
  isa: { flags: ['slowMonsters'] },
};

/** The plain-words description a rune card and tab show. */
export const RUNE_DESCRIPTIONS: Readonly<Record<RuneType, string>> = {
  fehu: 'All Gold found is doubled.',
  uruz: 'Dig power and damage are 1.5×.',
  thurisaz: 'Hard rock costs no extra ticks.',
  ansuz: 'Souls found are doubled.',
  raidho: 'The auto tick rate is 1.5× (dig and fight faster).',
  kenaz: 'Hazards cause no slowdown.',
  gebo: 'Every chest drops one more item.',
  wunjo: 'XP gained is 1.5×.',
  hagalaz: 'Critical damage is 1.5×.',
  isa: 'Monsters attack 20 % slower.',
};

export function runeName(r: Rune): string {
  return RUNE_LABELS[r.rune];
}

/**
 * The geometric kind curve: kind 1 (fehu) weighs 2 ** (9 - 0) = 512, kind 10 (isa) 2 ** (9 - 9) = 1, summing to 1023.
 * The weighted pick runs only after a successful upgrade draw, so the overall "any rune" rate stays static.
 */
export function runeWeights(): readonly (readonly [RuneType, number])[] {
  return RUNE_TYPES.map((rune, i) => [rune, RUNE_WEIGHT_BASE ** (RUNE_TYPES.length - 1 - i)] as const);
}

/**
 * The runes' own stream: its draws read and write `state.runeRng`, its ids `state.nextId`. The upgrade decision draws
 * only from here, so `state.rng` stays the same for a player who never finds a rune. This is the uniques' idiom.
 */
export function runeGen(state: GameState): Gen {
  return {
    get rng() { return state.runeRng; },
    set rng(value: number) { state.runeRng = value; },
    get nextId() { return state.nextId; },
    set nextId(value: number) { state.nextId = value; },
  };
}

/**
 * The character-wide rune effect: the product of each present kind's factor and the union of their flags. A kind counts
 * at most once however many copies are socketed, and only while its gear is worn (exactly as gems do).
 */
export function runeTotals(state: GameState): { mults: Partial<Record<RuneStat, number>>; flags: Set<RuneFlag> } {
  const seen = new Set<RuneType>();
  const mults: Partial<Record<RuneStat, number>> = {};
  const flags = new Set<RuneFlag>();
  for (const set of GEAR_SETS) {
    for (const slot of slotsOf(set)) {
      const item = state.equipped[set][slot];
      if (item === undefined) continue;
      for (const socketed of item.gems) {
        if (!('rune' in socketed) || seen.has(socketed.rune)) continue;
        seen.add(socketed.rune);
        const effect = RUNE_EFFECTS[socketed.rune];
        for (const [stat, factor] of Object.entries(effect.mults ?? {}) as [RuneStat, number][]) {
          mults[stat] = (mults[stat] ?? 1) * factor;
        }
        for (const flag of effect.flags ?? []) flags.add(flag);
      }
    }
  }
  return { mults, flags };
}
