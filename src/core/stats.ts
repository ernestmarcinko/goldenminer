import {
  BASE_AUTO_TICKS_PER_SECOND, BASE_DIG_POWER, BASE_FEATURE_CHANCES, BASE_HARD_ROCK_CHANCE,
  BASE_LAMP_SIGHT, BASE_OFFLINE_CAP_MS, BASE_TICKS_PER_CLICK,
} from './balance';
import type { GameState, Stats } from './types';

// `state` is unused until gear and passives modify the base values.
export function deriveStats(_state: GameState): Stats {
  return {
    digPower: BASE_DIG_POWER,
    autoTicksPerSecond: BASE_AUTO_TICKS_PER_SECOND,
    ticksPerClick: BASE_TICKS_PER_CLICK,
    lampSight: BASE_LAMP_SIGHT,
    offlineCapMs: BASE_OFFLINE_CAP_MS,
    featureChances: { ...BASE_FEATURE_CHANCES },
    hardRockChance: BASE_HARD_ROCK_CHANCE,
  };
}
