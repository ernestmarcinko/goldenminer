import {
  CHEST_BATTLE_CHANCE, CHEST_SECOND_ITEM_CHANCE, DEFAULT_STAT_WEIGHT, RARE_FOURTH_AFFIX_CHANCE, RARITY_WEIGHTS,
  SOCKET_WEIGHTS, STAT_WEIGHTS, rollStat,
} from './balance';
import { LEGENDARIES, RARE_FIRST, RARE_SECOND, STAT_WORDS, baseName } from './itemData';
import {
  GEM_TYPES, RARITIES, SLOT_IMPLICIT, setOfSlot, slotsOf, statsOf,
  type GearItem, type GearSet, type GemItem, type Rarity, type Slot, type StatKey, type StatLine,
} from './items';
import { nextRandom, pickWeighted } from './rng';
import type { GameState } from './types';

type Gen = Pick<GameState, 'rng' | 'nextId'>;

function pickUniform<T>(state: Gen, list: readonly T[]): T {
  const item = list[Math.floor(nextRandom(state) * list.length)];
  if (item === undefined) throw new Error('pickUniform needs a non-empty list');
  return item;
}

export function rollRarity(state: Gen): Rarity {
  return pickWeighted(state, RARITIES.map((r) => [r, RARITY_WEIGHTS[r]] as const));
}

function rollSockets(state: Gen): number {
  return pickWeighted(state, SOCKET_WEIGHTS.map((w, count) => [count, w] as const));
}

function rollAffixes(state: Gen, set: GearSet, ilvl: number, count: number, implicit: StatKey): StatLine[] {
  const pool: StatKey[] = statsOf(set).filter((s) => s !== implicit);
  const affixes: StatLine[] = [];
  for (let i = 0; i < count; i++) {
    const stat = pickWeighted(state, pool.map((s) => [s, STAT_WEIGHTS[s] ?? DEFAULT_STAT_WEIGHT] as const));
    pool.splice(pool.indexOf(stat), 1);
    affixes.push({ stat, value: rollStat(stat, ilvl, nextRandom(state)) });
  }
  return affixes;
}

export function rollGear(state: Gen, ilvl: number, set: GearSet, rarity: Rarity = rollRarity(state)): GearItem {
  let slot: Slot;
  let name: string;
  let affixes: StatLine[];
  let uniqueId: string | undefined;
  let implicit: StatLine;
  if (rarity === 'legendary') {
    const def = pickUniform(state, LEGENDARIES.filter((d) => setOfSlot(d.slot) === set));
    slot = def.slot;
    implicit = { stat: SLOT_IMPLICIT[slot], value: rollStat(SLOT_IMPLICIT[slot], ilvl, nextRandom(state)) };
    affixes = def.lines.map((line) => {
      if ('fixed' in line) return { stat: line.stat, value: line.fixed };
      return { stat: line.stat, value: Math.round(rollStat(line.stat, ilvl, nextRandom(state)) * line.scale) };
    });
    name = def.name;
    uniqueId = def.id;
  } else {
    slot = pickUniform(state, slotsOf(set));
    const implicitStat = SLOT_IMPLICIT[slot];
    implicit = { stat: implicitStat, value: rollStat(implicitStat, ilvl, nextRandom(state)) };
    let count = rarity === 'magic' ? 2 : rarity === 'rare' ? 3 : 0;
    if (rarity === 'rare' && nextRandom(state) < RARE_FOURTH_AFFIX_CHANCE) count++;
    affixes = rollAffixes(state, set, ilvl, count, implicitStat);
    const a0 = affixes[0];
    const a1 = affixes[1];
    if (rarity === 'magic' && a0 !== undefined && a1 !== undefined) {
      name = `${STAT_WORDS[a0.stat].prefix} ${baseName(slot, ilvl)} of ${STAT_WORDS[a1.stat].suffix}`;
    } else if (rarity === 'rare') {
      name = `${pickUniform(state, RARE_FIRST)} ${pickUniform(state, RARE_SECOND[slot])}`;
    } else {
      name = baseName(slot, ilvl);
    }
  }
  const sockets = rollSockets(state);
  const item: GearItem = { id: state.nextId++, type: 'gear', slot, name, rarity, ilvl, implicit, affixes, sockets, gems: [] };
  if (uniqueId !== undefined) item.uniqueId = uniqueId;
  return item;
}

export function rollGem(state: Gen, ilvl: number): GemItem {
  return { id: state.nextId++, type: 'gem', gem: pickUniform(state, GEM_TYPES), ilvl };
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
