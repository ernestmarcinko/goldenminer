import { checkAchievements } from './achievements';
import {
  CRAFT_COST, DEFAULT_STAT_WEIGHT, GEM_STASH_STACK, MAGIC_LINE_WEIGHTS, MAP_CRAFT_SOULS_PER_TIER, MAP_SPECIAL_CHANCE, MAX_CRAFTED_LINES,
  MAX_SIDE_LINES, MAX_TIER_OVER_CAP, RARE_LINE_WEIGHTS, RUNE_STASH_STACK, STAT_WEIGHTS, TEMPER_WEIGHTS, orbTierBand,
} from './balance';
import { itemAt, sameLoc } from './cells';
import { trail } from './dropLog';
import { baseName } from './itemData';
import { magicName, rollLines, rollSockets, rollValue, sideCount, type Gen } from './itemGen';
import { MAP_MOD_KINDS, MAP_SPECIALS, MOD_SIDE, SLOT_IMPLICIT, isGear, isMap, orbKey, setOfSlot, statsOf } from './items';
import type { GearItem, MapItem, MapMod, MapModKind, MapSpecial, Material, ModLine, OrbFamily, OrbSide, OrbTier, StatKey } from './items';
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
  const cost = CRAFT_COST[kind];
  if (cost === undefined) throw new Error(`${kind} is retired and never crafts`);
  return cost.per === 0 ? cost.base : cost.base + Math.floor(level / cost.per);
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
    case 'iron': return 'wrongRarity';   // retired: Iron is the Minor orb's ore, not a craft
    case 'silver': return item.rarity === 'rare' ? 'ok' : 'wrongRarity';
    case 'mithril': {
      // Every socketed gem or rune goes back to its own tab count, so none may pass its cap.
      for (const s of item.gems) {
        if ('rune' in s) {
          const back = item.gems.filter((o) => 'rune' in o && o.rune === s.rune).length;
          if (state.stash.runes[s.rune] + back > RUNE_STASH_STACK) return 'gemsFull';
        } else {
          const back = item.gems.filter((o) => 'gem' in o && o.gem === s.gem && o.grade === s.grade).length;
          if (state.stash.gems[s.gem][s.grade] + back > GEM_STASH_STACK) return 'gemsFull';
        }
      }
      return 'ok';
    }
    case 'starsteel': return 'wrongRarity';   // retired: removal orbs cover it now (Plan 27)
    case 'obsidian': return 'wrongRarity';    // retired: scattering orbs cover it now (Plan 27)
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
    case 'obsidian': return 'notForMaps';   // retired: removal orbs cover it now (Plan 27)
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
      for (const g of item.gems) {
        if ('rune' in g) state.stash.runes[g.rune]++;
        else state.stash.gems[g.gem][g.grade]++;
      }
      item.gems = [];
      item.sockets = rollSockets(state);
      return undefined;
    case 'starsteel':
      throw new Error('starsteel no longer crafts; ruleCheck refuses it');
    case 'obsidian':
      throw new Error('obsidian no longer crafts; ruleCheck refuses it');
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
      throw new Error('obsidian no longer enchants maps; mapRuleCheck refuses it');
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
    state.stats.soulsSpent += souls;
    trail(state, found.id, { event: 'crafted' });
    state.stats.itemsCrafted += 1;
    checkAchievements(state, 'craft');
    return outcome === undefined ? { check } : { check, temper: outcome };
  }
  const item = found as GearItem;
  // The cost is known beforehand, and paying last means a craft that failed part-way could never spend material.
  const cost = craftCost(kind, item.ilvl);
  const outcome = apply(state, item, kind);
  pay(state, kind, cost, from);
  if (kind === 'diamond') state.stats.diamondsSpent += cost;
  trail(state, item.id, { event: 'crafted' });
  state.stats.itemsCrafted += 1;
  checkAchievements(state, 'craft');
  // Worn mining gear may change lamp sight, as equipping does.
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return outcome === undefined ? { check } : { check, temper: outcome };
}

// ---- Targeted crafting (Plan 27): the orb catalogue ----

/** How many orbs of one kind the player holds: every bag stack and the Orbs tab. */
export function heldOrbKind(state: GameState, family: OrbFamily, side: OrbSide | undefined, tier: OrbTier): number {
  let n = state.stash.orbs[orbKey(family, side, tier)] ?? 0;
  for (const c of state.bag) if (c?.type === 'orb' && c.family === family && c.side === side && c.tier === tier) n += c.count;
  return n;
}

/** Spends one orb of a kind from the bag stacks first, then the Orbs tab. */
function payOrbKind(state: GameState, family: OrbFamily, side: OrbSide | undefined, tier: OrbTier): void {
  for (let i = 0; i < state.bag.length; i++) {
    const c = state.bag[i];
    if (c?.type !== 'orb' || c.family !== family || c.side !== side || c.tier !== tier) continue;
    c.count -= 1;
    if (c.count <= 0) state.bag[i] = null;
    return;
  }
  const key = orbKey(family, side, tier);
  const next = (state.stash.orbs[key] ?? 0) - 1;
  if (next <= 0) delete state.stash.orbs[key];
  else state.stash.orbs[key] = next;
}

/** The side a targeted kind aims at. */
function sideOf(kind: 'addPrefix' | 'addSuffix' | 'rerollPrefix' | 'rerollSuffix' | 'removePrefix' | 'removeSuffix'): OrbSide {
  return kind.endsWith('Prefix') ? 'prefix' : 'suffix';
}

/** Whether a removal orb of `tier` may remove a line at `lineTier`, for an item whose cap is `cap`. */
function removalInScope(tier: OrbTier, lineTier: number, cap: number): boolean {
  const c = Math.max(1, cap);
  const third = Math.floor(c / 3);
  const twoThirds = Math.floor((2 * c) / 3);
  switch (tier) {
    case 'minor': return lineTier <= third;
    case 'normal': return true;
    case 'greater': return lineTier >= twoThirds + 1;
  }
}

/** The orb a targeted action spends. */
function orbOfAction(action: TargetedCraft): { family: OrbFamily; side: OrbSide | undefined; tier: OrbTier } {
  switch (action.kind) {
    case 'addPrefix':
    case 'rerollPrefix': return { family: 'craft', side: 'prefix', tier: action.tier };
    case 'addSuffix':
    case 'rerollSuffix': return { family: 'craft', side: 'suffix', tier: action.tier };
    case 'removePrefix': return { family: 'removal', side: 'prefix', tier: action.tier };
    case 'removeSuffix': return { family: 'removal', side: 'suffix', tier: action.tier };
    case 'scatter': return { family: 'scattering', side: undefined, tier: action.tier };
  }
}

/** A line of `stat` rolled at a tier uniform in the orb's band for the item. */
function rollLineBand(state: GameState, stat: StatKey, tier: OrbTier, ilvl: number): ModLine {
  const [lo, hi] = orbTierBand(tier, tierCap(ilvl));
  const chosen = lo + pickIndex(state, hi - lo + 1);
  return { stat, value: rollValue(state, stat, chosen), tier: chosen };
}

/** A random line on one side, from the stats of that side the item lacks, rolled in the orb's band. */
function rollSideLineBand(state: GameState, item: GearItem, side: OrbSide, tier: OrbTier): ModLine {
  const implicit = SLOT_IMPLICIT[item.slot];
  const pool = statsOf(setOfSlot(item.slot)).filter(
    (s) => s !== implicit && MOD_SIDE[s] === side && !item.affixes.some((l) => l.stat === s),
  );
  const stat = pickWeighted(state, pool.map((s) => [s, STAT_WEIGHTS[s] ?? DEFAULT_STAT_WEIGHT] as const));
  return rollLineBand(state, stat, tier, item.ilvl);
}

/** The rules alone: sealed, legendary, then the item's rarity and the action's own. */
function targetedRuleCheck(state: GameState, item: GearItem, action: TargetedCraft): CraftCheck {
  if (item.sealed === true) return 'sealed';
  if (item.rarity === 'legendary') return 'legendary';
  if (item.rarity === 'normal') return 'wrongRarity';   // Copper makes it magic first
  switch (action.kind) {
    case 'addPrefix': return sideCount(item.affixes, 'prefix') < sideRoom(item) ? 'ok' : 'noRoom';
    case 'addSuffix': return sideCount(item.affixes, 'suffix') < sideRoom(item) ? 'ok' : 'noRoom';
    case 'rerollPrefix':
    case 'rerollSuffix': {
      const l = item.affixes[action.index];
      if (l === undefined || l.crafted === true || MOD_SIDE[l.stat] !== sideOf(action.kind)) return 'noSuchAffix';
      return 'ok';
    }
    case 'removePrefix':
    case 'removeSuffix': {
      const cap = tierCap(item.ilvl);
      const side = sideOf(action.kind);
      const inScope = rolled(item).some((l) => MOD_SIDE[l.stat] === side && removalInScope(action.tier, l.tier, cap));
      return inScope ? 'ok' : 'nothingToChange';
    }
    case 'scatter':
      return rolled(item).length > 0 ? 'ok' : 'nothingToChange';
  }
}

/** Whether a targeted craft would go through: the rules first, then whether the player holds its orb. */
export function canTargetedCraft(state: GameState, target: ItemLoc, action: TargetedCraft): CraftCheck {
  if (target.where === 'stock') return 'notGear';
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return 'notGear';
  const rule = targetedRuleCheck(state, item, action);
  if (rule !== 'ok') return rule;
  const orb = orbOfAction(action);
  return heldOrbKind(state, orb.family, orb.side, orb.tier) >= 1 ? 'ok' : 'short';
}

/** The targeted craft's effect on an item that passed its rules. */
function applyTargeted(state: GameState, item: GearItem, action: TargetedCraft): void {
  switch (action.kind) {
    case 'addPrefix': item.affixes.push(rollSideLineBand(state, item, 'prefix', action.tier)); break;
    case 'addSuffix': item.affixes.push(rollSideLineBand(state, item, 'suffix', action.tier)); break;
    case 'rerollPrefix':
    case 'rerollSuffix': {
      const l = item.affixes[action.index];
      if (l !== undefined) {
        const rolled = rollLineBand(state, l.stat, action.tier, item.ilvl);
        l.tier = rolled.tier;
        l.value = rolled.value;
      }
      break;
    }
    case 'removePrefix':
    case 'removeSuffix': {
      const side = sideOf(action.kind);
      const cap = tierCap(item.ilvl);
      const inScope = item.affixes.map((l, i) => [l, i] as const)
        .filter(([l]) => l.crafted !== true && MOD_SIDE[l.stat] === side && removalInScope(action.tier, l.tier, cap));
      const chosen = inScope[pickIndex(state, inScope.length)];
      if (chosen !== undefined) item.affixes.splice(chosen[1], 1);
      break;
    }
    case 'scatter': {
      const rolls = action.tier === 'minor' ? 1 : action.tier === 'normal' ? 2 : 3;
      for (const l of rolled(item)) {
        let best = l.value;
        for (let i = 0; i < rolls; i++) best = Math.max(best, rollValue(state, l.stat, l.tier));
        l.value = best;
      }
      break;
    }
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

/** What a targeted craft spends: the orb its kind uses. */
function payFor(state: GameState, action: TargetedCraft): void {
  const orb = orbOfAction(action);
  payOrbKind(state, orb.family, orb.side, orb.tier);
}

/**
 * Crafts a targeted change on the gear at `target`. Only an 'ok' pays: the orb first (bag stacks, then the Orbs tab).
 * A refusal changes nothing.
 */
export function targetedCraft(state: GameState, target: ItemLoc, action: TargetedCraft): CraftResult {
  const check = canTargetedCraft(state, target, action);
  if (check !== 'ok') return { check };
  const item = itemAt(state, target);
  if (item === undefined || !isGear(item)) return { check: 'notGear' };
  applyTargeted(state, item, action);
  payFor(state, action);
  trail(state, item.id, { event: 'crafted' });
  state.stats.itemsCrafted += 1;
  checkAchievements(state, 'craft');
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return { check };
}
