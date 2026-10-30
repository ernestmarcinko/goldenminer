import { AUTO_MAP_BASE_TIER, AUTO_MAP_QUEUE_SIZE } from './balance';
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

/** The highest map tier auto-mapping will start: the base tier plus the ascendancy tree's. */
export function autoMapMaxTier(state: Pick<GameState, 'ascendancy'>): number {
  return AUTO_MAP_BASE_TIER + ascendancyTotals(state).autoMapTier;
}

/** How many maps the auto-map queue holds: 100 base, plus the ascendancy tree's. */
export function autoMapQueueSize(state: Pick<GameState, 'ascendancy'>): number {
  return AUTO_MAP_QUEUE_SIZE + ascendancyTotals(state).autoMapQueue;
}

/** The oldest queued map within the tier limit, or undefined when the queue has none eligible. */
export function nextEligibleAutoMap(state: GameState): MapItem | undefined {
  const maxTier = autoMapMaxTier(state);
  return state.autoMap.queue.find((m) => m.tier <= maxTier);
}

/**
 * Whether the auto-map chain will keep going: the Surveyor notable is allocated, the switch is on, and an eligible map
 * is still queued. Read by `endRun` to decide whether a finished auto-map may show its result dialog, and by the battle
 * view to know when the start button is due back.
 */
export function autoMapContinues(state: GameState): boolean {
  return autoMapping(state) && state.autoMap.on && nextEligibleAutoMap(state) !== undefined;
}
