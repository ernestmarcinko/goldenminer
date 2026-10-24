import { itemAt } from '../../core/cells';
import { canCraft, craftCost } from '../../core/crafting';
import { MATERIAL_LABELS } from '../../core/itemData';
import { isGear, MATERIALS } from '../../core/items';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TemperOutcome } from '../../core/types';
import { formatNumber } from '../format';

export interface CraftOption { kind: CraftKind; label: string; cost: number; have: number; enabled: boolean }

const CRAFT_KINDS: readonly CraftKind[] = [...MATERIALS, 'diamond'];

/** Checks that refuse a craft for what the item is; the others (short of material, Gems tab full) list it disabled. */
const RULE_REFUSALS: ReadonlySet<CraftCheck> = new Set<CraftCheck>(
  ['notGear', 'legendary', 'sealed', 'wrongRarity', 'noRoom', 'nothingToChange'],
);

const CRAFT_EFFECTS: Readonly<Record<CraftKind, string>> = {
  copper: 'make it magic', tin: 'reroll its modifiers', iron: 'add a modifier', silver: 'reroll its modifiers',
  mithril: 'reroll its sockets', starsteel: 'reroll its values', obsidian: 'remove a modifier',
  voidCrystal: 'temper it (risky)', diamond: 'add a modifier',
};

export function craftLabel(kind: CraftKind, cost: number): string {
  const name = kind === 'diamond' ? 'Diamonds' : MATERIAL_LABELS[kind];
  return `${name} ×${formatNumber(cost)}: ${CRAFT_EFFECTS[kind]}`;
}

/** How much of a craft's material the player holds: every bag stack and the Materials tab, or the Diamonds. */
function have(state: GameState, kind: CraftKind): number {
  if (kind === 'diamond') return state.diamonds;
  let n = state.stash.materials[kind];
  for (const c of state.bag) if (c?.type === 'material' && c.material === kind) n += c.count;
  return n;
}

/** The crafts this item's rules allow, in material order then Diamonds; ones the player can't do now are disabled. */
export function craftOptions(state: GameState, target: ItemLoc): CraftOption[] {
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return [];
  return CRAFT_KINDS.flatMap((kind) => {
    const check = canCraft(state, target, kind);
    if (RULE_REFUSALS.has(check)) return [];
    const cost = craftCost(kind, item);
    return [{ kind, label: craftLabel(kind, cost), cost, have: have(state, kind), enabled: check === 'ok' }];
  });
}

const TEMPER_TEXT: Readonly<Record<TemperOutcome, string>> = {
  craftedLine: 'Tempered: it gained a crafted line.',
  raiseTiers: 'Tempered: every line rose a tier.',
  nothing: 'Tempered: nothing changed.',
  ruin: 'Tempered: it was ruined, every line fell to tier 1.',
};

/** The status line after a craft: what a temper did, or why a craft was refused; null for a plain success. */
export function craftResultText(result: Pick<CraftResult, 'check' | 'temper'>): string | null {
  switch (result.check) {
    case 'ok': return result.temper === undefined ? null : TEMPER_TEXT[result.temper];
    case 'sealed': return "It was tempered and can't be crafted any more.";
    case 'legendary': return "Legendary lines can't be changed.";
    case 'wrongRarity': return "That doesn't work on this item.";
    case 'noRoom': return 'It has no room for another modifier.';
    case 'nothingToChange': return 'It has no modifiers to change.';
    case 'short': return 'Not enough of that material.';
    case 'gemsFull': return 'Make room in the Gems tab first.';
    case 'notGear': return 'Only gear can be crafted.';
  }
}
