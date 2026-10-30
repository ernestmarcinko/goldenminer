import { autoMapping, autoMapMaxTier, autoMapQueueSize } from './autoMapRule';
import { firstEmpty } from './cells';
import type { MapItem } from './items';
import { putMap, startMap, takeMapAt } from './maps';
import type { GameState } from './types';

export { autoMapping, autoMapMaxTier, autoMapQueueSize, nextEligibleAutoMap } from './autoMapRule';

/** The map with `id` in the bag or the Map stash, read-only. */
export function findMap(state: Pick<GameState, 'bag' | 'stash'>, id: number): MapItem | undefined {
  const carried = state.bag.find((c): c is MapItem => c?.type === 'map' && c.id === id);
  if (carried !== undefined) return carried;
  for (const maps of Object.values(state.stash.maps)) {
    const stashed = maps.find((m) => m.id === id);
    if (stashed !== undefined) return stashed;
  }
  return undefined;
}

/** Takes the map with `id` out of the bag or the Map stash (not the queue), or undefined when it is not held there. */
function takeHeldMap(state: GameState, id: number): MapItem | undefined {
  const inBag = state.bag.findIndex((c) => c?.type === 'map' && c.id === id);
  const carried = state.bag[inBag];
  if (carried?.type === 'map') {
    state.bag[inBag] = null;
    return carried;
  }
  for (const [tier, list] of Object.entries(state.stash.maps)) {
    const index = list.findIndex((m) => m.id === id);
    if (index >= 0) return takeMapAt(state, { tier: Number(tier), index });
  }
  return undefined;
}

/** Moves a held map into the auto-map queue, up to its size; the map leaves the bag or Map stash for the queue. */
export function queueForAutoMap(state: GameState, id: number): 'ok' | 'alreadyQueued' | 'noSuchMap' | 'queueFull' | 'locked' {
  if (!autoMapping(state)) return 'locked';
  if (state.autoMap.queue.some((m) => m.id === id)) return 'alreadyQueued';
  if (state.autoMap.queue.length >= autoMapQueueSize(state)) return 'queueFull';
  const map = takeHeldMap(state, id);
  if (map === undefined) return 'noSuchMap';
  state.autoMap.queue.push(map);
  return 'ok';
}

/** Takes a map out of the queue and puts it back in the Map stash (or the bag, if its tier is full). */
export function unqueueForAutoMap(state: GameState, id: number): 'ok' | 'notQueued' {
  const index = state.autoMap.queue.findIndex((m) => m.id === id);
  if (index < 0) return 'notQueued';
  const [map] = state.autoMap.queue.splice(index, 1);
  if (map === undefined) return 'notQueued';
  if (putMap(state, map) === 'ok') return 'ok';
  const cell = firstEmpty(state.bag);
  if (cell >= 0) {
    state.bag[cell] = map;
    return 'ok';
  }
  // No room to return it: leave it queued.
  state.autoMap.queue.splice(index, 0, map);
  return 'notQueued';
}

/**
 * Starts the oldest queued map that is within the tier limit, and removes it from the queue. Over-tier maps stay queued
 * for later, a busy run leaves the queue untouched. When nothing eligible is left, the chain switches itself off — the
 * start button is then due back — while the over-tier maps stay queued.
 */
export function tryAutoMap(state: GameState): boolean {
  if (!autoMapping(state) || !state.autoMap.on) return false;
  const maxTier = autoMapMaxTier(state);
  let index = 0;
  while (index < state.autoMap.queue.length) {
    const map = state.autoMap.queue[index];
    if (map === undefined) break;
    if (map.tier > maxTier) {
      index++;
      continue;
    }
    const started = startMap(state, map.id, true);
    if (started === 'ok') return true;   // `startMap` removed it from the queue
    if (started === 'busy') return false;
    state.autoMap.queue.splice(index, 1);   // the map vanished between the look and the start
  }
  state.autoMap.on = false;   // nothing eligible left: the chain is done
  return false;
}
