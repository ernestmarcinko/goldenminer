import { checkAchievements } from './achievements';
import { LEVEL_CAP } from './balance';
import { MATERIALS } from './items';
import { putMap } from './maps';
import { fillAhead } from './metres';
import { deriveStats } from './stats';
import type { GameState } from './types';

/**
 * A test cheat: one instant mutation of the game state, for the dev-only Test tool. Each action is idempotent and
 * deterministic, and marks the achievements it earns. It never touches `state.rng` (a depth jump re-rolls `ahead` from
 * the seed, as a dig would).
 */
export type TestCheat =
  | { kind: 'level'; delta: number }
  | { kind: 'depth'; delta: number }
  | { kind: 'gold'; amount: number }
  | { kind: 'diamonds'; amount: number }
  | { kind: 'souls'; amount: number }
  | { kind: 'materials'; amount: number }
  | { kind: 'ascendancy'; amount: number }
  | { kind: 'maps' };

export function testCheat(state: GameState, action: TestCheat): void {
  switch (action.kind) {
    case 'level': {
      const before = state.level;
      state.level = Math.min(LEVEL_CAP, Math.max(1, before + action.delta));
      const gained = state.level - before;
      if (gained > 0) {
        state.stats.levelsGained += gained;
        checkAchievements(state, 'levelsGained');
      }
      state.xp = 0;
      checkAchievements(state, 'levels');
      break;
    }
    case 'depth': {
      state.deepest += action.delta;
      state.stats.metresDug += action.delta;
      state.stats.metresDugAuto += action.delta;
      state.ahead = {};
      fillAhead(state, deriveStats(state));
      checkAchievements(state, 'depth');
      checkAchievements(state, 'dig');
      checkAchievements(state, 'autoMined');
      break;
    }
    case 'gold':
      state.gold += action.amount;
      state.stats.goldFound += action.amount;
      checkAchievements(state, 'gold');
      break;
    case 'diamonds':
      state.diamonds += action.amount;
      state.stats.diamondsFound += action.amount;
      checkAchievements(state, 'diamonds');
      break;
    case 'souls':
      state.souls += action.amount;
      state.stats.soulsEarned += action.amount;
      checkAchievements(state, 'soulsEarned');
      break;
    case 'materials':
      for (const material of MATERIALS) {
        state.stash.materials[material] += action.amount;
        state.stats.oresFound[material] += action.amount;
        checkAchievements(state, `ore.${material}`);
      }
      break;
    case 'ascendancy':
      state.ascendancy.points += action.amount;
      break;
    case 'maps':
      for (let tier = 1; tier <= 5; tier++) {
        putMap(state, { id: state.nextId++, type: 'map', tier, metre: tier, rarity: 'normal', mods: [] });
      }
      checkAchievements(state, 'mapsFound');
      break;
  }
}
