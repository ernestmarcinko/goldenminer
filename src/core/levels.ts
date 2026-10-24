import { LEVEL_CAP } from './balance';

/** XP needed to leave `level`; 0 at the cap. */
export function xpToNext(level: number): number {
  return level >= LEVEL_CAP ? 0 : Math.round(100 * level ** 1.5);
}
