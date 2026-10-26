import {
  BASE_AUTO_TICKS_PER_SECOND, BASE_DIG_POWER, BASE_FEATURE_CHANCES, BASE_HARD_ROCK_CHANCE,
  BASE_LAMP_SIGHT, BASE_OFFLINE_CAP_MS, BASE_TICKS_PER_CLICK, FEATURE_CHANCE_TOTAL_CAP, MAX_LAMP_SIGHT, MAX_HAZARD_WARD,
  GEM_GRADE_LEVEL, MAX_AUTO_TICKS_PER_SECOND, MIN_AUTO_TICKS_PER_SECOND, MAX_DIG_POWER, MAX_OFFLINE_CAP_MS, MAX_TICKS_PER_CLICK, MIN_OFFLINE_CAP_MS,
  MAX_ORE_BONUS_CHANCE, ORE_BONUS_BASE, BLACK_LANTERN_SIGHT, BLACK_LANTERN_SLOW, LONG_VOYAGE_CAP,
} from './balance';
import { BATTLE_STATS, MINING_STATS, setOfSlot } from './items';
import type { Gem, GearItem, GearSet, StatKey, StatLine } from './items';
import { GEM_EFFECTS } from './itemData';
import { tierRange } from './tiers';
import { ascendancyTotals } from './ascendancy';
import { passiveTotals } from './passives';
import type { FeatureKind, GameState, Stats } from './types';
import { hasUnique } from './uniques';

export function gemEffect(g: Gem, set: GearSet): StatLine {
  const stat = GEM_EFFECTS[g.gem][set];
  return { stat, value: tierRange(stat, GEM_GRADE_LEVEL[g.grade]).hi };
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
  const p = passiveTotals(state);
  for (const [stat, value] of Object.entries(p.stats) as [StatKey, number][]) g[stat] += value;
  for (const [stat, value] of Object.entries(ascendancyTotals(state).stats) as [StatKey, number][]) g[stat] += value;
  const ks = p.keystones;
  // Prospector's Eye doubles chest find.
  const chestFind = g.chestFind * (ks.has('prospectorsEye') ? 2 : 1);
  const featureChances: Record<FeatureKind, number> = {
    ...BASE_FEATURE_CHANCES,
    chest: BASE_FEATURE_CHANCES.chest * pct(chestFind),
    gem: BASE_FEATURE_CHANCES.gem * pct(g.gemFind),
    map: BASE_FEATURE_CHANCES.map * pct(g.mapFind),
  };
  const total = Object.values(featureChances).reduce((a, b) => a + b, 0);
  if (total > FEATURE_CHANCE_TOTAL_CAP) {
    const scale = FEATURE_CHANCE_TOTAL_CAP / total;
    for (const kind of Object.keys(featureChances) as FeatureKind[]) featureChances[kind] *= scale;
  }
  const bonusChances = {
    chest: BASE_FEATURE_CHANCES.chest * Math.max(0, pct(chestFind) - 1),
    gem: BASE_FEATURE_CHANCES.gem * Math.max(0, pct(g.gemFind) - 1),
    map: BASE_FEATURE_CHANCES.map * Math.max(0, pct(g.mapFind) - 1),
  };
  const baseTotal = Object.values(BASE_FEATURE_CHANCES).reduce((a, b) => a + b, 0);
  const bonusTotal = bonusChances.chest + bonusChances.gem + bonusChances.map;
  if (baseTotal + bonusTotal > FEATURE_CHANCE_TOTAL_CAP) {
    const scale = Math.max(0, FEATURE_CHANCE_TOTAL_CAP - baseTotal) / bonusTotal;
    bonusChances.chest *= scale;
    bonusChances.gem *= scale;
    bonusChances.map *= scale;
  }
  const digPower = clamp((BASE_DIG_POWER + g.digPower) * pct(g.digPowerPct), 1, MAX_DIG_POWER);
  const autoTicksPerSecond = clamp(BASE_AUTO_TICKS_PER_SECOND * pct(g.autoTickRate), MIN_AUTO_TICKS_PER_SECOND, MAX_AUTO_TICKS_PER_SECOND);
  const ticksPerClick = clamp(BASE_TICKS_PER_CLICK + g.ticksPerClick, 1, MAX_TICKS_PER_CLICK);
  const goldMultiplier = pct(g.goldYield);
  const diamondMultiplier = pct(g.diamondYield);
  // Earthshaker digs three times as much per click but a third slower on its own; Two-Way Street digs a bit harder;
  // Deep Breath digs a quarter slower in exchange for its much longer offline cap.
  let digPowerOut = ks.has('twoWayStreet') ? clamp(digPower * 1.15, 1, MAX_DIG_POWER) : digPower;
  if (ks.has('deepBreath')) digPowerOut = clamp(digPowerOut * 0.75, 1, MAX_DIG_POWER);
  let goldMultiplierOut = ks.has('prospectorsLuck') ? goldMultiplier * 0.8 : goldMultiplier;
  if (ks.has('oreBaron')) goldMultiplierOut = goldMultiplierOut * 0.5;
  return {
    digPower: digPowerOut,
    autoTicksPerSecond: ks.has('earthshaker') ? clamp(autoTicksPerSecond * 0.7, MIN_AUTO_TICKS_PER_SECOND, MAX_AUTO_TICKS_PER_SECOND) : autoTicksPerSecond,
    ticksPerClick: ks.has('earthshaker') ? clamp(ticksPerClick * 3, 1, MAX_TICKS_PER_CLICK) : ticksPerClick,
    lampSight: clamp(BASE_LAMP_SIGHT + g.lampSight, 0, MAX_LAMP_SIGHT),
    // Long Voyage doubles the cap past its clamp; Deep Breath triples it.
    offlineCapMs: clamp(BASE_OFFLINE_CAP_MS + g.offlineCap * 60_000, MIN_OFFLINE_CAP_MS, MAX_OFFLINE_CAP_MS)
      * (hasUnique(state, 'longVoyage') ? LONG_VOYAGE_CAP : 1)
      * (ks.has('deepBreath') ? 3 : 1),
    featureChances,
    hardRockChance: BASE_HARD_ROCK_CHANCE,
    // Prospector's Luck trades Gold for Diamonds; Ore Baron trades Gold from veins for ore find.
    goldMultiplier: goldMultiplierOut,
    diamondMultiplier: ks.has('prospectorsLuck') ? diamondMultiplier * 1.5 : diamondMultiplier,
    hazardWard: clamp(g.hazardWard, 0, MAX_HAZARD_WARD),
    bonusChances,
    veinMultiplier: pct(g.veinYield),
    // Ore Baron doubles ore find, within the same cap.
    oreBonusChance: clamp(ORE_BONUS_BASE * g.oreFind / 100 * (ks.has('oreBaron') ? 2 : 1), 0, MAX_ORE_BONUS_CHANCE),
    sellMultiplier: pct(g.sellBonus),
    salvageMultiplier: pct(g.salvageYield),
    hazardSight: hasUnique(state, 'blackLantern') ? BLACK_LANTERN_SIGHT : 0,
    hazardSlow: hasUnique(state, 'blackLantern') ? BLACK_LANTERN_SLOW : 1,
  };
}
