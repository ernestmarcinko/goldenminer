import { MAP_STASH_SIZE } from './balance';
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
