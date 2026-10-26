import { LEGENDARIES, LEGENDARY_IDS, type LegendaryId } from './itemData';
import type { Gen } from './itemGen';
import { setOfSlot } from './items';
import type { GameState } from './types';

/** Each legendary's unique line, as its card shows it. */
export const UNIQUE_LINES: Readonly<Record<LegendaryId, string>> = {
  deepdelver: 'Every 25th metre is dug at once, and its find is doubled.',
  golddigger: 'Gold veins also give a material of the band.',
  blackLantern: 'Hazards ahead show on the minimap, and hazards slow you by half as much.',
  longVoyage: 'The offline cap is doubled, and catch-up finds are doubled.',
  bandOfTheDeep: 'Critical hits heal 2 % of your life.',
  wolfEye: 'Champions and bosses drop one more item.',
  krakenLeather: 'Once per map, a killing blow leaves you at 1 life instead.',
  peacemaker: 'Every 5th hit strikes twice.',
};

export function isLegendaryId(id: string | undefined): id is LegendaryId {
  return (LEGENDARY_IDS as readonly (string | undefined)[]).includes(id);
}

/** Whether the legendary `id` is worn: its slot in its set holds an item of that unique. */
export function hasUnique(state: GameState, id: LegendaryId): boolean {
  const def = LEGENDARIES.find((d) => d.id === id);
  if (def === undefined) return false;
  return state.equipped[setOfSlot(def.slot)][def.slot]?.uniqueId === id;
}

/**
 * The uniques' own stream: its draws read and write `state.uniqueRng`, its ids `state.nextId`. A unique draws only from
 * here, so `state.rng` stays the same for a player without it.
 */
export function uniqueGen(state: GameState): Gen {
  return {
    get rng() { return state.uniqueRng; },
    set rng(value: number) { state.uniqueRng = value; },
    get nextId() { return state.nextId; },
    set nextId(value: number) { state.nextId = value; },
  };
}
