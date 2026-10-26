import { itemAt } from '../../core/cells';
import { canCraft, canTargetedCraft, craftCost, held, heldOrbKind, mapCraftSouls } from '../../core/crafting';
import { MATERIAL_LABELS, STAT_NAMES } from '../../core/itemData';
import { MOD_SIDE, ORBS, isGear, isMap } from '../../core/items';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TargetedCraft, TemperOutcome } from '../../core/types';
import { formatNumber } from '../format';

/** `souls`: what the craft also spends from the Souls, 0 for gear. */
export interface CraftOption { kind: CraftKind; label: string; cost: number; souls: number; have: number; enabled: boolean }

// Starsteel and Obsidian are retired from crafting (they are orb currency, Plan 27): they are never offered, on gear or maps.
const CRAFT_KINDS: readonly CraftKind[] = ['copper', 'tin', 'silver', 'mithril', 'voidCrystal', 'diamond'];

/**
 * Checks that refuse a craft for what the item is; the others (short of material or Souls, Gems tab full) list it
 * disabled.
 */
const RULE_REFUSALS: ReadonlySet<CraftCheck> = new Set<CraftCheck>(
  ['notGear', 'legendary', 'sealed', 'wrongRarity', 'noRoom', 'nothingToChange', 'notForMaps'],
);

const CRAFT_EFFECTS: Readonly<Partial<Record<CraftKind, string>>> = {
  copper: 'make it magic', tin: 'reroll its modifiers', silver: 'reroll its modifiers',
  mithril: 'reroll its sockets', voidCrystal: 'temper it (risky)', diamond: 'add a modifier',
};

// A material absent from the map list does nothing to a map, so a map never offers it.
const MAP_CRAFT_EFFECTS: Readonly<Partial<Record<CraftKind, string>>> = {
  copper: 'enchant it', silver: 'reroll its modifiers', voidCrystal: 'temper it (risky)',
};

export type CraftTarget = 'gear' | 'map';

/** Whether a craft at `target` is on a map, whose copy talks of enchanting, or on gear. */
export function craftTargetAt(state: GameState, target: ItemLoc): CraftTarget {
  const item = itemAt(state, target);
  return item !== undefined && isMap(item) ? 'map' : 'gear';
}

export function craftLabel(kind: CraftKind, cost: number, souls: number, target: CraftTarget): string {
  const name = kind === 'diamond' ? 'Diamonds' : MATERIAL_LABELS[kind];
  if (target === 'gear') {
    const effect = CRAFT_EFFECTS[kind];
    if (effect === undefined) throw new Error(`${kind} does nothing to gear`);
    return `${name} ×${formatNumber(cost)}: ${effect}`;
  }
  const effect = MAP_CRAFT_EFFECTS[kind];
  if (effect === undefined) throw new Error(`${kind} does nothing to a map`);
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
    case 'noSuchAffix': return 'That modifier is gone.';
  }
}

/** One targeted craft in the card's list: its slot key, label, whether it can be done, and the action it runs. */
export interface TargetedOption { key: string; label: string; enabled: boolean; targeted: TargetedCraft }

/** The stable slot key of a targeted craft, so the card keeps its button under the pointer. */
export function targetedKey(t: TargetedCraft): string {
  switch (t.kind) {
    case 'addPrefix': return `addPrefix:${t.tier}`;
    case 'addSuffix': return `addSuffix:${t.tier}`;
    case 'rerollPrefix': return `rerollPrefix:${t.index}:${t.tier}`;
    case 'rerollSuffix': return `rerollSuffix:${t.index}:${t.tier}`;
    case 'removePrefix': return `removePrefix:${t.tier}`;
    case 'removeSuffix': return `removeSuffix:${t.tier}`;
    case 'scatter': return `scatter:${t.tier}`;
  }
}

/**
 * The targeted crafts an item's card offers: for each orb kind the player holds, the add/reroll (a craft orb), remove
 * (a removal orb) or scatter (a scattering orb) it does. Each is greyed out when it has no room or no budget.
 */
export function targetedCraftOptions(state: GameState, target: ItemLoc): TargetedOption[] {
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return [];
  if (item.rarity === 'normal' || item.rarity === 'legendary' || item.sealed === true) return [];
  const out: TargetedOption[] = [];
  const labelled = (targeted: TargetedCraft, label: string): void => {
    out.push({ targeted, key: targetedKey(targeted), label, enabled: canTargetedCraft(state, target, targeted) === 'ok' });
  };
  for (const orb of ORBS) {
    if (heldOrbKind(state, orb.family, orb.side, orb.tier) < 1) continue;
    if (orb.family === 'scattering') {
      labelled({ kind: 'scatter', tier: orb.tier }, `Reroll every value (${orb.name})`);
      continue;
    }
    const side = orb.side;
    if (side === undefined) continue;
    if (orb.family === 'craft') {
      labelled(
        side === 'prefix' ? { kind: 'addPrefix', tier: orb.tier } : { kind: 'addSuffix', tier: orb.tier },
        `Add a ${side} (${orb.name})`,
      );
      item.affixes.forEach((l, index) => {
        if (l.crafted === true || MOD_SIDE[l.stat] !== side) return;
        labelled(
          side === 'prefix' ? { kind: 'rerollPrefix', index, tier: orb.tier } : { kind: 'rerollSuffix', index, tier: orb.tier },
          `Reroll ${STAT_NAMES[l.stat]} (${orb.name})`,
        );
      });
    } else {
      labelled(
        side === 'prefix' ? { kind: 'removePrefix', tier: orb.tier } : { kind: 'removeSuffix', tier: orb.tier },
        `Remove a random ${side} (${orb.name})`,
      );
    }
  }
  return out;
}
