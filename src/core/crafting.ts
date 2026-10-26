import {
  CRAFT_COST, DEFAULT_STAT_WEIGHT, GEM_STASH_STACK, MAGIC_LINE_WEIGHTS, MAP_CRAFT_SOULS_PER_TIER, MAP_SPECIAL_CHANCE, MAX_CRAFTED_LINES,
  MAX_SIDE_LINES, MAX_TIER_OVER_CAP, RARE_LINE_WEIGHTS, STAT_WEIGHTS, TEMPER_WEIGHTS,
} from './balance';
import { itemAt, sameLoc } from './cells';
import { trail } from './dropLog';
import { baseName } from './itemData';
import { magicName, rollLines, rollModLine, rollSockets, rollValue, sideCount, type Gen } from './itemGen';
import { MAP_MOD_KINDS, MAP_SPECIALS, MOD_SIDE, SLOT_IMPLICIT, essenceKey, isGear, isMap, setOfSlot, statsOf } from './items';
import type { GearItem, Gem, MapItem, MapMod, MapModKind, MapSpecial, Material, ModLine, StatKey } from './items';
import { mapModRange } from './mapMods';
import { fillAhead } from './metres';
import { nextRandom, pickWeighted } from './rng';
import { deriveStats } from './stats';
import { tierCap, tierWeights } from './tiers';
import type { CraftCheck, CraftKind, CraftResult, GameState, ItemLoc, TargetedCraft, TemperOutcome } from './types';

export type { CraftCheck, CraftKind, CraftResult, TargetedCraft, TemperOutcome };

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
    case 'iron': return 'wrongRarity';   // retired: Iron is the tier-1 essence ore, not a craft
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
    case 'iron':
    case 'mithril':
    case 'starsteel':
    case 'diamond':
      return 'notForMaps';
    case 'copper': return map.rarity === 'normal' ? 'ok' : 'wrongRarity';
    case 'silver': return map.rarity === 'rare' ? 'ok' : 'wrongRarity';
    case 'obsidian': return map.mods.length > 0 ? 'ok' : 'nothingToChange';
    case 'voidCrystal': return map.rarity === 'magic' || map.rarity === 'rare' ? 'ok' : 'wrongRarity';
  }
}

/** Whether a craft would go through: the rules first, then whether the player holds enough to pay, then the Souls. */
export function canCraft(state: GameState, target: ItemLoc, kind: CraftKind): CraftCheck {
  // the Trader's stock is for sale, not to craft on
  if (target.where === 'stock') return 'notGear';
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
      throw new Error('iron no longer crafts; ruleCheck refuses it');
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

const pickIndex = (state: Gen, length: number): number => Math.floor(nextRandom(state) * length);
const missingKinds = (map: MapItem): MapModKind[] => MAP_MOD_KINDS.filter((k) => !map.mods.some((m) => m.kind === k));

function rollMapValue(state: Gen, kind: MapModKind, tier: number): number {
  const { lo, hi } = mapModRange(kind, tier);
  return lo + pickIndex(state, hi - lo + 1);
}

function rerollMapMod(state: GameState, m: MapMod, tier: number): void {
  m.tier = tier;
  m.value = rollMapValue(state, m.kind, tier);
}

/**
 * Rolls `count` new modifiers of kinds the map lacks, and returns only the new ones; lower tiers are likelier. The
 * Trader's stock rolls them from a stream of its own.
 */
export function rollMapMods(state: Gen, map: MapItem, count: number): MapMod[] {
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
      throw new Error('iron no longer enchants maps; mapRuleCheck refuses it');
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

// ---- Targeted crafting (Plan 17): essences and orbs ----

/** How many essences of one stat and tier the player holds: every bag stack and the Essences tab. */
export function heldEssence(state: GameState, stat: StatKey, tier: number): number {
  let n = state.stash.essences[essenceKey(stat, tier)] ?? 0;
  for (const c of state.bag) if (c?.type === 'essence' && c.stat === stat && c.tier === tier) n += c.count;
  return n;
}

/** How many orbs of one side the player holds: every bag stack and the Essences tab. */
export function heldOrb(state: GameState, side: 'prefix' | 'suffix'): number {
  let n = state.stash.essences[side] ?? 0;
  for (const c of state.bag) if (c?.type === 'orb' && c.side === side) n += c.count;
  return n;
}

/** Spends one essence from the bag stacks first, then the Essences tab. */
function payEssence(state: GameState, stat: StatKey, tier: number): void {
  for (let i = 0; i < state.bag.length; i++) {
    const c = state.bag[i];
    if (c?.type !== 'essence' || c.stat !== stat || c.tier !== tier) continue;
    c.count -= 1;
    if (c.count <= 0) state.bag[i] = null;
    return;
  }
  const key = essenceKey(stat, tier);
  const next = (state.stash.essences[key] ?? 0) - 1;
  if (next <= 0) delete state.stash.essences[key];
  else state.stash.essences[key] = next;
}

/** Spends one orb from the bag stacks first, then the Essences tab. */
function payOrb(state: GameState, side: 'prefix' | 'suffix'): void {
  for (let i = 0; i < state.bag.length; i++) {
    const c = state.bag[i];
    if (c?.type !== 'orb' || c.side !== side) continue;
    c.count -= 1;
    if (c.count <= 0) state.bag[i] = null;
    return;
  }
  const next = (state.stash.essences[side] ?? 0) - 1;
  if (next <= 0) delete state.stash.essences[side];
  else state.stash.essences[side] = next;
}

/** A random line on one side, from the stats of that side the item lacks, in the item's usual tier band. */
function rollSideLine(state: GameState, item: GearItem, side: 'prefix' | 'suffix'): ModLine {
  const implicit = SLOT_IMPLICIT[item.slot];
  const pool = statsOf(setOfSlot(item.slot)).filter(
    (s) => s !== implicit && MOD_SIDE[s] === side && !item.affixes.some((l) => l.stat === s),
  );
  const stat = pickWeighted(state, pool.map((s) => [s, STAT_WEIGHTS[s] ?? DEFAULT_STAT_WEIGHT] as const));
  return rollModLine(state, stat, tierCap(item.ilvl));
}

/** A line of `stat` at a tier in `[tier, tier + 2]`, clamped to the item's cap. */
function rollEssenceLine(state: GameState, item: GearItem, stat: StatKey, tier: number): ModLine {
  const cap = tierCap(item.ilvl);
  const lo = Math.max(1, Math.min(tier, cap));
  const hi = Math.min(tier + 2, cap);
  const chosen = lo + pickIndex(state, hi - lo + 1);
  return { stat, value: rollValue(state, stat, chosen), tier: chosen };
}

/** The rules alone: sealed, legendary, then the item's rarity and the action's own. */
function targetedRuleCheck(state: GameState, item: GearItem, action: TargetedCraft): CraftCheck {
  if (item.sealed === true) return 'sealed';
  if (item.rarity === 'legendary') return 'legendary';
  if (item.rarity === 'normal') return 'wrongRarity';   // Copper makes it magic first
  switch (action.kind) {
    case 'addPrefix': return sideCount(item.affixes, 'prefix') < sideRoom(item) ? 'ok' : 'noRoom';
    case 'addSuffix': return sideCount(item.affixes, 'suffix') < sideRoom(item) ? 'ok' : 'noRoom';
    case 'addStat': {
      if (action.stat === SLOT_IMPLICIT[item.slot]) return 'noRoom';
      if (!statsOf(setOfSlot(item.slot)).includes(action.stat)) return 'noRoom';
      if (item.affixes.some((l) => l.stat === action.stat)) return 'noRoom';
      return sideCount(item.affixes, MOD_SIDE[action.stat]) < sideRoom(item) ? 'ok' : 'noRoom';
    }
    case 'rerollAffix':
    case 'rerollOrb':
    case 'removeAffix':
      return item.affixes[action.index] === undefined ? 'noSuchAffix' : 'ok';
  }
}

/** Whether a targeted craft would go through: the rules first, then whether the player holds its essence, orb or Obsidian. */
export function canTargetedCraft(state: GameState, target: ItemLoc, action: TargetedCraft): CraftCheck {
  if (target.where === 'stock') return 'notGear';
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return 'notGear';
  const rule = targetedRuleCheck(state, item, action);
  if (rule !== 'ok') return rule;
  switch (action.kind) {
    case 'addPrefix': return heldOrb(state, 'prefix') >= 1 ? 'ok' : 'short';
    case 'addSuffix': return heldOrb(state, 'suffix') >= 1 ? 'ok' : 'short';
    case 'addStat': return heldEssence(state, action.stat, action.tier) >= 1 ? 'ok' : 'short';
    case 'rerollAffix': {
      const l = item.affixes[action.index];
      if (l === undefined) return 'noSuchAffix';
      return heldEssence(state, l.stat, action.tier) >= 1 ? 'ok' : 'short';
    }
    case 'rerollOrb': {
      const l = item.affixes[action.index];
      if (l === undefined) return 'noSuchAffix';
      return heldOrb(state, MOD_SIDE[l.stat]) >= 1 ? 'ok' : 'short';
    }
    case 'removeAffix':
      return held(state, 'obsidian') >= craftCost('obsidian', item.ilvl) ? 'ok' : 'short';
  }
}

/** The targeted craft's effect on an item that passed its rules. */
function applyTargeted(state: GameState, item: GearItem, action: TargetedCraft): void {
  switch (action.kind) {
    case 'addPrefix': item.affixes.push(rollSideLine(state, item, 'prefix')); break;
    case 'addSuffix': item.affixes.push(rollSideLine(state, item, 'suffix')); break;
    case 'addStat': item.affixes.push(rollEssenceLine(state, item, action.stat, action.tier)); break;
    case 'rerollAffix': {
      const l = item.affixes[action.index];
      if (l !== undefined) {
        const rolled = rollEssenceLine(state, item, l.stat, action.tier);
        l.tier = rolled.tier;
        l.value = rolled.value;
      }
      break;
    }
    case 'rerollOrb': {
      const l = item.affixes[action.index];
      if (l !== undefined) {
        const rolled = rollModLine(state, l.stat, tierCap(item.ilvl));
        l.tier = rolled.tier;
        l.value = rolled.value;
      }
      break;
    }
    case 'removeAffix':
      item.affixes.splice(action.index, 1);
      break;
  }
  // A magic item is named by its lines; one left with none is normal again, under its base name.
  if (item.rarity === 'magic') {
    if (item.affixes.length === 0) {
      item.rarity = 'normal';
      item.name = baseName(item.slot, item.ilvl);
    } else {
      item.name = magicName(item.slot, item.ilvl, item.affixes);
    }
  }
}

/** What a targeted craft spends: its essence, orb, or Obsidian (for a chosen remove). */
function payFor(state: GameState, item: GearItem, action: TargetedCraft): void {
  switch (action.kind) {
    case 'addPrefix': payOrb(state, 'prefix'); return;
    case 'addSuffix': payOrb(state, 'suffix'); return;
    case 'addStat': payEssence(state, action.stat, action.tier); return;
    case 'rerollAffix': {
      const l = item.affixes[action.index];
      if (l !== undefined) payEssence(state, l.stat, action.tier);
      return;
    }
    case 'rerollOrb': {
      const l = item.affixes[action.index];
      if (l !== undefined) payOrb(state, MOD_SIDE[l.stat]);
      return;
    }
    case 'removeAffix': pay(state, 'obsidian', craftCost('obsidian', item.ilvl)); return;
  }
}

/**
 * Crafts a targeted affix on the gear at `target`. Only an 'ok' pays: the essence or orb first (bag stacks, then the
 * Essences tab), or Obsidian for a chosen remove. A refusal changes nothing.
 */
export function targetedCraft(state: GameState, target: ItemLoc, action: TargetedCraft): CraftResult {
  const check = canTargetedCraft(state, target, action);
  if (check !== 'ok') return { check };
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return { check: 'notGear' };
  applyTargeted(state, item, action);
  payFor(state, item, action);
  trail(state, item.id, { event: 'crafted' });
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return { check };
}
