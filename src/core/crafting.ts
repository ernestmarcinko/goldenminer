import {
  CRAFT_COST, DEFAULT_STAT_WEIGHT, GEM_STASH_STACK, MAGIC_LINE_WEIGHTS, MAP_CRAFT_SOULS_PER_TIER, MAP_SPECIAL_CHANCE, MAX_CRAFTED_LINES,
  MAX_MAP_MODS, MAX_SIDE_LINES, MAX_TIER_OVER_CAP, RARE_LINE_WEIGHTS, STAT_WEIGHTS, TEMPER_WEIGHTS,
} from './balance';
import { itemAt, sameLoc } from './cells';
import { trail } from './dropLog';
import { baseName } from './itemData';
import { magicName, rareName, rollLines, rollSockets, rollValue, sideCount } from './itemGen';
import { MAP_MOD_KINDS, MAP_SPECIALS, MOD_SIDE, SLOT_IMPLICIT, isGear, isMap, setOfSlot, statsOf } from './items';
import type { GearItem, Gem, MapItem, MapMod, MapModKind, MapSpecial, Material, ModLine } from './items';
import { mapModRange } from './mapMods';
import { fillAhead } from './metres';
import { nextRandom, pickWeighted } from './rng';
import { deriveStats } from './stats';
import { tierCap, tierWeights } from './tiers';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TemperOutcome } from './types';

export type { CraftCheck, CraftKind, CraftResult, TemperOutcome };

type MaterialLoc = Extract<ItemLoc, { where: 'bag' | 'materials' }>;

/** A craft's material cost at a level: gear's ilvl, or a map's tier. */
export function craftCost(kind: CraftKind, level: number): number {
  const { base, per } = CRAFT_COST[kind];
  return per === 0 ? base : base + Math.floor(level / per);
}

/** The Souls enchanting a map spends, on top of its material. */
export function mapCraftSouls(map: MapItem): number {
  return MAP_CRAFT_SOULS_PER_TIER * map.tier;
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

/** A map's rules alone, in order: sealed, a material that does nothing to maps, then the material's own. */
function mapRuleCheck(map: MapItem, kind: CraftKind): CraftCheck {
  if (map.sealed === true) return 'sealed';
  switch (kind) {
    case 'tin':
    case 'mithril':
    case 'starsteel':
    case 'diamond':
      return 'notForMaps';
    case 'copper': return map.rarity === 'normal' ? 'ok' : 'wrongRarity';
    case 'iron':
      if (map.rarity === 'normal') return 'wrongRarity';
      // A magic map holds 2 at most and turns rare on the third, so it always has room.
      return map.rarity === 'magic' || map.mods.length < MAX_MAP_MODS ? 'ok' : 'noRoom';
    case 'silver': return map.rarity === 'rare' ? 'ok' : 'wrongRarity';
    case 'obsidian': return map.mods.length > 0 ? 'ok' : 'nothingToChange';
    case 'voidCrystal': return map.rarity === 'magic' || map.rarity === 'rare' ? 'ok' : 'wrongRarity';
  }
}

/** Whether a craft would go through: the rules first, then whether the player holds enough to pay, then the Souls. */
export function canCraft(state: GameState, target: ItemLoc, kind: CraftKind): CraftCheck {
  const item = itemAt(state, target);
  if (item !== undefined && isMap(item)) {
    const rule = mapRuleCheck(item, kind);
    if (rule !== 'ok') return rule;
    if (held(state, kind) < craftCost(kind, item.tier)) return 'short';
    return state.souls >= mapCraftSouls(item) ? 'ok' : 'noSouls';
  }
  if (item === undefined || !isGear(item)) return 'notGear';
  const rule = ruleCheck(state, item, kind);
  if (rule !== 'ok') return rule;
  return held(state, kind) >= craftCost(kind, item.ilvl) ? 'ok' : 'short';
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

const pickIndex = (state: GameState, length: number): number => Math.floor(nextRandom(state) * length);
const missingKinds = (map: MapItem): MapModKind[] => MAP_MOD_KINDS.filter((k) => !map.mods.some((m) => m.kind === k));

function rollMapValue(state: GameState, kind: MapModKind, tier: number): number {
  const { lo, hi } = mapModRange(kind, tier);
  return lo + pickIndex(state, hi - lo + 1);
}

function rerollMapMod(state: GameState, m: MapMod, tier: number): void {
  m.tier = tier;
  m.value = rollMapValue(state, m.kind, tier);
}

/** Rolls `count` new modifiers of kinds the map lacks, and returns only the new ones; lower tiers are likelier. */
export function rollMapMods(state: GameState, map: MapItem, count: number): MapMod[] {
  const pool = missingKinds(map);
  if (count > pool.length) throw new Error('rollMapMods has no room for another modifier');
  const added: MapMod[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pool.splice(pickIndex(state, pool.length), 1)[0] as MapModKind;
    const tier = pickWeighted(state, tierWeights(map.tier));
    added.push({ kind, tier, value: rollMapValue(state, kind, tier) });
  }
  return added;
}

/** Adds one modifier; a magic map's third makes it rare, as Iron does for gear. */
function addMapMod(map: MapItem, m: MapMod): void {
  if (map.rarity === 'magic' && map.mods.length >= 2) map.rarity = 'rare';
  map.mods.push(m);
}

/**
 * A chance at a special modifier, for a map with none: one draw for the chance and, on success, one for which. A map
 * holds one at most, and nothing ever takes it away.
 */
export function rollSpecial(state: GameState, map: MapItem): void {
  if (map.special !== undefined) return;
  if (nextRandom(state) >= MAP_SPECIAL_CHANCE) return;
  map.special = MAP_SPECIALS[pickIndex(state, MAP_SPECIALS.length)] as MapSpecial;
}

function temperMap(state: GameState, map: MapItem): TemperOutcome {
  let outcome = pickWeighted(state, TEMPER_WEIGHTS);
  const missing = missingKinds(map);
  if (outcome === 'craftedLine' && missing.length === 0) outcome = 'nothing';
  switch (outcome) {
    case 'craftedLine': {
      const kind = missing[pickIndex(state, missing.length)] as MapModKind;
      const tier = map.tier + 1;
      addMapMod(map, { kind, tier, value: rollMapValue(state, kind, tier) });
      break;
    }
    case 'raiseTiers':
      for (const m of map.mods) rerollMapMod(state, m, Math.min(m.tier + 1, map.tier + MAX_TIER_OVER_CAP));
      break;
    case 'ruin':
      for (const m of map.mods) rerollMapMod(state, m, 1);
      break;
    case 'nothing':
      break;
  }
  rollSpecial(state, map);
  map.sealed = true;
  return outcome;
}

/** The enchant's effect on a map that passed its rules; returns the temper outcome for Void crystal. */
function applyToMap(state: GameState, map: MapItem, kind: CraftKind): TemperOutcome | undefined {
  switch (kind) {
    case 'copper':
      map.rarity = 'magic';
      map.mods = rollMapMods(state, map, pickWeighted(state, MAGIC_LINE_WEIGHTS));
      rollSpecial(state, map);
      return undefined;
    case 'iron':
      for (const m of rollMapMods(state, map, 1)) addMapMod(map, m);
      rollSpecial(state, map);
      return undefined;
    case 'silver':
      map.mods = rollMapMods(state, { ...map, mods: [] }, pickWeighted(state, RARE_LINE_WEIGHTS));
      rollSpecial(state, map);
      return undefined;
    case 'obsidian':
      map.mods.splice(pickIndex(state, map.mods.length), 1);
      // A magic map with no modifiers is a normal one again, so Copper works on it; a rare stays rare, as gear does.
      if (map.rarity === 'magic' && map.mods.length === 0) map.rarity = 'normal';
      return undefined;
    case 'voidCrystal':
      return temperMap(state, map);
    case 'tin':
    case 'mithril':
    case 'starsteel':
    case 'diamond':
      throw new Error(`${kind} does nothing to a map`);
  }
}

/**
 * Crafts on the gear or map at `target`. Only an 'ok' pays: from `from` first (a bag stack or the tab slot of the
 * material), then the other bag stacks, then the Materials tab; Diamonds from `state.diamonds`. A map also spends Souls,
 * paid with the material. A refusal changes nothing.
 */
export function craft(state: GameState, target: ItemLoc, kind: CraftKind, from?: ItemLoc): CraftResult {
  const check = canCraft(state, target, kind);
  if (check !== 'ok') return { check };
  const found = itemAt(state, target);
  if (found !== undefined && isMap(found)) {
    const cost = craftCost(kind, found.tier);
    const souls = mapCraftSouls(found);
    const outcome = applyToMap(state, found, kind);
    pay(state, kind, cost, from);
    state.souls -= souls;
    trail(state, found.id, { event: 'crafted' });
    return outcome === undefined ? { check } : { check, temper: outcome };
  }
  const item = found as GearItem;
  // The cost is known beforehand, and paying last means a craft that failed part-way could never spend material.
  const cost = craftCost(kind, item.ilvl);
  const outcome = apply(state, item, kind);
  pay(state, kind, cost, from);
  trail(state, item.id, { event: 'crafted' });
  // Worn mining gear may change lamp sight, as equipping does.
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return outcome === undefined ? { check } : { check, temper: outcome };
}
