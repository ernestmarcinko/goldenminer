import { SLOT_IMPLICIT } from '../../src/core/items';
import type { GearItem, GemItem, GemType, ModLine, Slot, StatLine } from '../../src/core/items';
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
