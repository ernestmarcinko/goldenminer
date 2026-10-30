import { BAG_SIZE, START_GENERAL_PAGES, STASH_PAGE_SIZE } from './balance';
import { GEM_GRADES, GEM_TYPES, MATERIALS, RUNE_TYPES, parseOrbKey, setOfSlot } from './items';
import type { Cell, GemGrade, GemType, Item, Material, RuneType } from './items';
import { stockAt } from './trader';
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

export function emptyMaterialCounts(): Record<Material, number> {
  const counts = {} as Record<Material, number>;
  for (const m of MATERIALS) counts[m] = 0;
  return counts;
}

/** The Runes tab starts empty: one zeroed count per kind. */
export function emptyRuneCounts(): Record<RuneType, number> {
  const counts = {} as Record<RuneType, number>;
  for (const r of RUNE_TYPES) counts[r] = 0;
  return counts;
}

/** The Orbs tab starts empty: keys appear as orbs are bought, and go when their count reaches 0. */
export function emptyOrbCounts(): Record<string, number> {
  return {};
}

export function emptyInventory(): Pick<GameState, 'equipped' | 'bag' | 'stash' | 'overflow'> {
  return {
    equipped: { mining: {}, battle: {} },
    bag: emptyGrid(BAG_SIZE),
    stash: {
      general: emptyGrid(START_GENERAL_PAGES * STASH_PAGE_SIZE),
      gems: emptyGemCounts(),
      runes: emptyRuneCounts(),
      maps: {},
      materials: emptyMaterialCounts(),
      orbs: emptyOrbCounts(),
      bought: { general: 0 },
    },
    overflow: [],
  };
}

/** The number of pages the General tab holds. */
export function pageCount(cells: readonly unknown[]): number {
  return cells.length / STASH_PAGE_SIZE;
}

/** The index of the first empty cell, or -1 when the grid is full. */
export function firstEmpty(cells: readonly Cell[]): number {
  return cells.findIndex((c) => c === null);
}

export function filledCount(cells: readonly Cell[]): number {
  return cells.reduce((n, c) => n + (c === null ? 0 : 1), 0);
}

/** The tiers the Map stash holds maps of, lowest first. */
export function mapTiers(state: GameState): number[] {
  return Object.keys(state.stash.maps).map(Number).sort((a, b) => a - b);
}

/** How many maps the Map stash holds in all. */
export function mapStashCount(state: GameState): number {
  return Object.values(state.stash.maps).reduce((n, list) => n + list.length, 0);
}

/** How many maps the Map stash holds of one tier. */
export function mapTierCount(state: GameState, tier: number): number {
  return state.stash.maps[tier]?.length ?? 0;
}

/**
 * The item at a location. A Gems or Materials stack is a virtual stack (id 0) while its count is above 0; a bought stock
 * slot is empty.
 */
export function itemAt(state: GameState, loc: ItemLoc): Item | undefined {
  switch (loc.where) {
    case 'bag': return state.bag[loc.index] ?? undefined;
    case 'stash': return state.stash.general[loc.index] ?? undefined;
    case 'maps': return state.stash.maps[loc.tier]?.[loc.index];
    case 'worn': return state.equipped[setOfSlot(loc.slot)][loc.slot];
    case 'queue': return state.autoMap.queue[loc.index];
    case 'stock': return stockAt(state, loc.index);
    case 'gems': {
      const count = state.stash.gems[loc.gem][loc.grade];
      return count > 0 ? { id: 0, type: 'gem', gem: loc.gem, grade: loc.grade, count } : undefined;
    }
    case 'runes': {
      const count = state.stash.runes[loc.rune];
      return count > 0 ? { id: 0, type: 'rune', rune: loc.rune, count } : undefined;
    }
    case 'materials': {
      const count = state.stash.materials[loc.material];
      return count > 0 ? { id: 0, type: 'material', material: loc.material, count } : undefined;
    }
    case 'orbs': {
      const count = state.stash.orbs[loc.key];
      const parsed = parseOrbKey(loc.key);
      if (count === undefined || count <= 0 || parsed === undefined) return undefined;
      return { id: 0, type: 'orb', family: parsed.family, side: parsed.side, tier: parsed.tier, count };
    }
  }
}

export function sameLoc(a: ItemLoc, b: ItemLoc): boolean {
  switch (a.where) {
    case 'bag': return b.where === 'bag' && a.index === b.index;
    case 'stash': return b.where === 'stash' && a.index === b.index;
    case 'maps': return b.where === 'maps' && a.tier === b.tier && a.index === b.index;
    case 'gems': return b.where === 'gems' && a.gem === b.gem && a.grade === b.grade;
    case 'runes': return b.where === 'runes' && a.rune === b.rune;
    case 'materials': return b.where === 'materials' && a.material === b.material;
    case 'orbs': return b.where === 'orbs' && a.key === b.key;
    case 'worn': return b.where === 'worn' && a.slot === b.slot;
    case 'queue': return b.where === 'queue' && a.index === b.index;
    case 'stock': return b.where === 'stock' && a.index === b.index;
  }
}
