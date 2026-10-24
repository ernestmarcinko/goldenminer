import { SLOT_IMPLICIT } from '../../src/core/items';
import type { GearItem, GemItem, GemType, Slot } from '../../src/core/items';
import type { GameState } from '../../src/core/types';

export function gear(s: GameState, slot: Slot, p: Partial<GearItem> = {}): GearItem {
  return { id: s.nextId++, type: 'gear', slot, name: `Test ${slot}`, rarity: 'magic', ilvl: 4,
    implicit: { stat: SLOT_IMPLICIT[slot], value: 5 }, affixes: [], sockets: 0, gems: [], ...p };
}
export function gem(s: GameState, type: GemType = 'ruby', p: Partial<GemItem> = {}): GemItem {
  return { id: s.nextId++, type: 'gem', gem: type, grade: 'tiny', count: 1, ...p };
}
