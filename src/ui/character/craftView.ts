import { itemAt } from '../../core/cells';
import { canCraft, canTargetedCraft, craftCost, held, heldOrbKind, mapUpgradeSouls, spendsDiamonds } from '../../core/crafting';
import { MATERIAL_LABELS, STAT_NAMES } from '../../core/itemData';
import { MOD_SIDE, ORBS, isGear, isMap } from '../../core/items';
import type { MapItem, Material } from '../../core/items';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TargetedCraft, TemperOutcome } from '../../core/types';
import { formatNumber } from '../format';

/** `souls`: what the craft also spends from the Souls, 0 for gear. */
export interface CraftOption { kind: CraftKind; label: string; cost: number; souls: number; have: number; enabled: boolean }

// Starsteel, Obsidian and Copper are retired from crafting (they are orb currency, or its role moved to a Diamond
// upgrade): they are never offered, on gear or maps. The two rarity upgrades lead, then the material crafts, then Diamonds.
const CRAFT_KINDS: readonly CraftKind[] = ['makeMagic', 'makeRare', 'tin', 'silver', 'mithril', 'voidCrystal', 'diamond'];

/**
 * Checks that refuse a craft for what the item is; the others (short of material or Souls, Gems tab full) list it
 * disabled.
 */
const RULE_REFUSALS: ReadonlySet<CraftCheck> = new Set<CraftCheck>(
  ['notGear', 'legendary', 'sealed', 'wrongRarity', 'noRoom', 'nothingToChange', 'notForMaps'],
);

const CRAFT_EFFECTS: Readonly<Partial<Record<CraftKind, string>>> = {
  makeMagic: 'make it magic', makeRare: 'make it rare', tin: 'reroll its modifiers', silver: 'reroll its modifiers',
  mithril: 'reroll its sockets', voidCrystal: 'temper it (risky)', diamond: 'add a modifier',
};

// A map's only material-adjacent crafts are its two Soul upgrades; the rest is orb work.
const MAP_CRAFT_EFFECTS: Readonly<Partial<Record<CraftKind, string>>> = {
  makeMagic: 'make it magic', makeRare: 'make it rare',
};

export type CraftTarget = 'gear' | 'map';

/** Whether a craft at `target` is on a map, whose copy talks of enchanting, or on gear. */
export function craftTargetAt(state: GameState, target: ItemLoc): CraftTarget {
  const item = itemAt(state, target);
  return item !== undefined && isMap(item) ? 'map' : 'gear';
}

export function craftLabel(kind: CraftKind, cost: number, souls: number, target: CraftTarget): string {
  if (target === 'gear') {
    const name = spendsDiamonds(kind) ? 'Diamonds' : MATERIAL_LABELS[kind as Material];
    const effect = CRAFT_EFFECTS[kind];
    if (effect === undefined) throw new Error(`${kind} does nothing to gear`);
    return `${name} ×${formatNumber(cost)}: ${effect}`;
  }
  const effect = MAP_CRAFT_EFFECTS[kind];
  if (effect === undefined) throw new Error(`${kind} does nothing to a map`);
  return `${formatNumber(souls)} Souls: ${effect}`;
}

/**
 * The crafts this gear's or map's rules allow, upgrades first, then the material crafts, then Diamonds; ones the player
 * can't do now are disabled. A map's two upgrades spend Souls alone.
 */
export function craftOptions(state: GameState, target: ItemLoc): CraftOption[] {
  const item = itemAt(state, target);
  if (item === undefined || !(isGear(item) || isMap(item))) return [];
  const map = isMap(item);
  return CRAFT_KINDS.flatMap((kind) => {
    const check = canCraft(state, target, kind);
    if (RULE_REFUSALS.has(check)) return [];
    if (map) {
      const souls = mapUpgradeSouls(item, kind === 'makeMagic' ? 'magic' : 'rare');
      return [{ kind, label: craftLabel(kind, 0, souls, 'map'), cost: 0, souls, have: state.souls, enabled: check === 'ok' }];
    }
    const cost = craftCost(kind, item.ilvl);
    return [{ kind, label: craftLabel(kind, cost, 0, 'gear'), cost, souls: 0, have: held(state, kind), enabled: check === 'ok' }];
  });
}

const TEMPER_TEXT: Readonly<Record<TemperOutcome, string>> = {
  craftedLine: 'Tempered: it gained a crafted line.',
  raiseTiers: 'Tempered: every line rose a tier.',
  nothing: 'Tempered: nothing changed.',
  ruin: 'Tempered: it was ruined, every line fell to tier 1.',
};

/** The status line after a craft: what a temper did, or why a craft was refused; null for a plain success. */
export function craftResultText(result: Pick<CraftResult, 'check' | 'temper'>, target: CraftTarget): string | null {
  const map = target === 'map';
  switch (result.check) {
    case 'ok':
      if (result.temper === undefined) return null;
      return TEMPER_TEXT[result.temper];
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
    case 'socketFull': return 'It already has the most sockets.';
    case 'noSockets': return 'It has no sockets to clear.';
    case 'noRunes': return 'It has no runes to destroy.';
  }
}

/** One targeted craft in the card's list: its slot key, label, whether it can be done, and the action it runs. */
export interface TargetedOption { key: string; label: string; enabled: boolean; targeted: TargetedCraft }

/** The stable slot key of a targeted craft, so the card keeps its button under the pointer. */
export function targetedKey(t: TargetedCraft): string {
  switch (t.kind) {
    case 'addPrefix': return `addPrefix:${t.tier}`;
    case 'addSuffix': return `addSuffix:${t.tier}`;
    case 'removePrefix': return 'removePrefix';
    case 'removeSuffix': return 'removeSuffix';
    case 'scatter': return 'scatter';
    case 'socketing': return 'socketing';
    case 'clearSockets': return 'clearSockets';
  }
}

/**
 * The targeted crafts an item's card offers: for each orb kind the player holds, the add (a craft orb), remove (a
 * removal orb), scatter (a scattering orb), socket (a socketing orb) or clear (a clearing orb) it does. On a map, craft,
 * removal and scattering orbs add, remove or reroll a modifier; socketing and clearing stay gear-only. Each is greyed
 * out when it has no room or no budget.
 */
export function targetedCraftOptions(state: GameState, target: ItemLoc): TargetedOption[] {
  const item = itemAt(state, target);
  if (item === undefined) return [];
  if (isMap(item)) return mapTargetedOptions(state, target, item);
  if (!isGear(item)) return [];
  if (item.sealed === true) return [];
  const out: TargetedOption[] = [];
  const labelled = (targeted: TargetedCraft, label: string): void => {
    out.push({ targeted, key: targetedKey(targeted), label, enabled: canTargetedCraft(state, target, targeted) === 'ok' });
  };
  // Add/remove/scatter change modifiers, so they need magic or rare gear; socketing and clearing work on any rarity.
  const modsUsable = item.rarity !== 'normal' && item.rarity !== 'legendary';
  for (const orb of ORBS) {
    if (heldOrbKind(state, orb.family, orb.side, orb.tier) < 1) continue;
    if (orb.family === 'socketing') {
      labelled({ kind: 'socketing' }, `Add a socket (${orb.name})`);
      continue;
    }
    if (orb.family === 'clearSockets') {
      labelled({ kind: 'clearSockets' }, `Destroy the runes (${orb.name})`);
      continue;
    }
    if (!modsUsable) continue;
    if (orb.family === 'scattering') {
      labelled({ kind: 'scatter' }, `Reroll every value (${orb.name})`);
      continue;
    }
    const side = orb.side;
    if (side === undefined) continue;
    if (orb.family === 'craft') {
      labelled(
        side === 'prefix' ? { kind: 'addPrefix', tier: orb.tier ?? 'normal' } : { kind: 'addSuffix', tier: orb.tier ?? 'normal' },
        `Add a random ${side} (${orb.name})`,
      );
    } else {
      labelled(
        side === 'prefix' ? { kind: 'removePrefix' } : { kind: 'removeSuffix' },
        `Remove a random ${side} (${orb.name})`,
      );
    }
  }
  return out;
}

/** The orb options a map offers: craft orbs add, removal orbs remove, scattering orbs reroll; no sockets. */
function mapTargetedOptions(state: GameState, target: ItemLoc, map: MapItem): TargetedOption[] {
  if (map.sealed === true) return [];
  const out: TargetedOption[] = [];
  const labelled = (targeted: TargetedCraft, label: string): void => {
    out.push({ targeted, key: targetedKey(targeted), label, enabled: canTargetedCraft(state, target, targeted) === 'ok' });
  };
  for (const orb of ORBS) {
    if (heldOrbKind(state, orb.family, orb.side, orb.tier) < 1) continue;
    if (orb.family === 'socketing' || orb.family === 'clearSockets') continue;
    if (orb.family === 'scattering') {
      labelled({ kind: 'scatter' }, `Reroll every modifier (${orb.name})`);
      continue;
    }
    const side = orb.side;
    if (side === undefined) continue;
    if (orb.family === 'craft') {
      labelled(
        side === 'prefix' ? { kind: 'addPrefix', tier: orb.tier ?? 'normal' } : { kind: 'addSuffix', tier: orb.tier ?? 'normal' },
        `Add a random modifier (${orb.name})`,
      );
    } else {
      labelled(
        side === 'prefix' ? { kind: 'removePrefix' } : { kind: 'removeSuffix' },
        `Remove a random modifier (${orb.name})`,
      );
    }
  }
  return out;
}
