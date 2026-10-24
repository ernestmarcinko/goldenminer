import { MAP_STASH_SIZE } from './balance';
import { deriveBattleStats } from './battle';
import { endRun } from './combat';
import { dungeonLayout } from './dungeons';
import { monsterState } from './monsters';
import type { GameState, MapItem } from './types';

/**
 * A found map joins the Maps tab. A full tab drops its lowest-tier, oldest map to make room, so on a tie the newer map
 * stays; a new map strictly below every map in the tab is not kept (its id is still used).
 */
export function addMap(state: GameState, tier: number, metre: number): MapItem {
  const map: MapItem = { id: state.nextId++, type: 'map', tier, metre };
  const maps = state.stash.maps;
  if (maps.length >= MAP_STASH_SIZE) {
    let lowest = 0;
    for (let i = 1; i < maps.length; i++) {
      if ((maps[i]?.tier ?? 0) < (maps[lowest]?.tier ?? 0)) lowest = i;
    }
    if (tier < (maps[lowest]?.tier ?? 0)) return map;
    maps.splice(lowest, 1);
  }
  maps.push(map);
  return map;
}

/** Opens a map from the Maps tab: the map leaves the stash and the run starts in room 1 at full life. */
export function startMap(state: GameState, mapId: number): 'ok' | 'busy' | 'invalid' {
  if (state.activity.kind === 'map') return 'busy';
  const index = state.stash.maps.findIndex((m) => m.id === mapId);
  const map = state.stash.maps[index];
  if (map === undefined) return 'invalid';
  const layout = dungeonLayout(state.seed, map);
  const queue = (layout.rooms[0] ?? []).map((m) => monsterState(map.tier, m));
  state.stash.maps.splice(index, 1);
  state.activity = {
    kind: 'map',
    run: {
      map, room: 1, bossRoom: layout.rooms.length + 1, queue,
      life: deriveBattleStats(state).maxLife, hitCarry: 0, monsterCarry: 0,
      gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [],
    },
  };
  return 'ok';
}

/** Walks out of the running map; the map is spent. False when no map is running. */
export function leaveMap(state: GameState): boolean {
  if (state.activity.kind !== 'map') return false;
  endRun(state, state.activity.run, 'left');
  return true;
}
