import { SLOT_IMPLICIT } from '../../src/core/items';
import type { GearItem, GemItem, GemType, MapItem, ModLine, Slot, StatLine } from '../../src/core/items';
import { putMap } from '../../src/core/maps';
import type { GameState } from '../../src/core/types';

/** Test gear; a line given without a tier is T1. */
export function gear(
  s: GameState, slot: Slot, p: Omit<Partial<GearItem>, 'affixes'> & { affixes?: (StatLine & Partial<ModLine>)[] } = {},
): GearItem {
  const { affixes = [], ...rest } = p;
  return { id: s.nextId++, type: 'gear', slot, name: `Test ${slot}`, rarity: 'magic', ilvl: 4,
    implicit: { stat: SLOT_IMPLICIT[slot], value: 5 }, sockets: 0, gems: [], ...rest, affixes: affixes.map((a) => ({ tier: 1, ...a })) };
}
export function gem(s: GameState, type: GemType = 'ruby', p: Partial<GemItem> = {}): GemItem {
  return { id: s.nextId++, type: 'gem', gem: type, grade: 'tiny', count: 1, ...p };
}
/** A normal test map put in its tier of the Map stash, as found maps went before every find went to the bag. */
export function stashMap(s: GameState, tier: number, metre: number): MapItem {
  const map: MapItem = { id: s.nextId++, type: 'map', tier, metre, rarity: 'normal', mods: [] };
  if (putMap(s, map) !== 'ok') throw new Error(`the tier ${tier} maps are full`);
  return map;
}
