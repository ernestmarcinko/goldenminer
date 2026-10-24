import { LEVEL_CAP } from './balance';
import type { GameState } from './types';

/** XP needed to leave `level`; 0 at the cap. */
export function xpToNext(level: number): number {
  return level >= LEVEL_CAP ? 0 : Math.round(100 * level ** 1.5);
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
