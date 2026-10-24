import { BASE_ROLL_CHANCES, diamondVeinAmount, goldVeinAmount } from './balance';
import { metreTier } from './bands';
import { hash2, mulberry32 } from './rng';
import type { FeatureKind, GameState, MetreRoll, Stats } from './types';

const FEATURE_ORDER: readonly FeatureKind[] = ['goldVein', 'diamondVein', 'chest', 'gem', 'map'];

type RollChances = Pick<Stats, 'featureChances' | 'hardRockChance'>;

function roll(next: () => number, tier: number, stats: RollChances): MetreRoll {
  const pick = next();
  let feature: FeatureKind | null = null;
  let cumulative = 0;
  for (const kind of FEATURE_ORDER) {
    cumulative += stats.featureChances[kind];
    if (pick < cumulative) { feature = kind; break; }
  }
  const hardRock = next() < stats.hardRockChance;
  let amount = 0;
  if (feature === 'goldVein') amount = goldVeinAmount(tier, next());
  else if (feature === 'diamondVein') amount = diamondVeinAmount(tier);
  return { feature, amount, hardRock };
}

export function rollMetre(seed: number, metre: number, stats: RollChances): MetreRoll {
  let state = hash2(seed, metre);
  const next = (): number => {
    const r = mulberry32(state);
    state = r.state;
    return r.value;
  };
  return roll(next, metreTier(metre), stats);
}

// Generation 2 worlds roll every metre from the base chances, so the seed alone decides what it holds.
export function metreChances(state: GameState, stats: Stats): RollChances {
  return state.worldGen === 2 ? BASE_ROLL_CHANCES : stats;
}

export function fillAhead(state: GameState, stats: Stats): void {
  const chances = metreChances(state, stats);
  for (let m = state.deepest + 1; m <= state.deepest + stats.lampSight; m++) {
    if (state.ahead[m] === undefined) state.ahead[m] = rollMetre(state.seed, m, chances);
  }
}
