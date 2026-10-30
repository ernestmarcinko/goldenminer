import { MAP_TIER_CAP, MAX_ITEM_LEVEL } from './balance';
import { checkAchievements } from './achievements';
import { deriveBattleStats } from './battle';
import { endRun } from './combat';
import { dungeonLayout } from './dungeons';
import { gateWall, isGateTier } from './gates';
import { trail } from './dropLog';
import type { MapItem } from './items';
import { receiveItem } from './loot';
import { mapEffects } from './mapMods';
import { monsterState } from './monsters';
import { hasKeystone } from './passives';
import type { DropOrigin, GameState, LootNote } from './types';

/** Puts a map at the end of its tier's list in the Map stash; a full tier refuses it and nothing changes. */
export function putMap(state: GameState, map: MapItem): 'ok' | 'mapTierFull' {
  const list = state.stash.maps[map.tier];
  if (list === undefined) {
    state.stash.maps[map.tier] = [map];
    return 'ok';
  }
  if (list.length >= MAP_TIER_CAP) return 'mapTierFull';
  list.push(map);
  return 'ok';
}

/** Takes the map at a place in a tier list out of the Map stash; a tier left empty loses its key. */
export function takeMapAt(state: GameState, loc: { tier: number; index: number }): MapItem | undefined {
  const list = state.stash.maps[loc.tier];
  const map = list?.[loc.index];
  if (list === undefined || map === undefined) return undefined;
  list.splice(loc.index, 1);
  if (list.length === 0) delete state.stash.maps[loc.tier];
  return map;
}

/** Cartographer finds maps one tier higher; Prospector's Eye one tier lower; never past the item-level cap or below 1. */
export function mapTier(state: GameState, tier: number): number {
  const adjustment = (hasKeystone(state, 'cartographer') ? 1 : 0) - (hasKeystone(state, 'prospectorsEye') ? 1 : 0);
  return Math.max(1, Math.min(MAX_ITEM_LEVEL, tier + adjustment));
}

/** A found map is a normal one, and goes where every find goes: to the bag, else held, else sold. */
export function addMap(state: GameState, tier: number, metre: number): LootNote[] {
  return foundMap(state, tier, metre, { kind: 'metre', metre });
}

/** A map dropped by a map clear: a normal map found like any other, and also counted as one that came from a clear. */
export function dropMap(state: GameState, tier: number, metre: number, origin: DropOrigin): LootNote[] {
  state.stats.mapsFromClears += 1;
  return foundMap(state, tier, metre, origin);
}

function foundMap(state: GameState, tier: number, metre: number, origin: DropOrigin): LootNote[] {
  state.stats.mapsFound += 1;
  checkAchievements(state, 'mapsFound');
  return receiveItem(state, { id: state.nextId++, type: 'map', tier, metre, rarity: 'normal', mods: [] }, origin);
}

/** Takes a map out of its bag cell, its tier list, or the auto-map queue. */
export function takeMap(state: GameState, mapId: number): MapItem | undefined {
  const inBag = state.bag.findIndex((c) => c?.type === 'map' && c.id === mapId);
  const carried = state.bag[inBag];
  if (carried?.type === 'map') {
    state.bag[inBag] = null;
    return carried;
  }
  for (const [tier, list] of Object.entries(state.stash.maps)) {
    const index = list.findIndex((m) => m.id === mapId);
    if (index >= 0) return takeMapAt(state, { tier: Number(tier), index });
  }
  const queued = state.autoMap.queue.findIndex((m) => m.id === mapId);
  if (queued >= 0) return state.autoMap.queue.splice(queued, 1)[0];
  return undefined;
}

/**
 * Opens a map from the bag or the Map stash: the map leaves its cell and the run starts in room 1 at full life. `auto`
 * marks a map the auto-map chain started, so its finished result can be kept off the screen while the chain continues.
 */
export function startMap(state: GameState, mapId: number, auto = false): 'ok' | 'busy' | 'invalid' {
  if (state.activity.kind === 'map') return 'busy';
  const map = takeMap(state, mapId);
  if (map === undefined) return 'invalid';
  trail(state, map.id, { event: 'run' });
  const layout = dungeonLayout(state.seed, map);
  const fx = mapEffects(map);
  const { maxLife } = deriveBattleStats(state);
  const queue = (layout.rooms[0] ?? []).map((m) => monsterState(map.tier, m, fx, gateWall(state.seed, map.tier)));
  // A gate tier counts the runs started on it; a run remembers which attempt it is.
  const attempt = isGateTier(map.tier) ? (state.stats.gateAttempts[map.tier] ?? 0) + 1 : 0;
  if (attempt > 0) state.stats.gateAttempts[map.tier] = attempt;
  state.activity = {
    kind: 'map',
    run: {
      map, room: 1, bossRoom: layout.rooms.length + 1, queue,
      life: maxLife, hitCarry: 0, monsterCarry: 0, regenCarry: 0,
      gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [], items: 0, strikes: 0,
      minLife: maxLife, elapsedS: 0, attempt,
      ...(auto ? { auto: true as const } : {}),
    },
  };
  return 'ok';
}

/** Walks out of the running map; the map is spent, and auto-mapping is stopped. False when no map is running. */
export function leaveMap(state: GameState): boolean {
  if (state.activity.kind !== 'map') return false;
  endRun(state, state.activity.run, 'left');
  state.autoMap.on = false;
  return true;
}
