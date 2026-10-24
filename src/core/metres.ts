import { diamondVeinAmount, goldVeinAmount } from './balance';
import { metreTier, tierAt } from './bands';
import { hash2, mulberry32 } from './rng';
import type { FeatureKind, GameState, MetreRoll, Stats } from './types';

const FEATURE_ORDER: readonly FeatureKind[] = ['goldVein', 'diamondVein', 'chest', 'gem', 'map'];

function roll(next: () => number, tier: number, stats: Stats): MetreRoll {
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

export function rollMetre(seed: number, metre: number, stats: Stats): MetreRoll {
  let state = hash2(seed, metre);
  const next = (): number => {
    const r = mulberry32(state);
    state = r.state;
    return r.value;
  };
  return roll(next, metreTier(metre), stats);
}

export function rollGallery(state: GameState, depth: number, stats: Stats): MetreRoll {
  const next = (): number => {
    const r = mulberry32(state.rng);
    state.rng = r.state;
    return r.value;
  };
  return roll(next, tierAt(depth), stats);
}

export function fillAhead(state: GameState, stats: Stats): void {
  for (let m = state.deepest + 1; m <= state.deepest + stats.lampSight; m++) {
    if (state.ahead[m] === undefined) state.ahead[m] = rollMetre(state.seed, m, stats);
  }
}
