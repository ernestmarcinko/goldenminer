import { deriveBattleStats } from './battle';
import { firstEmpty } from './cells';
import { endRun } from './combat';
import { dungeonLayout } from './dungeons';
import type { Cell, MapItem } from './items';
import { mapEffects } from './mapMods';
import { monsterState } from './monsters';
import type { GameState } from './types';

/**
 * A found map is a normal one, and takes the first empty Maps-tab cell. A full tab drops its lowest-tier, oldest map
 * to make room, so on a tie the newer map stays; a new map strictly below every map in the tab is not kept (its id is
 * still used). Maps in the bag are never dropped.
 */
export function addMap(state: GameState, tier: number, metre: number): MapItem {
  const map: MapItem = { id: state.nextId++, type: 'map', tier, metre, rarity: 'normal', mods: [] };
  const maps = state.stash.maps;
  const empty = firstEmpty(maps);
  if (empty >= 0) {
    maps[empty] = map;
    return map;
  }
  let lowest: MapItem | null = null;
  for (const m of maps) {
    if (m !== null && (lowest === null || m.tier < lowest.tier || (m.tier === lowest.tier && m.id < lowest.id))) lowest = m;
  }
  if (lowest === null || tier < lowest.tier) return map;
  maps[maps.indexOf(lowest)] = map;
  return map;
}

/** Takes a map out of its bag or Maps-tab cell. */
function takeMap(state: GameState, mapId: number): MapItem | undefined {
  for (const cells of [state.bag, state.stash.maps] as Cell[][]) {
    const index = cells.findIndex((c) => c?.type === 'map' && c.id === mapId);
    const map = cells[index];
    if (map?.type !== 'map') continue;
    cells[index] = null;
    return map;
  }
  return undefined;
}

/** Opens a map from the bag or the Maps tab: the map leaves its cell and the run starts in room 1 at full life. */
export function startMap(state: GameState, mapId: number): 'ok' | 'busy' | 'invalid' {
  if (state.activity.kind === 'map') return 'busy';
  const map = takeMap(state, mapId);
  if (map === undefined) return 'invalid';
  const layout = dungeonLayout(state.seed, map);
  const fx = mapEffects(map);
  const queue = (layout.rooms[0] ?? []).map((m) => monsterState(map.tier, m, fx));
  state.activity = {
    kind: 'map',
    run: {
      map, room: 1, bossRoom: layout.rooms.length + 1, queue,
      life: deriveBattleStats(state).maxLife, hitCarry: 0, monsterCarry: 0, regenCarry: 0,
      gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, log: [], loot: [], items: 0,
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
