import { ascendancyTotals } from './ascendancy';
import { AUTO_MAP_BASE_TIER } from './balance';
import type { MapItem } from './items';
import { startMap } from './maps';
import { passiveTotals } from './passives';
import type { GameState } from './types';

/** Whether the web's Surveyor notable is allocated. */
export function autoMapping(state: Pick<GameState, 'passives'>): boolean {
  return passiveTotals(state).autoMap;
}

/** The highest map tier auto-mapping will start: the base tier plus the ascendancy tree's. */
export function autoMapMaxTier(state: Pick<GameState, 'ascendancy'>): number {
  return AUTO_MAP_BASE_TIER + ascendancyTotals(state).autoMapTier;
}

/** The map with `id` in the bag or the Map stash, read-only: removing and starting it is `startMap`'s job. */
export function findMap(state: Pick<GameState, 'bag' | 'stash'>, id: number): MapItem | undefined {
  const carried = state.bag.find((c): c is MapItem => c?.type === 'map' && c.id === id);
  if (carried !== undefined) return carried;
  for (const maps of Object.values(state.stash.maps)) {
    const stashed = maps.find((m) => m.id === id);
    if (stashed !== undefined) return stashed;
  }
  return undefined;
}

/** Queues a map the player holds for away-time auto-mapping; a queued id runs once and leaves the queue. */
export function queueForAutoMap(state: GameState, id: number): 'ok' | 'alreadyQueued' | 'noSuchMap' {
  if (findMap(state, id) === undefined) return 'noSuchMap';
  if (state.autoMap.queue.includes(id)) return 'alreadyQueued';
  state.autoMap.queue.push(id);
  return 'ok';
}

/** Takes a map id out of the auto-map queue; an id that is not queued changes nothing. */
export function unqueueForAutoMap(state: GameState, id: number): 'ok' | 'notQueued' {
  const index = state.autoMap.queue.indexOf(id);
  if (index < 0) return 'notQueued';
  state.autoMap.queue.splice(index, 1);
  return 'ok';
}

/**
 * Starts the oldest queued map that still exists and is within the tier limit, and removes it from the queue.
 * Stale ids are dropped, over-tier maps stay queued for later, and a busy run leaves the queue untouched.
 */
export function tryAutoMap(state: GameState): boolean {
  if (!autoMapping(state)) return false;
  const maxTier = autoMapMaxTier(state);
  let index = 0;
  while (index < state.autoMap.queue.length) {
    const id = state.autoMap.queue[index];
    if (id === undefined) break;
    const map = findMap(state, id);
    if (map === undefined) {
      state.autoMap.queue.splice(index, 1);
      continue;
    }
    if (map.tier > maxTier) {
      index++;
      continue;
    }
    const started = startMap(state, id);
    if (started === 'ok') {
      state.autoMap.queue.splice(index, 1);
      return true;
    }
    if (started === 'busy') return false;
    // The map vanished between the lookup and the start: drop its id and look for the next one.
    state.autoMap.queue.splice(index, 1);
  }
  return false;
}
