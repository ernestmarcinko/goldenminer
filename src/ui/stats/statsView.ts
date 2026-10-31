import { earnedCount } from '../../core/achievements';
import { GEM_GRADE_LABELS, GEM_LABELS, MATERIAL_LABELS } from '../../core/itemData';
import { GEM_GRADES, GEM_TYPES, MATERIALS } from '../../core/items';
import type { GameState } from '../../core/types';
import { formatDuration, formatNumber } from '../format';

/** One counter as the tab lists it: its label and its already-formatted value. */
export interface StatRow { label: string; value: string }

/** A catalogue category: its id, label and rows in display order. */
export interface StatGroup { id: string; label: string; rows: StatRow[] }

/**
 * The Stats tab's view model: every lifetime counter grouped into the catalogue's categories. Scalars go through
 * `formatNumber`, the five time fields through `formatDuration`, and ascensions/achievements are read from `lifetime`
 * and `achievements.earned.length` (Plan 20) rather than stored again. Read-only: it never mutates state.
 */
export function statsVMs(state: GameState): StatGroup[] {
  const s = state.stats;
  const num = formatNumber;
  const time = formatDuration;
  return [
    {
      id: 'distance', label: 'Distance & time',
      rows: [
        { label: 'Metres dug', value: num(s.metresDug) },
        { label: 'Clicks', value: num(s.clicks) },
        { label: 'Metres dug by hand', value: num(s.metresDugByClick) },
        { label: 'Metres dug automatically', value: num(s.metresDugAuto) },
        { label: 'Time played', value: time(s.timePlayedMs) },
        { label: 'Time away', value: time(s.timeAwayMs) },
        { label: 'Time mining', value: time(s.timeDiggingMs) },
        { label: 'Time in combat', value: time(s.timeCombatMs) },
        { label: 'Time idle', value: time(s.timeIdleMs) },
      ],
    },
    {
      id: 'currency', label: 'Currency',
      rows: [
        { label: 'Gold found', value: num(s.goldFound) },
        { label: 'Gold from sales', value: num(s.goldFromSales) },
        { label: 'Gold spent', value: num(s.goldSpent) },
        { label: 'Diamonds found', value: num(s.diamondsFound) },
        { label: 'Diamonds spent', value: num(s.diamondsSpent) },
        { label: 'Souls earned', value: num(s.soulsEarned) },
        { label: 'Souls spent', value: num(s.soulsSpent) },
      ],
    },
    {
      id: 'finds', label: 'Finds',
      rows: [
        ...MATERIALS.map((m) => ({ label: `${MATERIAL_LABELS[m]} found`, value: num(s.oresFound[m]) })),
        ...MATERIALS.map((m) => ({ label: `${MATERIAL_LABELS[m]} traded`, value: num(s.oresTraded[m]) })),
        ...GEM_TYPES.flatMap((t) =>
          GEM_GRADES.map((g) => ({ label: `${GEM_GRADE_LABELS[g]} ${GEM_LABELS[t]}`, value: num(s.gemsFound[t][g]) }))),
        { label: 'Gems found', value: num(s.gems) },
        { label: 'Chests opened', value: num(s.chestsOpened) },
        { label: 'Maps found', value: num(s.mapsFound) },
        { label: 'Maps from clears', value: num(s.mapsFromClears) },
      ],
    },
    {
      id: 'combat', label: 'Combat & runs',
      rows: [
        { label: 'Monsters killed', value: num(s.monstersKilled) },
        { label: 'Champions killed', value: num(s.championKills) },
        { label: 'Bosses killed', value: num(s.bossKills) },
        { label: 'Deaths', value: num(s.deaths) },
        { label: 'Maps cleared', value: num(s.mapsCleared) },
        { label: 'Maps lost', value: num(s.mapsLost) },
      ],
    },
    {
      id: 'progression', label: 'Progression & items',
      rows: [
        { label: 'Levels gained', value: num(s.levelsGained) },
        { label: 'Items crafted', value: num(s.itemsCrafted) },
        { label: 'Items kept', value: num(s.itemsKept) },
        { label: 'Items sold', value: num(s.itemsSold) },
        { label: 'Items salvaged', value: num(s.itemsSalvaged) },
        { label: 'Items bought', value: num(s.itemsBought) },
        { label: 'Gems socketed', value: num(s.gemsSocketed) },
        { label: 'Legendaries owned', value: num(s.legendaries) },
        { label: 'Ascensions', value: num(state.lifetime.ascensions) },
        { label: 'Achievements earned', value: num(earnedCount(state)) },
      ],
    },
  ];
}
