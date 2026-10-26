import { STAT_TIERS } from '../../core/balance';
import { MOD_WORDS, STAT_NAMES } from '../../core/itemData';
import { BATTLE_STATS, MINING_STATS, MOD_SIDE, type StatKey } from '../../core/items';
import { tierRange } from '../../core/tiers';

/** How many tiers the tables list. Deeper items can roll higher, so this is a window, not a cap. */
export const AFFIX_TIERS_SHOWN = 10;

/** A tier's rollable range; `lo` and `hi` are both inclusive. */
export interface AffixRange {
  lo: number;
  hi: number;
}

/**
 * One row of the prefix/suffix tables: a stat, its side, its magic-name word, its base/step, and its value range for
 * every listed tier. Everything is read from the same `STAT_TIERS`, `MOD_SIDE` and `MOD_WORDS` the game rolls with.
 */
export interface AffixRow {
  stat: StatKey;
  statName: string;
  word: string;
  side: 'prefix' | 'suffix';
  base: number;
  step: number;
  tiers: readonly AffixRange[];
}

export function affixRow(stat: StatKey): AffixRow {
  const def = STAT_TIERS[stat];
  const tiers: AffixRange[] = [];
  for (let tier = 1; tier <= AFFIX_TIERS_SHOWN; tier++) tiers.push(tierRange(stat, tier));
  return {
    stat,
    statName: STAT_NAMES[stat],
    word: MOD_WORDS[stat],
    side: MOD_SIDE[stat],
    base: def.base,
    step: def.step,
    tiers,
  };
}

export function affixRows(stats: readonly StatKey[]): AffixRow[] {
  return stats.map(affixRow);
}

/** The two by-tier tables, prefixes first then suffixes, exactly the sides the game rolls on each set. */
export function affixTables(): { mining: AffixRow[]; battle: AffixRow[] } {
  const bySide = (rows: AffixRow[]): AffixRow[] => [
    ...rows.filter((r) => r.side === 'prefix'),
    ...rows.filter((r) => r.side === 'suffix'),
  ];
  return { mining: bySide(affixRows(MINING_STATS)), battle: bySide(affixRows(BATTLE_STATS)) };
}
