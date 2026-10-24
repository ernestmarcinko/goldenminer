import {
  ARMOR_FACTOR, BASE_ATTACKS_PER_SECOND, BASE_CRIT_CHANCE, BASE_LIFE, CRIT_MULTIPLIER, LIFE_PER_LEVEL,
  MAX_ARMOR_REDUCTION, MAX_ATTACKS_PER_SECOND, MAX_CRIT_CHANCE, MAX_DAMAGE, MAX_LIFE, MAX_RESIST,
  MIN_ATTACKS_PER_SECOND, baseDamage,
} from './balance';
import { gearTotals } from './stats';
import type { Element, GameState } from './types';

export interface BattleStats {
  maxLife: number; damageMin: number; damageMax: number; attacksPerSecond: number;
  critChance: number; critMultiplier: number; armor: number; resistAll: number;
  soulMultiplier: number; magicFindMultiplier: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => Math.max(0, 1 + n / 100);

export function deriveBattleStats(state: GameState): BattleStats {
  const g = gearTotals(state, 'battle');
  const base = baseDamage(state.level);
  const damageMin = clamp(Math.round((base.min + g.damage) * pct(g.damagePct)), 1, MAX_DAMAGE);
  return {
    maxLife: clamp(BASE_LIFE + LIFE_PER_LEVEL * state.level + g.life, 1, MAX_LIFE),
    damageMin,
    damageMax: Math.max(damageMin, clamp(Math.round((base.max + g.damage) * pct(g.damagePct)), 1, MAX_DAMAGE)),
    attacksPerSecond: clamp(BASE_ATTACKS_PER_SECOND * pct(g.attackSpeed), MIN_ATTACKS_PER_SECOND, MAX_ATTACKS_PER_SECOND),
    critChance: clamp(BASE_CRIT_CHANCE + g.critChance, 0, MAX_CRIT_CHANCE) / 100,
    critMultiplier: CRIT_MULTIPLIER,
    armor: clamp(g.armor, 0, MAX_DAMAGE),
    resistAll: clamp(g.resistAll, 0, MAX_RESIST),
    soulMultiplier: pct(g.soulFind),
    magicFindMultiplier: pct(g.magicFind),
  };
}

/** What a monster hit of `raw` does to the miner: armor softens physical, resistance elemental; never below 1. */
export function mitigate(raw: number, element: Element, b: BattleStats): number {
  const taken = element === 'physical'
    ? raw * (1 - (b.armor > 0 ? Math.min(MAX_ARMOR_REDUCTION, b.armor / (b.armor + ARMOR_FACTOR * raw)) : 0))
    : raw * (1 - b.resistAll / 100);
  return Math.max(1, Math.round(taken));
}
