import {
  BASE_AUTO_TICKS_PER_SECOND, BASE_DIG_POWER, BASE_FEATURE_CHANCES, BASE_HARD_ROCK_CHANCE,
  BASE_LAMP_SIGHT, BASE_OFFLINE_CAP_MS, BASE_TICKS_PER_CLICK, FEATURE_CHANCE_TOTAL_CAP, MAX_LAMP_SIGHT,
  MAX_AUTO_TICKS_PER_SECOND, MIN_AUTO_TICKS_PER_SECOND, MAX_DIG_POWER, MAX_OFFLINE_CAP_MS, MAX_TICKS_PER_CLICK, MIN_OFFLINE_CAP_MS,
  statRange,
} from './balance';
import { BATTLE_STATS, MINING_STATS, setOfSlot } from './items';
import type { GearItem, GearSet, GemItem, StatKey, StatLine } from './items';
import { GEM_EFFECTS } from './itemData';
import type { FeatureKind, GameState, Stats } from './types';

export function gemEffect(gem: GemItem, set: GearSet): StatLine {
  const stat = GEM_EFFECTS[gem.gem][set];
  return { stat, value: statRange(stat, gem.ilvl).max };
}

export function itemTotals(item: GearItem): Partial<Record<StatKey, number>> {
  const totals: Partial<Record<StatKey, number>> = {};
  const add = (line: StatLine) => { totals[line.stat] = (totals[line.stat] ?? 0) + line.value; };
  add(item.implicit);
  for (const affix of item.affixes) add(affix);
  const set = setOfSlot(item.slot);
  for (const g of item.gems) add(gemEffect(g, set));
  return totals;
}

export function gearTotals(state: GameState, set: GearSet): Record<StatKey, number> {
  const totals = {} as Record<StatKey, number>;
  for (const stat of [...MINING_STATS, ...BATTLE_STATS]) totals[stat] = 0;
  for (const item of Object.values(state.equipped[set])) {
    if (!item) continue;
    for (const [stat, value] of Object.entries(itemTotals(item)) as [StatKey, number][]) totals[stat] += value;
  }
  return totals;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => Math.max(0, 1 + n / 100);

export function deriveStats(state: GameState): Stats {
  const g = gearTotals(state, 'mining');
  const featureChances: Record<FeatureKind, number> = {
    ...BASE_FEATURE_CHANCES,
    chest: BASE_FEATURE_CHANCES.chest * pct(g.chestFind),
    gem: BASE_FEATURE_CHANCES.gem * pct(g.gemFind),
    map: BASE_FEATURE_CHANCES.map * pct(g.mapFind),
  };
  const total = Object.values(featureChances).reduce((a, b) => a + b, 0);
  if (total > FEATURE_CHANCE_TOTAL_CAP) {
    const scale = FEATURE_CHANCE_TOTAL_CAP / total;
    for (const kind of Object.keys(featureChances) as FeatureKind[]) featureChances[kind] *= scale;
  }
  return {
    digPower: clamp(BASE_DIG_POWER + g.digPower, 1, MAX_DIG_POWER),
    autoTicksPerSecond: Math.min(MAX_AUTO_TICKS_PER_SECOND, Math.max(MIN_AUTO_TICKS_PER_SECOND, BASE_AUTO_TICKS_PER_SECOND * pct(g.autoTickRate))),
    ticksPerClick: clamp(BASE_TICKS_PER_CLICK + g.ticksPerClick, 1, MAX_TICKS_PER_CLICK),
    lampSight: clamp(BASE_LAMP_SIGHT + g.lampSight, 0, MAX_LAMP_SIGHT),
    offlineCapMs: clamp(BASE_OFFLINE_CAP_MS + g.offlineCap * 60_000, MIN_OFFLINE_CAP_MS, MAX_OFFLINE_CAP_MS),
    featureChances,
    hardRockChance: BASE_HARD_ROCK_CHANCE,
    goldMultiplier: pct(g.goldYield),
    diamondMultiplier: pct(g.diamondYield),
  };
}
