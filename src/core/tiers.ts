import { STAT_TIERS } from './balance';
import type { StatKey } from './items';

/** The values a stat can roll at a tier; each tier starts where the one below it ends. */
export function tierRange(stat: StatKey, tier: number): { lo: number; hi: number } {
  const { base, step } = STAT_TIERS[stat];
  const lo = Math.max(1, Math.round(base + step * (tier - 1)));
  const hi = Math.max(lo, Math.round(base + step * tier) - 1);
  return { lo, hi };
}

/** The lowest tier whose range reaches `value`; worked out directly, so an absurd value from a save costs nothing. */
export function tierFor(stat: StatKey, value: number): number {
  const reaches = (tier: number) => tierRange(stat, tier).hi >= value;
  if (!(value > tierRange(stat, 1).hi)) return 1;
  if (value === Infinity) return Infinity;
  // Tier t ends at round(base + step * t) - 1, or at its start when its range is one value; Math.round rounds halves up.
  const { base, step } = STAT_TIERS[stat];
  const byEnd = Math.ceil((value + 0.5 - base) / step);
  const byStart = Math.ceil((value - 0.5 - base) / step) + 1;
  let tier = Math.max(1, Math.min(byEnd, byStart));
  // Float rounding can leave the estimate a tier off; a few steps settle it, and the bound keeps huge values from stalling.
  for (let i = 0; i < 4 && tier > 1 && reaches(tier - 1); i++) tier--;
  for (let i = 0; i < 4 && !reaches(tier); i++) tier++;
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
