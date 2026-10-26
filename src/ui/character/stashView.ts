import { BAG_SIZE, MAP_TIER_CAP, stashPagePrice, STASH_PAGE_SIZE } from '../../core/balance';
import { filledCount, mapStashCount, mapTierCount, mapTiers as stashTiers, pageCount } from '../../core/cells';
import { GEM_GRADES, GEM_TYPES, MATERIALS, RUNE_TYPES, orbName, parseOrbKey } from '../../core/items';
import type { GemGrade, GemType, MapItem, Material, RuneType } from '../../core/items';
import { GEM_GRADE_LABELS, GEM_LABELS, MATERIAL_LABELS } from '../../core/itemData';
import { RUNE_LABELS } from '../../core/runes';
import type { GameState, ItemLoc } from '../../core/types';
import { formatCompact, formatNumber } from '../format';

export const STASH_TABS = ['general', 'gems', 'runes', 'maps', 'materials', 'orbs'] as const;
export type StashTab = (typeof STASH_TABS)[number];

export const GRADE_HEADERS: readonly string[] = GEM_GRADES.map((g) => GEM_GRADE_LABELS[g]);

export function tabLabel(state: GameState, tab: StashTab): string {
  switch (tab) {
    case 'general': return `General ${formatNumber(filledCount(state.stash.general))} / ${formatNumber(state.stash.general.length)}`;
    case 'gems': return 'Gems';
    case 'runes': return 'Runes';
    case 'maps': return `Maps ${formatNumber(mapStashCount(state))}`;
    case 'materials': return 'Materials';
    case 'orbs': return 'Orbs';
  }
}

/** The bag's heading: how full it is, then how many finds are held for want of room, when any are. */
export function bagHeading(state: GameState): { filled: string; held: string | null } {
  const held = state.overflow.length;
  return {
    filled: `${formatNumber(filledCount(state.bag))} / ${formatNumber(BAG_SIZE)}`,
    held: held > 0 ? `· ${formatNumber(held)} held` : null,
  };
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

/** A grid shows its items in whole rows of ten, and never fewer than one row. */
export function gridCapacity(count: number): number {
  return Math.max(10, Math.ceil(count / 10) * 10);
}

/** The Maps tab's tier chips: one per tier it holds, lowest first. */
export function mapTiers(state: GameState): { tier: number; count: number; label: string }[] {
  return stashTiers(state).map((tier) => {
    const count = mapTierCount(state, tier);
    return { tier, count, label: `T${formatNumber(tier)} · ${formatNumber(count)}` };
  });
}

const RARITY_ORDER: Readonly<Record<MapItem['rarity'], number>> = { rare: 0, magic: 1, normal: 2 };

/** One tier's maps as the grid shows them, rare first, then magic, then normal, each newest first; the list keeps its order. */
export function mapTierCells(state: GameState, tier: number): { item: MapItem; loc: ItemLoc }[] {
  const list = state.stash.maps[tier] ?? [];
  return list
    .map((item, index): { item: MapItem; loc: ItemLoc } => ({ item, loc: { where: 'maps', tier, index } }))
    .sort((a, b) => RARITY_ORDER[a.item.rarity] - RARITY_ORDER[b.item.rarity] || b.item.id - a.item.id);
}

export function mapTierCaption(tier: number, count: number): string {
  return `Tier ${formatNumber(tier)} maps · ${formatNumber(count)} / ${formatNumber(MAP_TIER_CAP)}`;
}

/** The tier to show: the one asked for while it holds maps, else the highest, else none. */
export function pickTier(tiers: readonly number[], wanted: number | null): number | null {
  if (wanted !== null && tiers.includes(wanted)) return wanted;
  return tiers.length === 0 ? null : Math.max(...tiers);
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

export interface RuneCell { rune: RuneType; label: string; count: number; text: string }

/** One cell per rune kind, in catalogue order; `text` is the short count, empty when there is none. */
export function runeTabCells(state: GameState): RuneCell[] {
  return RUNE_TYPES.map((rune) => {
    const count = state.stash.runes[rune];
    return { rune, label: RUNE_LABELS[rune], count, text: count > 0 ? formatCompact(count) : '' };
  });
}

export interface OrbCell { key: string; label: string; count: number; text: string }

/** The Orbs tab's held stacks, keyed by orbKey(family, side?, tier), sorted by key. */
export function orbTabCells(state: GameState): OrbCell[] {
  return Object.entries(state.stash.orbs)
    .filter(([, n]) => n > 0)
    .map(([key, count]) => {
      const parsed = parseOrbKey(key);
      const label = parsed === undefined ? key : orbName({ id: 0, type: 'orb', family: parsed.family, side: parsed.side, tier: parsed.tier, count: 0 });
      return { key, label, count, text: formatCompact(count) };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
