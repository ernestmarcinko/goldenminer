import { applyTicks } from '../../src/core/dig';
import type { GameState, Stats, TickEvent } from '../../src/core/types';

/**
 * Ticks as `applyTicks` does, then empties the bag and the held list, as a player clearing every find would, so a long
 * dig never stops for room. Placing a find draws nothing, so what is dug is the same.
 */
export function digClearing(s: GameState, count: number, stats: Stats, events?: TickEvent[]): void {
  applyTicks(s, count, stats, events);
  s.bag.fill(null);
  s.overflow.length = 0;
}
