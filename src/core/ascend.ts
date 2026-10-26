import { ascendancyPoints, ascendancyTotals } from './ascendancy';
import { GUARANTEED_FIRST_MAP_METRE, LEVEL_CAP } from './balance';
import { emptyInventory } from './cells';
import { fillAhead } from './metres';
import { deriveStats } from './stats';
import type { GameState } from './types';

/**
 * At the level cap, trades the whole run for permanent ascendancy points and starts again at the tree's starting depth.
 * Keeps the tree, the auto-map queue, lifetime stats, settings, the world and both RNG streams.
 */
export function ascend(state: GameState): 'ok' | 'notReady' {
  if (state.level < LEVEL_CAP) return 'notReady';

  const deepest = state.deepest;
  const startingDepth = ascendancyTotals(state).startingDepth;
  state.lifetime.ascensions += 1;
  state.lifetime.deepest = Math.max(state.lifetime.deepest, deepest);
  state.ascendancy.points += ascendancyPoints(deepest);

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
