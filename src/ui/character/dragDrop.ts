import { BAG_SIZE, STASH_SIZE } from '../../core/balance';
import { sameLoc } from '../../core/cells';
import { BATTLE_SLOTS, GEAR_SETS, GEM_GRADES, GEM_TYPES, MINING_SLOTS } from '../../core/items';
import type { DropTarget, ItemLoc } from '../../core/types';

/** A mouse or pen press turns into a drag once it has moved this far. */
export const DRAG_THRESHOLD_PX = 5;

const SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS] as const;
const DROP_TABS = ['general', 'gems', 'auto'] as const;

/** The `data-drop` value of a drop target. */
export function dropAttr(t: DropTarget): string {
  return JSON.stringify(t);
}

const oneOf = <T>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);
const cellIndex = (v: unknown, size: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < size;

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
      return oneOf(GEAR_SETS, o.set) && cellIndex(o.index, BAG_SIZE) ? { where: 'bag', set: o.set, index: o.index } : null;
    case 'stash':
      return cellIndex(o.index, STASH_SIZE) ? { where: 'stash', index: o.index } : null;
    case 'gems':
      return oneOf(GEM_TYPES, o.gem) && oneOf(GEM_GRADES, o.grade) ? { where: 'gems', gem: o.gem, grade: o.grade } : null;
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
