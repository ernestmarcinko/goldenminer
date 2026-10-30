import { checkAchievements } from './achievements';
import { ascendancyPoints, ascendancyTotals } from './ascendancy';
import { ASCEND_LEVEL, GUARANTEED_FIRST_MAP_METRE } from './balance';
import { emptyInventory } from './cells';
import { fillAhead } from './metres';
import { deriveStats } from './stats';
import type { GameState } from './types';

/**
 * From the ascend level, trades the whole run for permanent ascendancy points and starts again at the tree's starting
 * depth. Points scale with depth and, from the second ascension on, with how far past the ascend level the miner got.
 * Keeps the tree, the auto-map queue, lifetime stats, settings, the world and both RNG streams.
 */
export function ascend(state: GameState): 'ok' | 'notReady' {
  if (state.level < ASCEND_LEVEL) return 'notReady';

  const deepest = state.deepest;
  const startingDepth = ascendancyTotals(state).startingDepth;
  const points = ascendancyPoints(deepest, state.level, state.lifetime.ascensions);
  state.lifetime.ascensions += 1;
  checkAchievements(state, 'ascensions');
  state.lifetime.deepest = Math.max(state.lifetime.deepest, deepest);
  state.ascendancy.points += points;

  state.level = 1;
  state.xp = 0;
  state.passives = { allocated: [] };
  state.gold = 0;
  state.diamonds = 0;
  state.souls = 0;
  state.deepest = startingDepth;
  state.progress = 0;
  state.ahead = {};
  state.finds = [];
  state.nextId = 1;
  // Queued maps keep their ids, so new ids start past them.
  for (const m of state.autoMap.queue) state.nextId = Math.max(state.nextId, m.id + 1);
  state.activity = { kind: 'dig' };
  state.lastRun = null;
  state.mapTally = { cleared: 0, lost: 0 };
  state.lootTally = { kept: 0, sold: 0, salvaged: 0 };
  state.paused = false;
  state.drops = [];
  state.deaths = [];
  state.merchant = { band: 0, bought: [] };
  const inventory = emptyInventory();
  state.bag = inventory.bag;
  state.stash = inventory.stash;
  state.equipped = inventory.equipped;
  state.overflow = inventory.overflow;

  fillAhead(state, deriveStats(state));
  const first = state.ahead[startingDepth + 1];
  if (first !== undefined) first.hardRock = false;
  state.ahead[startingDepth + GUARANTEED_FIRST_MAP_METRE] = { feature: 'map', amount: 0, hardRock: false };
  return 'ok';
}
