import { BAG_SIZE, STASH_SIZE } from './balance';
import { GEM_GRADES, GEM_TYPES } from './items';
import type { Cell, GemGrade, GemType } from './items';
import type { GameState } from './types';

const emptyGrid = <T>(size: number): (T | null)[] => Array.from({ length: size }, () => null);

export function emptyGemCounts(): Record<GemType, Record<GemGrade, number>> {
  const gems = {} as Record<GemType, Record<GemGrade, number>>;
  for (const type of GEM_TYPES) {
    const counts = {} as Record<GemGrade, number>;
    for (const grade of GEM_GRADES) counts[grade] = 0;
    gems[type] = counts;
  }
  return gems;
}

export function emptyInventory(): Pick<GameState, 'equipped' | 'bags' | 'stash' | 'overflow'> {
  return {
    equipped: { mining: {}, battle: {} },
    bags: { mining: emptyGrid(BAG_SIZE), battle: emptyGrid(BAG_SIZE) },
    stash: { general: emptyGrid(STASH_SIZE), gems: emptyGemCounts() },
    overflow: [],
  };
}

/** The index of the first empty cell, or -1 when the grid is full. */
export function firstEmpty(cells: readonly Cell[]): number {
  return cells.findIndex((c) => c === null);
}

export function filledCount(cells: readonly Cell[]): number {
  return cells.reduce((n, c) => n + (c === null ? 0 : 1), 0);
}
