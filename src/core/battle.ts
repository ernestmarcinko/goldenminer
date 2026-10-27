import {
  BASE_ATTACKS_PER_SECOND, BASE_CRIT_CHANCE, BASE_LIFE, CRIT_MULTIPLIER, LIFE_PER_LEVEL,
  MAX_ARMOR_REDUCTION, MAX_ATTACKS_PER_SECOND, MAX_CRIT_CHANCE, MAX_DAMAGE, MAX_LIFE, MAX_RESIST,
  MAX_RESIST_HARD_CAP, MIN_ATTACKS_PER_SECOND, MIN_RESIST, armorFactor, baseDamage, baseResist,
} from './balance';
import { gearTotals, localTotals } from './stats';
import { passiveTotals } from './passives';
import { achievementBoost } from './achievements';
import { runeTotals } from './runes';
import type { StatKey } from './items';
import type { Element, GameState } from './types';

export interface BattleStats {
  maxLife: number; damageMin: number; damageMax: number; attacksPerSecond: number;
  critChance: number; critMultiplier: number; armor: number; resistAll: number;
  maxResist: number; baseResist: number;
  soulMultiplier: number; magicFindMultiplier: number;
  elementalDamage: number;                 // added to every hit after the physical roll; Armored doesn't soften it
  lifeRegen: number; lifeOnKill: number;   // life per second in maps, and life on each kill
  xpMultiplier: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => Math.max(0, 1 + n / 100);

export function deriveBattleStats(state: GameState): BattleStats {
  const g = gearTotals(state, 'battle');
  const p = passiveTotals(state);
  const runes = runeTotals(state);
  for (const [stat, value] of Object.entries(p.stats) as [StatKey, number][]) g[stat] += value;
  const base = baseDamage(state.level);
  const ks = p.keystones;
  // A weapon's damage and damage% are local: they raise the weapon's own flat first, then the global pool adds the rest.
  const weapon = state.equipped.battle.weapon;
  const weaponLocal = weapon === undefined ? undefined : localTotals(weapon).local;
  const weaponDamage = (weaponLocal?.damage ?? 0) * pct(weaponLocal?.damagePct ?? 0);
  let damageMin = clamp(Math.round((base.min + weaponDamage + g.damage) * pct(g.damagePct)), 1, MAX_DAMAGE);
  let damageMax = Math.max(damageMin, clamp(Math.round((base.max + weaponDamage + g.damage) * pct(g.damagePct)), 1, MAX_DAMAGE));
  let maxLife = clamp(Math.round((BASE_LIFE + LIFE_PER_LEVEL * state.level + g.life) * pct(g.lifePct)), 1, MAX_LIFE);
  // An armor's armor and armor% are local: they raise the armor's own flat first, then the global pool adds the rest.
  const armorItem = state.equipped.battle.armor;
  const armorLocal = armorItem === undefined ? undefined : localTotals(armorItem).local;
  let armor = clamp(Math.round(((armorLocal?.armor ?? 0) * pct(armorLocal?.armorPct ?? 0) + g.armor) * pct(g.armorPct)), 0, MAX_DAMAGE);
  let soulMultiplier = pct(g.soulFind);
  // Keystone trade-offs: Berserker hits half again as hard but keeps no armor; Bulwark doubles armor at a quarter off
  // damage; Two-Way Street hits a little harder for a little life; Soul Reaper doubles Souls for a fifth less life.
  if (ks.has('berserker')) {
    damageMin = clamp(Math.round(damageMin * 1.5), 1, MAX_DAMAGE);
    damageMax = clamp(Math.round(damageMax * 1.5), 1, MAX_DAMAGE);
    armor = 0;
  }
  if (ks.has('bulwark')) {
    armor = clamp(Math.round(armor * 2), 0, MAX_DAMAGE);
    damageMin = clamp(Math.round(damageMin * 0.75), 1, MAX_DAMAGE);
    damageMax = clamp(Math.round(damageMax * 0.75), 1, MAX_DAMAGE);
  }
  if (ks.has('twoWayStreet')) {
    damageMin = clamp(Math.round(damageMin * 1.15), 1, MAX_DAMAGE);
    damageMax = clamp(Math.round(damageMax * 1.15), 1, MAX_DAMAGE);
    maxLife = clamp(Math.round(maxLife * 0.9), 1, MAX_LIFE);
  }
  if (ks.has('soulReaper')) {
    soulMultiplier *= 2;
    maxLife = clamp(Math.round(maxLife * 0.8), 1, MAX_LIFE);
  }
  // The achievement boost multiplies the final offensive/defensive values, just before the clamps, never into the pool.
  const pow = achievementBoost(state);
  damageMin = clamp(Math.round(damageMin * pow), 1, MAX_DAMAGE);
  damageMax = clamp(Math.round(damageMax * pow), 1, MAX_DAMAGE);
  maxLife = clamp(Math.round(maxLife * pow), 1, MAX_LIFE);
  armor = clamp(Math.round(armor * pow), 0, MAX_DAMAGE);
  if (damageMax < damageMin) damageMax = damageMin;
  // Runes multiply the derived values, never re-entering the flat gear pool.
  const dmgMult = runes.mults.damage ?? 1;
  damageMin = clamp(Math.round(damageMin * dmgMult), 1, MAX_DAMAGE);
  damageMax = clamp(Math.round(damageMax * dmgMult), 1, MAX_DAMAGE);
  if (damageMax < damageMin) damageMax = damageMin;
  soulMultiplier *= runes.mults.souls ?? 1;
  const critMultiplier = Math.max(1,
    (ks.has('allOrNothing') ? (CRIT_MULTIPLIER + g.critMultiplier / 100) * 3 : CRIT_MULTIPLIER + g.critMultiplier / 100)
      * (runes.mults.critMultiplier ?? 1),
  );
  const xpMultiplier = pct(g.xpFind) * (runes.mults.xp ?? 1);
  // Elemental resist: base starts at 0 and falls a point a level; the effective resist is clamped to [MIN_RESIST, maxResist].
  // The cap is 75 % by default and can be raised to at most 95 % by the maxResist stat.
  const resistBase = baseResist(state.level);
  const maxResist = clamp(MAX_RESIST + clamp(g.maxResist, 0, MAX_RESIST_HARD_CAP - MAX_RESIST), 0, MAX_RESIST_HARD_CAP);
  return {
    maxLife,
    damageMin,
    damageMax,
    attacksPerSecond: clamp(BASE_ATTACKS_PER_SECOND * pct(g.attackSpeed), MIN_ATTACKS_PER_SECOND, MAX_ATTACKS_PER_SECOND),
    critChance: clamp(BASE_CRIT_CHANCE + g.critChance, 0, MAX_CRIT_CHANCE) / 100,
    critMultiplier,
    armor,
    resistAll: clamp(g.resistAll + resistBase, MIN_RESIST, maxResist),
    maxResist,
    baseResist: resistBase,
    soulMultiplier,
    magicFindMultiplier: pct(g.magicFind),
    elementalDamage: clamp(g.elementalDamage, 0, MAX_DAMAGE),
    lifeRegen: clamp(g.lifeRegen, 0, MAX_LIFE),
    lifeOnKill: clamp(g.lifeOnKill, 0, MAX_LIFE),
    xpMultiplier,
  };
}

/** The fraction of a physical hit of `raw` that armor stops — the same formula `mitigate` uses. */
export function armorReduction(armor: number, level: number, raw: number): number {
  return armor > 0 ? Math.min(MAX_ARMOR_REDUCTION, armor / (armor + armorFactor(level) * raw)) : 0;
}

/** What a monster hit of `raw` does to the miner: armor softens physical, resistance elemental; never below 1. */
export function mitigate(raw: number, element: Element, b: BattleStats, level: number): number {
  const taken = element === 'physical'
    ? raw * (1 - armorReduction(b.armor, level, raw))
    : raw * (1 - b.resistAll / 100);
  return Math.max(1, Math.round(taken));
}
