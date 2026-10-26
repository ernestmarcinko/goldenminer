import { GUARANTEED_FIRST_MAP_METRE, RUNE_RNG_SALT } from './balance';
import { emptyInventory } from './cells';
import { DEFAULT_LOOT_FILTER } from './lootFilter';
import { fillAhead } from './metres';
import { defaultCharacterName } from './names';
import { emptyPremium } from './oreMarket';
import { hash2 } from './rng';
import { deriveStats } from './stats';
import { emptyLifetimeStats } from './telemetry';
import { DEFAULT_MOTION, type GameState } from './types';

export interface NewGameOptions { seedText?: string; lootSeed?: number; name?: string }

export function newGame(seed: number, nowMs: number, options: NewGameOptions = {}): GameState {
  const state: GameState = {
    seed, worldSeed: options.seedText ?? String(seed), worldGen: 2,
    characterName: (options.name ?? '').trim() || defaultCharacterName(seed),
    rng: hash2(options.lootSeed ?? seed, 0x5eed), tickCount: 0, lastTickAt: nowMs, lastWallAt: nowMs,
    gold: 0, diamonds: 0, deepest: 0, progress: 0,
    ahead: {}, finds: [],
    nextId: 1, ...emptyInventory(), lootTally: { kept: 0, sold: 0, salvaged: 0 },
    settings: { lootFilter: [...DEFAULT_LOOT_FILTER], motion: { ...DEFAULT_MOTION } },
    level: 1, xp: 0, souls: 0, activity: { kind: 'dig' }, lastRun: null, mapTally: { cleared: 0, lost: 0 },
    paused: false, drops: [], deaths: [],
    merchant: { band: 0, bought: [] }, uniqueRng: hash2(options.lootSeed ?? seed, 0xa11e),
    runeRng: hash2(options.lootSeed ?? seed, RUNE_RNG_SALT),
    oreMarket: { premium: emptyPremium() },
    passives: { allocated: [] },
    ascendancy: { points: 0, allocated: [] }, autoMap: { queue: [] }, lifetime: { ascensions: 0, deepest: 0 },
    stats: emptyLifetimeStats(), achievements: { earned: [] },
  };
  fillAhead(state, deriveStats(state));
  const first = state.ahead[1];
  if (first) first.hardRock = false;
  state.ahead[GUARANTEED_FIRST_MAP_METRE] = { feature: 'map', amount: 0, hardRock: false };
  return state;
}
