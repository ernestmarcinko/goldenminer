import { BAG_SIZE } from '../../core/balance';
import { itemAt, sameLoc } from '../../core/cells';
import { BATTLE_SLOTS, GEM_GRADES, GEM_TYPES, MATERIALS, MINING_SLOTS } from '../../core/items';
import type { DropTarget, GameState, ItemLoc } from '../../core/types';
import { clickIntent } from './itemView';
import type { ClickIntent } from './itemView';

/** A mouse or pen press turns into a drag once it has moved this far. */
export const DRAG_THRESHOLD_PX = 5;

const SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS] as const;
const DROP_TABS = ['general', 'gems', 'maps', 'materials', 'auto'] as const;

/** The `data-drop` value of a drop target. */
export function dropAttr(t: DropTarget): string {
  return JSON.stringify(t);
}

const oneOf = <T>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);
// The stash tabs grow by pages, so their indexes are only checked against the tab when the drop is made.
const cellIndex = (v: unknown, size = Infinity): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < size;

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
      return cellIndex(o.index) ? { where: 'maps', index: o.index } : null;
    case 'gems':
      return oneOf(GEM_TYPES, o.gem) && oneOf(GEM_GRADES, o.grade) ? { where: 'gems', gem: o.gem, grade: o.grade } : null;
    case 'materials':
      return oneOf(MATERIALS, o.material) ? { where: 'materials', material: o.material } : null;
    case 'worn':
      return oneOf(SLOTS, o.slot) ? { where: 'worn', slot: o.slot } : null;
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
export interface Hold { loc: ItemLoc; id: number }

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
  | { kind: 'tap' }                            // a touch tap with an item held: place it here, or put it back
  | { kind: 'pick'; intent: ClickIntent };     // a mouse, pen or keyboard click: today's shortcuts

/** How a click on an item is handled. A keyboard click (detail 0) never lifts or places anything. */
export function clickRoute(
  e: { altKey: boolean; shiftKey: boolean; detail: number; pointerType: string },
  holding: boolean,
): ClickRoute {
  if (e.pointerType === 'touch' && e.detail !== 0) return holding ? { kind: 'tap' } : { kind: 'lift' };
  return { kind: 'pick', intent: clickIntent(e) };
}
