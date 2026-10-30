import { describe, expect, it } from 'vitest';
import { BATTLE_STATS, MINING_STATS, MOD_SIDE } from '../../src/core/items';
import { tierCap, tierFor, tierRange, tierWeights } from '../../src/core/tiers';

describe('tiers', () => {
  it('tier ranges are contiguous and grow', () => {
    expect(tierRange('digPower', 1)).toEqual({ lo: 2, hi: 3 });
    expect(tierRange('digPower', 2)).toEqual({ lo: 4, hi: 5 });
    expect(tierRange('digPower', 5)).toEqual({ lo: 10, hi: 11 });
    expect(tierRange('lampSight', 1)).toEqual({ lo: 1, hi: 1 });
    expect(tierRange('lampSight', 5)).toEqual({ lo: 2, hi: 2 });
    expect(tierRange('critChance', 4)).toEqual({ lo: 3, hi: 3 });
    for (const stat of [...MINING_STATS, ...BATTLE_STATS]) for (let t = 1; t < 40; t++) {
      const a = tierRange(stat, t); const b = tierRange(stat, t + 1);
      expect(a.lo).toBeLessThanOrEqual(a.hi);
      expect(b.lo).toBeGreaterThanOrEqual(a.lo);
      expect(b.hi).toBeGreaterThanOrEqual(a.hi);
    }
  });
  it('tierFor finds the tier a value falls in', () => {
    expect([tierFor('digPower', 3), tierFor('digPower', 4), tierFor('digPower', 11), tierFor('digPower', 1)]).toEqual([1, 2, 5, 1]);
  });
  it('mining has 8 prefixes and 8 suffixes; battle has 9 of each (cleave is a prefix)', () => {
    expect(MINING_STATS.filter((s) => MOD_SIDE[s] === 'prefix')).toHaveLength(8);
    expect(MINING_STATS.filter((s) => MOD_SIDE[s] === 'suffix')).toHaveLength(8);
    expect(BATTLE_STATS.filter((s) => MOD_SIDE[s] === 'prefix')).toHaveLength(9);
    expect(BATTLE_STATS.filter((s) => MOD_SIDE[s] === 'suffix')).toHaveLength(9);
  });
  it('tier weights favour low tiers', () => {
    expect(tierWeights(3)).toEqual([[1, 3], [2, 2], [3, 1]]);
    expect(tierCap(0)).toBe(1);
    expect(tierCap(9)).toBe(9);
  });
});
