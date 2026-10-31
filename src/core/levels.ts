import { checkAchievements } from './achievements';
import {
  LEVEL_CAP, XP_EXPONENT, XP_PER_LEVEL, XP_RAMP_KNEE, XP_RAMP_LATE, XP_RAMP_START, XP_RAMP_STEEP,
} from './balance';
import type { GameState } from './types';

/** The ramp: 1× through the early levels, then XP_RAMP_STEEP a level to the knee, then XP_RAMP_LATE a level to the cap. */
function xpRamp(level: number): number {
  const steep = Math.min(Math.max(level, XP_RAMP_START), XP_RAMP_KNEE) - XP_RAMP_START;
  return XP_RAMP_STEEP ** steep * XP_RAMP_LATE ** Math.max(0, level - XP_RAMP_KNEE);
}

/** XP needed to leave `level`; 0 at the cap. */
export function xpToNext(level: number): number {
  return level >= LEVEL_CAP ? 0 : Math.round(XP_PER_LEVEL * level ** XP_EXPONENT * xpRamp(level));
}

/** Adds XP and levels the miner up while there is enough; returns the levels gained. XP is 0 at the cap. */
export function gainXp(state: GameState, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  state.xp += amount;
  let gained = 0;
  while (state.level < LEVEL_CAP && state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    gained++;
  }
  if (state.level >= LEVEL_CAP) state.xp = 0;
  if (gained > 0) checkAchievements(state, 'levels');
  return gained;
}
