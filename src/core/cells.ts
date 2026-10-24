import { BAG_SIZE, STASH_SIZE } from './balance';
import { GEM_GRADES, GEM_TYPES, setOfSlot } from './items';
import type { Cell, GemGrade, GemType, Item } from './items';
import type { GameState, ItemLoc } from './types';

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

/** The item at a location. A Gems-tab stack is a virtual gem stack (id 0) while its count is above 0. */
export function itemAt(state: GameState, loc: ItemLoc): Item | undefined {
  switch (loc.where) {
    case 'bag': return state.bags[loc.set][loc.index] ?? undefined;
    case 'stash': return state.stash.general[loc.index] ?? undefined;
    case 'worn': return state.equipped[setOfSlot(loc.slot)][loc.slot];
    case 'gems': {
      const count = state.stash.gems[loc.gem][loc.grade];
      return count > 0 ? { id: 0, type: 'gem', gem: loc.gem, grade: loc.grade, count } : undefined;
    }
  }
}

export function sameLoc(a: ItemLoc, b: ItemLoc): boolean {
  switch (a.where) {
    case 'bag': return b.where === 'bag' && a.set === b.set && a.index === b.index;
    case 'stash': return b.where === 'stash' && a.index === b.index;
    case 'gems': return b.where === 'gems' && a.gem === b.gem && a.grade === b.grade;
    case 'worn': return b.where === 'worn' && a.slot === b.slot;
  }
}
