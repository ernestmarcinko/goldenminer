import { stashPagePrice, STASH_PAGE_SIZE } from '../../core/balance';
import { filledCount, mapStashCount, pageCount } from '../../core/cells';
import { GEM_GRADES, GEM_TYPES, MATERIALS } from '../../core/items';
import type { GemGrade, GemType, Material } from '../../core/items';
import { GEM_GRADE_LABELS, GEM_LABELS, MATERIAL_LABELS } from '../../core/itemData';
import type { GameState } from '../../core/types';
import { formatCompact, formatNumber } from '../format';

export const STASH_TABS = ['general', 'gems', 'maps', 'materials'] as const;
export type StashTab = (typeof STASH_TABS)[number];

export const GRADE_HEADERS: readonly string[] = GEM_GRADES.map((g) => GEM_GRADE_LABELS[g]);

export function tabLabel(state: GameState, tab: StashTab): string {
  switch (tab) {
    case 'general': return `General ${formatNumber(filledCount(state.stash.general))} / ${formatNumber(state.stash.general.length)}`;
    case 'gems': return 'Gems';
    case 'maps': return `Maps ${formatNumber(mapStashCount(state))}`;
    case 'materials': return 'Materials';
  }
}

/** The cells of one page of the General tab, page 0 first. */
export function pageCells<T>(cells: readonly T[], page: number): T[] {
  return cells.slice(page * STASH_PAGE_SIZE, (page + 1) * STASH_PAGE_SIZE);
}

/** The General tab's buy button: the number of the page it would add, its price, and whether the Gold is there. */
export function buyLabel(state: GameState): { text: string; affordable: boolean } {
  const price = stashPagePrice(state.stash.bought.general + 1);
  return {
    text: `+ Page ${formatNumber(pageCount(state.stash.general) + 1)} · ${formatNumber(price)} Gold`,
    affordable: state.gold >= price,
  };
}

export interface GemCell { grade: GemGrade; count: number; text: string }
export interface GemRow { gem: GemType; label: string; cells: GemCell[] }

/** One row per gem type, one cell per grade; `text` is the short count, empty when there is none. */
export function gemTabRows(state: GameState): GemRow[] {
  return GEM_TYPES.map((gem) => ({
    gem,
    label: GEM_LABELS[gem],
    cells: GEM_GRADES.map((grade) => {
      const count = state.stash.gems[gem][grade];
      return { grade, count, text: count > 0 ? formatCompact(count) : '' };
    }),
  }));
}

export interface MaterialCell { material: Material; label: string; count: number; text: string }

/** One cell per material, in material order; `text` is the short count, empty when there is none. */
export function materialTabCells(state: GameState): MaterialCell[] {
  return MATERIALS.map((material) => {
    const count = state.stash.materials[material];
    return { material, label: MATERIAL_LABELS[material], count, text: count > 0 ? formatCompact(count) : '' };
  });
}
