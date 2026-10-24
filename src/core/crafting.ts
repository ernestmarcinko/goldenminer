import {
  CRAFT_COST, DEFAULT_STAT_WEIGHT, GEM_STASH_STACK, MAGIC_LINE_WEIGHTS, MAX_CRAFTED_LINES, MAX_SIDE_LINES, MAX_TIER_OVER_CAP,
  RARE_LINE_WEIGHTS, STAT_WEIGHTS, TEMPER_WEIGHTS,
} from './balance';
import { itemAt, sameLoc } from './cells';
import { baseName } from './itemData';
import { magicName, rareName, rollLines, rollSockets, rollValue, sideCount } from './itemGen';
import { MOD_SIDE, SLOT_IMPLICIT, isGear, setOfSlot, statsOf } from './items';
import type { GearItem, Gem, Material, ModLine } from './items';
import { fillAhead } from './metres';
import { nextRandom, pickWeighted } from './rng';
import { deriveStats } from './stats';
import { tierCap } from './tiers';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TemperOutcome } from './types';

export type { CraftCheck, CraftKind, CraftResult, TemperOutcome };

type MaterialLoc = Extract<ItemLoc, { where: 'bag' | 'materials' }>;

export function craftCost(kind: CraftKind, item: GearItem): number {
  const { base, per } = CRAFT_COST[kind];
  return per === 0 ? base : base + Math.floor(item.ilvl / per);
}

const rolled = (item: GearItem): ModLine[] => item.affixes.filter((l) => l.crafted !== true);
const craftedOf = (item: GearItem): ModLine[] => item.affixes.filter((l) => l.crafted === true);
const sideRoom = (item: GearItem): number => (item.rarity === 'magic' ? 1 : MAX_SIDE_LINES);

/** Whether `rollLines` could add a line: some stat the item lacks on a side with room, as its pool picks them. */
function hasRoom(item: GearItem, perSide: number): boolean {
  const implicit = SLOT_IMPLICIT[item.slot];
  return statsOf(setOfSlot(item.slot)).some(
    (s) => s !== implicit && !item.affixes.some((l) => l.stat === s) && sideCount(item.affixes, MOD_SIDE[s]) < perSide,
  );
}

/** Where a material is paid from, in order: the given stack, the other bag stacks, then the Materials tab. */
function payOrder(state: GameState, material: Material, from?: ItemLoc): MaterialLoc[] {
  const bag: MaterialLoc[] = state.bag.flatMap((c, index) =>
    c?.type === 'material' && c.material === material ? [{ where: 'bag' as const, index }] : []);
  const all: MaterialLoc[] = [...bag, { where: 'materials', material }];
  const first = from === undefined ? undefined : all.find((l) => sameLoc(l, from));
  return first === undefined ? all : [first, ...all.filter((l) => l !== first)];
}

/** How much of a craft's material the player holds: every bag stack and the Materials tab, or the Diamonds. */
export function held(state: GameState, kind: CraftKind): number {
  if (kind === 'diamond') return state.diamonds;
  let n = state.stash.materials[kind];
  for (const c of state.bag) if (c?.type === 'material' && c.material === kind) n += c.count;
  return n;
}

function pay(state: GameState, kind: CraftKind, cost: number, from?: ItemLoc): void {
  if (kind === 'diamond') {
    state.diamonds -= cost;
    return;
  }
  let left = cost;
  for (const loc of payOrder(state, kind, from)) {
    if (left === 0) return;
    if (loc.where === 'materials') {
      const n = Math.min(left, state.stash.materials[kind]);
      state.stash.materials[kind] -= n;
      left -= n;
      continue;
    }
    const cell = state.bag[loc.index];
    if (cell?.type !== 'material') continue;
    const n = Math.min(left, cell.count);
    cell.count -= n;
    left -= n;
    if (cell.count === 0) state.bag[loc.index] = null;
  }
}

/** The rules alone, in order: sealed, legendary, then the material's own. */
function ruleCheck(state: GameState, item: GearItem, kind: CraftKind): CraftCheck {
  if (item.sealed === true) return 'sealed';
  if (item.rarity === 'legendary' && kind !== 'mithril') return 'legendary';
  switch (kind) {
    case 'copper': return item.rarity === 'normal' ? 'ok' : 'wrongRarity';
    case 'tin': return item.rarity === 'magic' ? 'ok' : 'wrongRarity';
    case 'iron':
      if (item.rarity === 'normal') return 'wrongRarity';
      // A full magic item turns rare, so it always has room.
      return item.rarity === 'magic' || hasRoom(item, MAX_SIDE_LINES) ? 'ok' : 'noRoom';
    case 'silver': return item.rarity === 'rare' ? 'ok' : 'wrongRarity';
    case 'mithril': {
      // Every socketed gem goes back to its Gems-tab count, so none may pass the cap.
      const back = (g: Gem): number => item.gems.filter((o) => o.gem === g.gem && o.grade === g.grade).length;
      return item.gems.some((g) => state.stash.gems[g.gem][g.grade] + back(g) > GEM_STASH_STACK) ? 'gemsFull' : 'ok';
    }
    case 'starsteel': return rolled(item).length > 0 ? 'ok' : 'nothingToChange';
    case 'obsidian': return item.affixes.length > 0 ? 'ok' : 'nothingToChange';
    case 'voidCrystal': return item.rarity === 'magic' || item.rarity === 'rare' ? 'ok' : 'wrongRarity';
    case 'diamond':
      if (item.rarity !== 'rare') return 'wrongRarity';
      return hasRoom(item, MAX_SIDE_LINES) ? 'ok' : 'noRoom';
  }
}

/** Whether a craft would go through: the rules first, then whether the player holds enough to pay. */
export function canCraft(state: GameState, target: ItemLoc, kind: CraftKind): CraftCheck {
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return 'notGear';
  const rule = ruleCheck(state, item, kind);
  if (rule !== 'ok') return rule;
  return held(state, kind) >= craftCost(kind, item) ? 'ok' : 'short';
}

/** New lines in place of the rolled ones; crafted lines were earned by tempering, so they stay. */
function reroll(state: GameState, item: GearItem, count: number, perSide: number): void {
  const crafted = craftedOf(item);
  item.affixes = [...rollLines(state, item.slot, item.ilvl, count, crafted, perSide), ...crafted];
}

function addLine(state: GameState, item: GearItem, perSide: number): void {
  item.affixes.push(...rollLines(state, item.slot, item.ilvl, 1, item.affixes, perSide));
}

function rerollIn(state: GameState, l: ModLine, tier: number): void {
  l.tier = tier;
  l.value = rollValue(state, l.stat, tier);
}

function temper(state: GameState, item: GearItem): TemperOutcome {
  let outcome = pickWeighted(state, TEMPER_WEIGHTS);
  if (outcome === 'craftedLine' && craftedOf(item).length >= MAX_CRAFTED_LINES) outcome = 'nothing';
  switch (outcome) {
    case 'craftedLine': {
      const implicit = SLOT_IMPLICIT[item.slot];
      const pool = statsOf(setOfSlot(item.slot)).filter((s) => s !== implicit && !item.affixes.some((l) => l.stat === s));
      const stat = pickWeighted(state, pool.map((s) => [s, STAT_WEIGHTS[s] ?? DEFAULT_STAT_WEIGHT] as const));
      const tier = tierCap(item.ilvl) + 1;
      item.affixes.push({ stat, value: rollValue(state, stat, tier), tier, crafted: true });
      break;
    }
    case 'raiseTiers':
      for (const l of rolled(item)) rerollIn(state, l, Math.min(l.tier + 1, item.ilvl + MAX_TIER_OVER_CAP));
      break;
    case 'ruin':
      for (const l of item.affixes) rerollIn(state, l, 1);
      break;
    case 'nothing':
      break;
  }
  item.sealed = true;
  return outcome;
}

/** The craft's effect on an item that passed its rules; returns the temper outcome for Void crystal. */
function apply(state: GameState, item: GearItem, kind: CraftKind): TemperOutcome | undefined {
  switch (kind) {
    case 'copper':
    case 'tin':
      item.rarity = 'magic';
      reroll(state, item, pickWeighted(state, MAGIC_LINE_WEIGHTS), 1);
      item.name = magicName(item.slot, item.ilvl, item.affixes);
      return undefined;
    case 'iron':
      if (item.rarity === 'magic' && rolled(item).length >= 2) {
        item.rarity = 'rare';
        addLine(state, item, MAX_SIDE_LINES);
        item.name = rareName(state, item.slot);
      } else {
        addLine(state, item, sideRoom(item));
        if (item.rarity === 'magic') item.name = magicName(item.slot, item.ilvl, item.affixes);
      }
      return undefined;
    case 'silver':
      reroll(state, item, pickWeighted(state, RARE_LINE_WEIGHTS), MAX_SIDE_LINES);
      return undefined;
    case 'mithril':
      for (const g of item.gems) state.stash.gems[g.gem][g.grade]++;
      item.gems = [];
      item.sockets = rollSockets(state);
      return undefined;
    case 'starsteel':
      for (const l of rolled(item)) rerollIn(state, l, l.tier);
      return undefined;
    case 'obsidian':
      item.affixes.splice(Math.floor(nextRandom(state) * item.affixes.length), 1);
      // A magic item is named by its lines, so the name follows them; a rare's name is its own. A magic item left with
      // no lines is a normal one again, under its base name, so Copper works on it.
      if (item.rarity === 'magic' && item.affixes.length === 0) {
        item.rarity = 'normal';
        item.name = baseName(item.slot, item.ilvl);
      } else if (item.rarity === 'magic') {
        item.name = magicName(item.slot, item.ilvl, item.affixes);
      }
      return undefined;
    case 'voidCrystal':
      return temper(state, item);
    case 'diamond':
      addLine(state, item, MAX_SIDE_LINES);
      return undefined;
  }
}

/**
 * Crafts on the gear at `target`. Only an 'ok' pays: from `from` first (a bag stack or the tab slot of the material),
 * then the other bag stacks, then the Materials tab; Diamonds from `state.diamonds`. A refusal changes nothing.
 */
export function craft(state: GameState, target: ItemLoc, kind: CraftKind, from?: ItemLoc): CraftResult {
  const check = canCraft(state, target, kind);
  if (check !== 'ok') return { check };
  const item = itemAt(state, target) as GearItem;
  // The cost is known beforehand, and paying last means a craft that failed part-way could never spend material.
  const cost = craftCost(kind, item);
  const outcome = apply(state, item, kind);
  pay(state, kind, cost, from);
  // Worn mining gear may change lamp sight, as equipping does.
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return outcome === undefined ? { check } : { check, temper: outcome };
}
