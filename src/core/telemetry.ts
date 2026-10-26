import { GEM_GRADES, GEM_TYPES, MATERIALS } from './items';
import type { GemGrade, GemType, Material } from './items';
import type { LifetimeStats } from './types';

/** The five time buckets: milliseconds, split by whether they are wall-clock (played/away) or tick-derived. */
export type TimeKey =
  | 'timePlayedMs' | 'timeAwayMs' | 'timeDiggingMs' | 'timeCombatMs' | 'timeIdleMs';

const emptyOres = (): Record<Material, number> => {
  const ores = {} as Record<Material, number>;
  for (const m of MATERIALS) ores[m] = 0;
  return ores;
};

const emptyGems = (): Record<GemType, Record<GemGrade, number>> => {
  const gems = {} as Record<GemType, Record<GemGrade, number>>;
  for (const type of GEM_TYPES) {
    const counts = {} as Record<GemGrade, number>;
    for (const grade of GEM_GRADES) counts[grade] = 0;
    gems[type] = counts;
  }
  return gems;
};

/**
 * The empty lifetime ledger: every scalar at 0, `oresFound`/`oresTraded` keyed over `MATERIALS` and `gemsFound` over
 * `GEM_TYPES` × `GEM_GRADES`. This is the single source of the ledger's zero state, for both `newGame` and the migration.
 */
export function emptyLifetimeStats(): LifetimeStats {
  return {
    metresDug: 0,
    timePlayedMs: 0, timeAwayMs: 0, timeDiggingMs: 0, timeCombatMs: 0, timeIdleMs: 0,
    goldFound: 0, goldFromSales: 0, goldSpent: 0,
    diamondsFound: 0, diamondsSpent: 0, soulsEarned: 0, soulsSpent: 0,
    oresFound: emptyOres(), oresTraded: emptyOres(), gemsFound: emptyGems(),
    chestsOpened: 0, mapsFound: 0,
    monstersKilled: 0, championKills: 0, bossKills: 0, deaths: 0, mapsCleared: 0, mapsLost: 0,
    levelsGained: 0, itemsCrafted: 0, itemsKept: 0, itemsSold: 0, itemsSalvaged: 0,
    gems: 0, itemsBought: 0, gemsSocketed: 0, legendaries: 0,
  };
}

/** Adds `count` units of one ore to the lifetime "ores found" counter. Pure; never touches the RNG. */
export function countOre(stats: LifetimeStats, material: Material, count: number): void {
  stats.oresFound[material] += count;
}

/** Adds `count` units of one gem type and grade to the lifetime "gems found" breakdown. Pure; never touches the RNG. */
export function countGem(stats: LifetimeStats, gem: GemType, grade: GemGrade, count: number): void {
  stats.gemsFound[gem][grade] += count;
}

/** Adds milliseconds to one of the five time buckets. Thin, so time hooks stay one-liners. */
export function addTime(stats: LifetimeStats, key: TimeKey, ms: number): void {
  stats[key] += ms;
}

/** The lifetime total of gems found, summed across every type and grade. */
export function totalGemsFound(stats: LifetimeStats): number {
  let total = 0;
  for (const type of GEM_TYPES) {
    const counts = stats.gemsFound[type];
    for (const grade of GEM_GRADES) total += counts[grade];
  }
  return total;
}
