import { itemAt } from '../../core/cells';
import { canCraft, craftCost, held, mapCraftSouls } from '../../core/crafting';
import { MATERIAL_LABELS } from '../../core/itemData';
import { isGear, isMap, MATERIALS } from '../../core/items';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TemperOutcome } from '../../core/types';
import { formatNumber } from '../format';

/** `souls`: what the craft also spends from the Souls, 0 for gear. */
export interface CraftOption { kind: CraftKind; label: string; cost: number; souls: number; have: number; enabled: boolean }

const CRAFT_KINDS: readonly CraftKind[] = [...MATERIALS, 'diamond'];

/**
 * Checks that refuse a craft for what the item is; the others (short of material or Souls, Gems tab full) list it
 * disabled.
 */
const RULE_REFUSALS: ReadonlySet<CraftCheck> = new Set<CraftCheck>(
  ['notGear', 'legendary', 'sealed', 'wrongRarity', 'noRoom', 'nothingToChange', 'notForMaps'],
);

const CRAFT_EFFECTS: Readonly<Record<CraftKind, string>> = {
  copper: 'make it magic', tin: 'reroll its modifiers', iron: 'add a modifier', silver: 'reroll its modifiers',
  mithril: 'reroll its sockets', starsteel: 'reroll its values', obsidian: 'remove a modifier',
  voidCrystal: 'temper it (risky)', diamond: 'add a modifier',
};

// null: every map refuses that material, so a map never offers it.
const MAP_CRAFT_EFFECTS: Readonly<Record<CraftKind, string | null>> = {
  copper: 'enchant it', tin: null, iron: 'add a modifier', silver: 'reroll its modifiers', mithril: null, starsteel: null,
  obsidian: 'remove a modifier', voidCrystal: 'temper it (risky)', diamond: null,
};

export type CraftTarget = 'gear' | 'map';

/** Whether a craft at `target` is on a map, whose copy talks of enchanting, or on gear. */
export function craftTargetAt(state: GameState, target: ItemLoc): CraftTarget {
  const item = itemAt(state, target);
  return item !== undefined && isMap(item) ? 'map' : 'gear';
}

export function craftLabel(kind: CraftKind, cost: number, souls: number, target: CraftTarget): string {
  const name = kind === 'diamond' ? 'Diamonds' : MATERIAL_LABELS[kind];
  if (target === 'gear') return `${name} ×${formatNumber(cost)}: ${CRAFT_EFFECTS[kind]}`;
  const effect = MAP_CRAFT_EFFECTS[kind];
  if (effect === null) throw new Error(`${kind} does nothing to a map`);
  return `${name} ×${formatNumber(cost)} + ${formatNumber(souls)} Souls: ${effect}`;
}

/**
 * The crafts this gear's or map's rules allow, in material order then Diamonds; ones the player can't do now are
 * disabled.
 */
export function craftOptions(state: GameState, target: ItemLoc): CraftOption[] {
  const item = itemAt(state, target);
  if (item === undefined || !(isGear(item) || isMap(item))) return [];
  const map = isMap(item);
  const souls = map ? mapCraftSouls(item) : 0;
  return CRAFT_KINDS.flatMap((kind) => {
    const check = canCraft(state, target, kind);
    if (RULE_REFUSALS.has(check)) return [];
    const cost = craftCost(kind, map ? item.tier : item.ilvl);
    const label = craftLabel(kind, cost, souls, map ? 'map' : 'gear');
    return [{ kind, label, cost, souls, have: held(state, kind), enabled: check === 'ok' }];
  });
}

const TEMPER_TEXT: Readonly<Record<TemperOutcome, string>> = {
  craftedLine: 'Tempered: it gained a crafted line.',
  raiseTiers: 'Tempered: every line rose a tier.',
  nothing: 'Tempered: nothing changed.',
  ruin: 'Tempered: it was ruined, every line fell to tier 1.',
};

const MAP_TEMPER_TEXT: Readonly<Record<TemperOutcome, string>> = {
  craftedLine: 'Tempered: it gained a strong modifier.',
  raiseTiers: 'Tempered: every modifier rose a tier.',
  nothing: 'Tempered: nothing changed.',
  ruin: 'Tempered: it was ruined, every modifier fell to tier 1.',
};

/** The status line after a craft: what a temper did, or why a craft was refused; null for a plain success. */
export function craftResultText(result: Pick<CraftResult, 'check' | 'temper'>, target: CraftTarget): string | null {
  const map = target === 'map';
  switch (result.check) {
    case 'ok':
      if (result.temper === undefined) return null;
      return map ? MAP_TEMPER_TEXT[result.temper] : TEMPER_TEXT[result.temper];
    case 'sealed':
      return map ? "It was tempered and can't be enchanted any more." : "It was tempered and can't be crafted any more.";
    case 'legendary': return "Legendary lines can't be changed.";
    case 'wrongRarity': return "That doesn't work on this item.";
    case 'noRoom': return 'It has no room for another modifier.';
    case 'nothingToChange': return 'It has no modifiers to change.';
    case 'short': return 'Not enough of that material.';
    case 'gemsFull': return 'Make room in the Gems tab first.';
    case 'notGear': return 'Only gear and maps can be crafted.';
    case 'notForMaps': return "That material doesn't work on maps.";
    case 'noSouls': return 'Not enough Souls.';
  }
}
