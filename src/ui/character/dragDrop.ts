import { BAG_SIZE, MAX_ITEM_LEVEL, STOCK_SIZE } from '../../core/balance';
import { itemAt, sameLoc } from '../../core/cells';
import { BATTLE_SLOTS, GEM_GRADES, GEM_TYPES, MATERIALS, MINING_SLOTS, parseEssenceKey } from '../../core/items';
import type { DropTarget, GameState, ItemLoc } from '../../core/types';
import { clickIntent } from './itemView';
import type { ClickIntent, ClickKeys } from './itemView';

/** A mouse or pen press turns into a drag once it has moved this far. */
export const DRAG_THRESHOLD_PX = 5;

const SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS] as const;
const DROP_TABS = ['general', 'gems', 'maps', 'materials', 'essences', 'auto'] as const;

/** The `data-drop` value of a drop target. */
export function dropAttr(t: DropTarget): string {
  return JSON.stringify(t);
}

const oneOf = <T>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);
// The stash tabs grow by pages, so their indexes are only checked against the tab when the drop is made.
const cellIndex = (v: unknown, size = Infinity): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < size;
const mapTier = (v: unknown): v is number => cellIndex(v, MAX_ITEM_LEVEL + 1) && v >= 1;

/** Reads a `data-drop` value back; anything that is not exactly a valid drop target gives null. */
export function parseDrop(attr: string | null): DropTarget | null {
  if (attr === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(attr);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  switch (o.where) {
    case 'bag':
      return cellIndex(o.index, BAG_SIZE) ? { where: 'bag', index: o.index } : null;
    case 'stash':
      return cellIndex(o.index) ? { where: 'stash', index: o.index } : null;
    case 'maps':
      return mapTier(o.tier) && cellIndex(o.index) ? { where: 'maps', tier: o.tier, index: o.index } : null;
    case 'gems':
      return oneOf(GEM_TYPES, o.gem) && oneOf(GEM_GRADES, o.grade) ? { where: 'gems', gem: o.gem, grade: o.grade } : null;
    case 'materials':
      return oneOf(MATERIALS, o.material) ? { where: 'materials', material: o.material } : null;
    case 'essences':
      return typeof o.key === 'string' && parseEssenceKey(o.key) !== undefined ? { where: 'essences', key: o.key } : null;
    case 'worn':
      return oneOf(SLOTS, o.slot) ? { where: 'worn', slot: o.slot } : null;
    case 'stock':
      return cellIndex(o.index, STOCK_SIZE) ? { where: 'stock', index: o.index } : null;
    case 'stashTab':
      return oneOf(DROP_TABS, o.tab) ? { where: 'stashTab', tab: o.tab } : null;
    default:
      return null;
  }
}

export type TapAction = { kind: 'hold' } | { kind: 'release' } | { kind: 'drop'; to: DropTarget } | { kind: 'none' };

/** What a touch tap does: lift an item, put the held one back, or place the held one on the tapped target. */
export function tapAction(held: ItemLoc | null, tapped: DropTarget, tappedIsItem: boolean): TapAction {
  if (held === null) return tappedIsItem ? { kind: 'hold' } : { kind: 'none' };
  if (tapped.where !== 'stashTab' && sameLoc(held, tapped)) return { kind: 'release' };
  return { kind: 'drop', to: tapped };
}

/** A lifted item: where it is, and which item it was, so a hold whose item has gone can be dropped. */
export interface Hold {
  loc: ItemLoc;
  id: number;
  /** A mouse/pen click-hold shows a cursor ghost, so its cell only dims; a touch hold stays lifted in its cell. */
  ghost?: true;
}

/**
 * Where the held item is, or null when nothing is held or the item at that place is no longer the one lifted (sold,
 * moved or replaced meanwhile). A Gems-tab stack has id 0: its identity is its slot.
 */
export function heldLoc(state: GameState, hold: Hold | null): ItemLoc | null {
  if (hold === null) return null;
  return itemAt(state, hold.loc)?.id === hold.id ? hold.loc : null;
}

export type ClickRoute =
  | { kind: 'lift' }                           // a touch tap with nothing held: lift the item and open its card
  | { kind: 'hold' }                           // a mouse/pen click with nothing held: pick the item up
  | { kind: 'tap' }                            // a tap or click with an item held: place it here, or put it back
  | { kind: 'pick'; intent: ClickIntent };     // a mouse, pen or keyboard click: its card, or a shortcut

/**
 * How a click on an item is handled; `mac` picks the key that sells. A keyboard click (detail 0) opens the card and
 * never lifts or places anything. A plain touch tap lifts, while a plain mouse/pen click picks the item up; either
 * places the held item on the next target. Ctrl/Cmd, Alt and Shift keep their sell, salvage and move shortcuts.
 */
export function clickRoute(e: ClickKeys, holding: boolean, mac: boolean): ClickRoute {
  if (e.detail === 0) return { kind: 'pick', intent: clickIntent(e, mac) };
  if (e.pointerType === 'touch') return holding ? { kind: 'tap' } : { kind: 'lift' };
  if (clickIntent(e, mac) !== 'card') return { kind: 'pick', intent: clickIntent(e, mac) };
  return holding ? { kind: 'tap' } : { kind: 'hold' };
}
