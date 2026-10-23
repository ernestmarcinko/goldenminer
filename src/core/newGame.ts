import { GUARANTEED_FIRST_MAP_METRE } from './balance';
import { fillAhead } from './metres';
import { hash2 } from './rng';
import { deriveStats } from './stats';
import type { GameState } from './types';

export function newGame(seed: number, nowMs: number): GameState {
  const state: GameState = {
    seed, rng: hash2(seed, 0x5eed), tickCount: 0, lastTickAt: nowMs,
    gold: 0, diamonds: 0, depth: 0, deepest: 0, progress: 0, galleryProgress: 0,
    ahead: {}, finds: [],
  };
  fillAhead(state, deriveStats(state));
  const first = state.ahead[1];
  if (first) first.hardRock = false;
  state.ahead[GUARANTEED_FIRST_MAP_METRE] = { feature: 'map', amount: 0, hardRock: false };
  return state;
}
