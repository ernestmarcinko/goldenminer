import {
  LEVEL_CAP, XP_EXPONENT, XP_PER_LEVEL, XP_RAMP_CAP, XP_RAMP_FULL, XP_RAMP_MULT, XP_RAMP_START,
} from './balance';
import type { GameState } from './types';

/** The late-game ramp: 1× through the early levels, then two stages up to XP_RAMP_CAP at the cap. */
function xpRamp(level: number): number {
  if (level <= XP_RAMP_START) return 1;
  if (level <= XP_RAMP_FULL) {
    const t = (level - XP_RAMP_START) / (XP_RAMP_FULL - XP_RAMP_START);
    return 1 + (XP_RAMP_MULT - 1) * t;
  }
  const t = (level - XP_RAMP_FULL) / (LEVEL_CAP - XP_RAMP_FULL);
  return XP_RAMP_MULT + (XP_RAMP_CAP - XP_RAMP_MULT) * t;
}

/** XP needed to leave `level`; 0 at the cap. */
export function xpToNext(level: number): number {
  return level >= LEVEL_CAP ? 0 : Math.round(XP_PER_LEVEL * level ** XP_EXPONENT * xpRamp(level));
}

/** Adds XP and levels the miner up while there is enough; returns the levels gained. XP is 0 at the cap. */
export function gainXp(state: Pick<GameState, 'level' | 'xp'>, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  state.xp += amount;
  let gained = 0;
  while (state.level < LEVEL_CAP && state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    gained++;
  }
  if (state.level >= LEVEL_CAP) state.xp = 0;
  return gained;
}
