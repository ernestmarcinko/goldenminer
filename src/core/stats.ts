import {
  BASE_AUTO_TICKS_PER_SECOND, BASE_DIG_POWER, BASE_FEATURE_CHANCES, BASE_HARD_ROCK_CHANCE,
  BASE_LAMP_SIGHT, BASE_OFFLINE_CAP_MS, BASE_TICKS_PER_CLICK, FEATURE_CHANCE_TOTAL_CAP, MAX_LAMP_SIGHT, MAX_HAZARD_WARD,
  GEM_GRADE_LEVEL, MAX_AUTO_TICKS_PER_SECOND, MIN_AUTO_TICKS_PER_SECOND, MAX_DIG_POWER, MAX_OFFLINE_CAP_MS, MAX_TICKS_PER_CLICK, MIN_OFFLINE_CAP_MS,
  MAX_ORE_BONUS_CHANCE, ORE_BONUS_BASE, BLACK_LANTERN_SIGHT, BLACK_LANTERN_SLOW, LONG_VOYAGE_CAP,
  TICKS_PER_METRE_AT_PARITY, hardness, monsterDamageBase,
} from './balance';
import { BATTLE_STATS, LOCAL_STATS, MINING_STATS, setOfSlot } from './items';
import type { Gem, GearItem, GearSet, StatKey, StatLine } from './items';
import { achievementBoost } from './achievements';
import { GEM_EFFECTS } from './itemData';
import { tierRange } from './tiers';
import { ascendancyTotals } from './ascendancy';
import { passiveTotals } from './passives';
import { metreTier } from './bands';
import { armorReduction, deriveBattleStats } from './battle';
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

/** An item's contributions split into its local stats (LOCAL_STATS[slot]) and the global rest. */
export interface LocalTotals {
  local: Partial<Record<StatKey, number>>;
  global: Partial<Record<StatKey, number>>;
}

export function localTotals(item: GearItem): LocalTotals {
  const local: Partial<Record<StatKey, number>> = {};
  const global: Partial<Record<StatKey, number>> = {};
  const localStats = LOCAL_STATS[item.slot];
  for (const [stat, value] of Object.entries(itemTotals(item)) as [StatKey, number][]) {
    if (localStats !== undefined && localStats.includes(stat)) local[stat] = value;
    else global[stat] = value;
  }
  return { local, global };
}

/** A weapon's flat damage after its own damage% (local): weaponFlat × pct(weaponDamagePct). */
export function weaponDamage(item: GearItem): number {
  const local = localTotals(item).local;
  return (local.damage ?? 0) * pct(local.damagePct ?? 0);
}

/**
 * The global gear sum for `set`: every stat over every item, *except* the local ones, which `deriveStats`/`deriveBattleStats`
 * apply to their own slot first. Passives and ascendancy stats are layered on top by the callers.
 */
export function gearTotals(state: GameState, set: GearSet): Record<StatKey, number> {
  const totals = {} as Record<StatKey, number>;
  for (const stat of [...MINING_STATS, ...BATTLE_STATS]) totals[stat] = 0;
  for (const item of Object.values(state.equipped[set])) {
    if (!item) continue;
    const localStats = LOCAL_STATS[item.slot];
    for (const [stat, value] of Object.entries(itemTotals(item)) as [StatKey, number][]) {
      if (localStats !== undefined && localStats.includes(stat)) continue;
      totals[stat] += value;
    }
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
  // The pickaxe's dig power and dig power% are local: they raise the base (plus the pickaxe's own flat) first, then the
  // global flat and global % apply on top.
  const pickaxe = state.equipped.mining.pickaxe;
  const pickLocal = pickaxe === undefined ? undefined : localTotals(pickaxe).local;
  const digPower = clamp(
    ((BASE_DIG_POWER + (pickLocal?.digPower ?? 0)) * pct(pickLocal?.digPowerPct ?? 0) + g.digPower) * pct(g.digPowerPct),
    1, MAX_DIG_POWER,
  );
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

/** How a sheet row's value is rendered: a plain count, a one-decimal rate, a percent, an ×multiplier, … */
export type SheetFormat =
  | 'number' | 'rate' | 'percent' | 'multiplier' | 'perSecond' | 'mPerMin' | 'durationMs' | 'range';

/** One row of the character sheet: a label and a value (and, for a range, its high end). */
export interface SheetRow {
  label: string;
  value: number;
  /** The high end of a 'range' row (damage min–max). */
  value2?: number;
  format: SheetFormat;
}

/** The character sheet: the mining half, then the battle half, every row read from deriveStats/deriveBattleStats. */
export interface CharacterSheet {
  mining: SheetRow[];
  battle: SheetRow[];
}

/**
 * The character sheet's display rows, all read from the same derived values the game runs. DPS is the damage range's
 * mean, times attacks per second, times the crit factor (the crit chance's average damage gain).
 */
export function deriveCharacterSheet(state: GameState): CharacterSheet {
  const mining = deriveStats(state);
  const battle = deriveBattleStats(state);
  // Dig speed at parity, exactly as the Mine view's own summary computes it (no hazard or hard rock on the face).
  const digSpeed = (mining.autoTicksPerSecond * 60 * mining.digPower) / (hardness(state.deepest + 1) * TICKS_PER_METRE_AT_PARITY);
  // Armor reduction against the hit a monster at the face deals, the same formula the combat code uses.
  const reduction = armorReduction(battle.armor, monsterDamageBase(metreTier(state.deepest + 1)));
  const dps = (battle.damageMin + battle.damageMax) / 2 * battle.attacksPerSecond
    * (1 + battle.critChance * (battle.critMultiplier - 1));
  const fc = mining.featureChances;
  return {
    mining: [
      { label: 'Dig power', value: mining.digPower, format: 'number' },
      { label: 'Dig speed', value: digSpeed, format: 'mPerMin' },
      { label: 'Ticks per click', value: mining.ticksPerClick, format: 'number' },
      { label: 'Auto ticks', value: mining.autoTicksPerSecond, format: 'perSecond' },
      { label: 'Offline cap', value: mining.offlineCapMs, format: 'durationMs' },
      { label: 'Hazard ward', value: mining.hazardWard, format: 'percent' },
      { label: 'Gold yield', value: mining.goldMultiplier, format: 'multiplier' },
      { label: 'Diamond yield', value: mining.diamondMultiplier, format: 'multiplier' },
      { label: 'Vein yield', value: mining.veinMultiplier, format: 'multiplier' },
      { label: 'Chest find', value: fc.chest * 100, format: 'percent' },
      { label: 'Gem find', value: fc.gem * 100, format: 'percent' },
      { label: 'Map find', value: fc.map * 100, format: 'percent' },
      { label: 'Ore bonus', value: mining.oreBonusChance * 100, format: 'percent' },
      { label: 'Sell', value: mining.sellMultiplier, format: 'multiplier' },
      { label: 'Salvage', value: mining.salvageMultiplier, format: 'multiplier' },
      { label: 'Achievement boost', value: (achievementBoost(state) - 1) * 100, format: 'percent' },
    ],
    battle: [
      { label: 'Damage', value: battle.damageMin, value2: battle.damageMax, format: 'range' },
      { label: 'DPS', value: dps, format: 'rate' },
      { label: 'Attack speed', value: battle.attacksPerSecond, format: 'perSecond' },
      { label: 'Crit chance', value: battle.critChance * 100, format: 'percent' },
      { label: 'Crit multiplier', value: battle.critMultiplier, format: 'multiplier' },
      { label: 'Elemental damage', value: battle.elementalDamage, format: 'number' },
      { label: 'Life', value: battle.maxLife, format: 'number' },
      { label: 'Armor', value: battle.armor, format: 'number' },
      { label: 'Armor reduction', value: reduction * 100, format: 'percent' },
      { label: 'Resistances', value: battle.resistAll, format: 'percent' },
      { label: 'Life regen', value: battle.lifeRegen, format: 'perSecond' },
      { label: 'Life on kill', value: battle.lifeOnKill, format: 'number' },
      { label: 'XP find', value: battle.xpMultiplier, format: 'multiplier' },
      { label: 'Magic find', value: battle.magicFindMultiplier, format: 'multiplier' },
      { label: 'Soul find', value: battle.soulMultiplier, format: 'multiplier' },
    ],
  };
}
