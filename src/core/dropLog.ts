import { DEATH_LOG_LIMIT, DROP_LOG_LIMIT, MAX_TRAIL_STEPS } from './balance';
import { itemName } from './itemData';
import type { Item } from './items';
import type { DeathEntry, DropEntry, DropOrigin, GameState, MapRun, TrailStep } from './types';

function trimOldest<T>(list: T[], limit: number): void {
  if (list.length > limit) list.splice(0, list.length - limit);
}

function snapshot(item: Item): Pick<DropEntry, 'kind' | 'rarity' | 'base' | 'count'> {
  switch (item.type) {
    case 'gear': return { kind: 'gear', rarity: item.rarity, base: item.slot, count: 1 };
    case 'gem': return { kind: 'gem', rarity: 'gem', base: item.gem, count: item.count };
    case 'material': return { kind: 'material', rarity: 'material', base: item.material, count: item.count };
    case 'map': return { kind: 'map', rarity: item.rarity, base: 'map', count: 1 };
    case 'essence':
    case 'orb': throw new Error('essences and orbs are never logged');
  }
}

/** Logs a find under its item's id with the first thing that became of it; the log keeps its newest DROP_LOG_LIMIT. */
export function logDrop(state: GameState, item: Item, origin: DropOrigin, first: TrailStep): DropEntry {
  const entry: DropEntry = { id: item.id, name: itemName(item), ...snapshot(item), origin, trail: [first] };
  state.drops.push(entry);
  trimOldest(state.drops, DROP_LOG_LIMIT);
  return entry;
}

/**
 * Adds a step to the newest entry for an item. Gem and material stacks merge into others, so only gear and maps have a
 * trail; a long one keeps its first step and its newest ones.
 */
export function trail(state: GameState, itemId: number, step: TrailStep): void {
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const entry = state.drops[i];
    if (entry?.id !== itemId) continue;
    if (entry.kind !== 'gear' && entry.kind !== 'map') return;
    entry.trail.push(step);
    if (entry.trail.length > MAX_TRAIL_STEPS) entry.trail.splice(1, entry.trail.length - MAX_TRAIL_STEPS);
    return;
  }
}

/** Logs a death at the state's last tick; `advance` sets its wall time once the batch of ticks it fell in is known. */
export function logDeath(state: GameState, run: MapRun, killer: string): DeathEntry {
  const entry: DeathEntry = {
    id: state.nextId++, tick: state.tickCount, at: state.lastTickAt, map: structuredClone(run.map), room: run.room,
    bossRoom: run.bossRoom, killer,
  };
  state.deaths.push(entry);
  trimOldest(state.deaths, DEATH_LOG_LIMIT);
  return entry;
}
