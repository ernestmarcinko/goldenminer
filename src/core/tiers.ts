import { STAT_TIERS } from './balance';
import type { StatKey } from './items';

/** The values a stat can roll at a tier; each tier starts where the one below it ends. */
export function tierRange(stat: StatKey, tier: number): { lo: number; hi: number } {
  const { base, step } = STAT_TIERS[stat];
  const lo = Math.max(1, Math.round(base + step * (tier - 1)));
  const hi = Math.max(lo, Math.round(base + step * tier) - 1);
  return { lo, hi };
}

/** The lowest tier whose range reaches `value`. */
export function tierFor(stat: StatKey, value: number): number {
  let tier = 1;
  while (tierRange(stat, tier).hi < value) tier++;
  return tier;
}

/** The highest tier an item of this level can roll. */
export function tierCap(ilvl: number): number {
  return Math.max(1, ilvl);
}

/** Lower tiers are likelier: tier t weighs `cap - t + 1`. */
export function tierWeights(cap: number): [number, number][] {
  return Array.from({ length: cap }, (_, i) => [i + 1, cap - i] as [number, number]);
}
