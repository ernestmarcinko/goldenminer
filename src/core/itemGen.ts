import {
  CHEST_BATTLE_CHANCE, CHEST_SECOND_ITEM_CHANCE, DEFAULT_STAT_WEIGHT, MAGIC_LINE_WEIGHTS, MAX_SIDE_LINES, RARE_LINE_WEIGHTS,
  RARITY_WEIGHTS, SOCKET_WEIGHTS, STAT_WEIGHTS,
} from './balance';
import { LEGENDARIES, RARE_FIRST, RARE_SECOND, MOD_WORDS, baseName, gemGradeFor } from './itemData';
import {
  GEM_TYPES, MOD_SIDE, RARITIES, SLOT_IMPLICIT, setOfSlot, slotsOf, statsOf,
  type GearItem, type GearSet, type GemItem, type ModLine, type Rarity, type Slot, type StatKey, type StatLine,
} from './items';
import { nextRandom, pickWeighted } from './rng';
import { tierCap, tierRange, tierWeights } from './tiers';
import type { GameState } from './types';

type Gen = Pick<GameState, 'rng' | 'nextId'>;
type Side = 'prefix' | 'suffix';

function pickUniform<T>(state: Gen, list: readonly T[]): T {
  const item = list[Math.floor(nextRandom(state) * list.length)];
  if (item === undefined) throw new Error('pickUniform needs a non-empty list');
  return item;
}

/** Magic find multiplies the weights of every rarity but normal. */
export function rollRarity(state: Gen, magicFind = 1): Rarity {
  return pickWeighted(state, RARITIES.map((r) => [r, r === 'normal' ? RARITY_WEIGHTS[r] : RARITY_WEIGHTS[r] * magicFind] as const));
}

export function rollSockets(state: Gen): number {
  return pickWeighted(state, SOCKET_WEIGHTS.map((w, count) => [count, w] as const));
}

/** A value uniform in one tier's range. */
export function rollValue(state: Gen, stat: StatKey, tier: number): number {
  const { lo, hi } = tierRange(stat, tier);
  return lo + Math.floor(nextRandom(state) * (hi - lo + 1));
}

/** A tier up to `cap`, the low ones likelier, then a value inside it. */
export function rollModLine(state: Gen, stat: StatKey, cap: number): ModLine {
  const tier = pickWeighted(state, tierWeights(cap));
  return { stat, value: rollValue(state, stat, tier), tier };
}

/** The lines on one side; crafted lines sit outside the 3 + 3. */
export function sideCount(lines: readonly ModLine[], side: Side): number {
  return lines.filter((l) => l.crafted !== true && MOD_SIDE[l.stat] === side).length;
}

/**
 * Rolls `count` new lines for an item that already has `existing`, and returns only the new ones.
 * `perSide` is the room on each side, 1 for a magic item; crafted lines never take it up.
 */
export function rollLines(
  state: Gen, slot: Slot, ilvl: number, count: number, existing: readonly ModLine[] = [], perSide = MAX_SIDE_LINES,
): ModLine[] {
  const implicit = SLOT_IMPLICIT[slot];
  const lines = [...existing];
  const added: ModLine[] = [];
  for (let i = 0; i < count; i++) {
    const pool = statsOf(setOfSlot(slot)).filter(
      (s) => s !== implicit && !lines.some((l) => l.stat === s) && sideCount(lines, MOD_SIDE[s]) < perSide,
    );
    if (pool.length === 0) throw new Error('rollLines has no room for another line');
    const stat = pickWeighted(state, pool.map((s) => [s, STAT_WEIGHTS[s] ?? DEFAULT_STAT_WEIGHT] as const));
    const line = rollModLine(state, stat, tierCap(ilvl));
    lines.push(line);
    added.push(line);
  }
  return added;
}

/** A magic item is named by its prefix and its suffix; either half drops out when it has none. */
export function magicName(slot: Slot, ilvl: number, lines: readonly ModLine[]): string {
  const word = (side: Side) => {
    const line = lines.find((l) => l.crafted !== true && MOD_SIDE[l.stat] === side);
    return line && MOD_WORDS[line.stat];
  };
  const prefix = word('prefix');
  const suffix = word('suffix');
  const base = baseName(slot, ilvl);
  const head = prefix === undefined ? base : `${prefix} ${base}`;
  return suffix === undefined ? head : `${head} of ${suffix}`;
}

export function rareName(state: Gen, slot: Slot): string {
  return `${pickUniform(state, RARE_FIRST)} ${pickUniform(state, RARE_SECOND[slot])}`;
}

/**
 * Gear of `set` at `ilvl`. A given `forSlot` (in `set`) skips the slot draw; a legendary rolled for a slot that has none
 * becomes rare. Without a slot the draws are exactly those drops have always made.
 */
export function rollGear(state: Gen, ilvl: number, set: GearSet, rarity: Rarity = rollRarity(state), forSlot?: Slot): GearItem {
  let slot: Slot;
  let name: string;
  let affixes: ModLine[];
  let uniqueId: string | undefined;
  let implicit: StatLine;
  const cap = tierCap(ilvl);
  const legendaries = LEGENDARIES.filter((d) => (forSlot === undefined ? setOfSlot(d.slot) === set : d.slot === forSlot));
  if (rarity === 'legendary' && legendaries.length === 0) rarity = 'rare';
  if (rarity === 'legendary') {
    const def = pickUniform(state, legendaries);
    slot = def.slot;
    implicit = { stat: SLOT_IMPLICIT[slot], value: rollValue(state, SLOT_IMPLICIT[slot], cap) };
    // A legendary's lines are hand-written, so they carry no tier.
    affixes = def.lines.map((line) => {
      if ('fixed' in line) return { stat: line.stat, value: line.fixed, tier: 0 };
      return { stat: line.stat, value: Math.round(rollValue(state, line.stat, cap) * line.scale), tier: 0 };
    });
    name = def.name;
    uniqueId = def.id;
  } else {
    slot = forSlot ?? pickUniform(state, slotsOf(set));
    const implicitStat = SLOT_IMPLICIT[slot];
    implicit = { stat: implicitStat, value: rollValue(state, implicitStat, cap) };
    const count = rarity === 'magic' ? pickWeighted(state, MAGIC_LINE_WEIGHTS)
      : rarity === 'rare' ? pickWeighted(state, RARE_LINE_WEIGHTS) : 0;
    affixes = rollLines(state, slot, ilvl, count, [], rarity === 'magic' ? 1 : MAX_SIDE_LINES);
    name = rarity === 'magic' ? magicName(slot, ilvl, affixes) : rarity === 'rare' ? rareName(state, slot) : baseName(slot, ilvl);
  }
  const sockets = rollSockets(state);
  const item: GearItem = { id: state.nextId++, type: 'gear', slot, name, rarity, ilvl, implicit, affixes, sockets, gems: [] };
  if (uniqueId !== undefined) item.uniqueId = uniqueId;
  return item;
}

export function rollGem(state: Gen, tier: number): GemItem {
  return { id: state.nextId++, type: 'gem', gem: pickUniform(state, GEM_TYPES), grade: gemGradeFor(tier), count: 1 };
}

export function rollChest(state: Gen, ilvl: number): GearItem[] {
  const count = nextRandom(state) < CHEST_SECOND_ITEM_CHANCE ? 2 : 1;
  const loot: GearItem[] = [];
  for (let i = 0; i < count; i++) {
    const set: GearSet = nextRandom(state) < CHEST_BATTLE_CHANCE ? 'battle' : 'mining';
    loot.push(rollGear(state, ilvl, set));
  }
  return loot;
}
