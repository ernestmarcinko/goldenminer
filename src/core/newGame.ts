import { GUARANTEED_FIRST_MAP_METRE } from './balance';
import { fillAhead } from './metres';
import { hash2 } from './rng';
import { deriveStats } from './stats';
import { DEFAULT_MOTION, type GameState } from './types';

export interface NewGameOptions { seedText?: string; lootSeed?: number }

export function newGame(seed: number, nowMs: number, options: NewGameOptions = {}): GameState {
  const state: GameState = {
    seed, worldSeed: options.seedText ?? String(seed), worldGen: 2,
    rng: hash2(options.lootSeed ?? seed, 0x5eed), tickCount: 0, lastTickAt: nowMs,
    gold: 0, diamonds: 0, depth: 0, deepest: 0, progress: 0, galleryProgress: 0,
    ahead: {}, finds: [],
    nextId: 1, goldCarry: 0, equipped: { mining: {}, battle: {} }, bags: { mining: [], battle: [] },
    stash: [], overflow: [], lootTally: { kept: 0, sold: 0, salvaged: 0 },
    settings: { lootFilter: [], bagFull: 'sellWorst', motion: { ...DEFAULT_MOTION } },
  };
  fillAhead(state, deriveStats(state));
  const first = state.ahead[1];
  if (first) first.hardRock = false;
  state.ahead[GUARANTEED_FIRST_MAP_METRE] = { feature: 'map', amount: 0, hardRock: false };
  return state;
}
