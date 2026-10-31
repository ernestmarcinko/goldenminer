import { AUTO_MAP_QUEUE_SIZE } from './balance';
import { ascendancyTotals } from './ascendancy';
import type { MapItem } from './items';
import { passiveTotals } from './passives';
import type { GameState } from './types';

// The pure rules behind auto-mapping, kept apart from `autoMap.ts` (which moves maps around) so that combat can read
// them without an import cycle: autoMap → maps → combat.

/** Whether the web's Surveyor notable is allocated. */
export function autoMapping(state: Pick<GameState, 'passives'>): boolean {
  return passiveTotals(state).autoMap;
}

/** How many maps the auto-map queue holds: 100 base, plus the ascendancy tree's. */
export function autoMapQueueSize(state: Pick<GameState, 'ascendancy'>): number {
  return AUTO_MAP_QUEUE_SIZE + ascendancyTotals(state).autoMapQueue;
}

/** The oldest queued map, whatever its tier, or undefined when the queue is empty. */
export function nextEligibleAutoMap(state: GameState): MapItem | undefined {
  return state.autoMap.queue[0];
}

/**
 * Whether the auto-map chain will keep going: the Surveyor notable is allocated, the switch is on, and a map is still
 * queued. Read by `endRun` to decide whether a finished auto-map may show its result dialog, and by the battle
 * view to know when the start button is due back.
 */
export function autoMapContinues(state: GameState): boolean {
  return autoMapping(state) && state.autoMap.on && nextEligibleAutoMap(state) !== undefined;
}
