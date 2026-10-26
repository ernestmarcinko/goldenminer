import { describe, expect, it } from 'vitest';
import { STAT_TIERS } from '../../src/core/balance';
import { MOD_WORDS, STAT_NAMES } from '../../src/core/itemData';
import { ALL_STATS, BATTLE_STATS, MINING_STATS, MOD_SIDE } from '../../src/core/items';
import { tierRange } from '../../src/core/tiers';
import { AFFIX_TIERS_SHOWN, affixRow, affixTables } from '../../src/wiki/data/affixes';

describe('the affix tables', () => {
  it('lists every stat of each set, prefixes before suffixes', () => {
    const { mining, battle } = affixTables();
    expect(mining.map((r) => r.stat).sort()).toEqual([...MINING_STATS].sort());
    expect(battle.map((r) => r.stat).sort()).toEqual([...BATTLE_STATS].sort());
    for (const rows of [mining, battle]) {
      const sides = rows.map((r) => r.side);
      const firstSuffix = sides.indexOf('suffix');
      expect(firstSuffix).toBeGreaterThan(0);
      expect(sides.slice(0, firstSuffix).every((s) => s === 'prefix')).toBe(true);
      expect(sides.slice(firstSuffix).every((s) => s === 'suffix')).toBe(true);
    }
  });

  it('matches MOD_SIDE, MOD_WORDS, STAT_NAMES and STAT_TIERS for every stat', () => {
    for (const stat of ALL_STATS) {
      const row = affixRow(stat);
      expect(row.side).toBe(MOD_SIDE[stat]);
      expect(row.word).toBe(MOD_WORDS[stat]);
      expect(row.statName).toBe(STAT_NAMES[stat]);
      expect(row.base).toBe(STAT_TIERS[stat].base);
      expect(row.step).toBe(STAT_TIERS[stat].step);
    }
  });

  it('the tier rows equal tierRange(stat, tier) exactly, for every stat and tier', () => {
    for (const stat of ALL_STATS) {
      const row = affixRow(stat);
      expect(row.tiers).toHaveLength(AFFIX_TIERS_SHOWN);
      for (let tier = 1; tier <= AFFIX_TIERS_SHOWN; tier++) {
        expect(row.tiers[tier - 1]).toEqual(tierRange(stat, tier));
      }
    }
  });
});
