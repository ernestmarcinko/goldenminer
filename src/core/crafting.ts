import { checkAchievements } from './achievements';
import {
  CRAFT_COST, DEFAULT_STAT_WEIGHT, GEM_STASH_STACK, MAGIC_LINE_WEIGHTS, MAP_CRAFT_SOULS_PER_TIER, MAP_SPECIAL_CHANCE, MAX_CRAFTED_LINES,
  MAX_MAP_MODS, MAX_SIDE_LINES, MAX_SOCKETS, MAX_TIER_OVER_CAP, RARE_LINE_WEIGHTS, RUNE_STASH_STACK, STAT_WEIGHTS, TEMPER_WEIGHTS, orbTierBand,
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

/** Whether a craft spends Diamonds (the exalt and the two rarity upgrades) rather than a material. */
export function spendsDiamonds(kind: CraftKind): boolean {
  return kind === 'diamond' || kind === 'makeMagic' || kind === 'makeRare';
}

/** The Souls a map rarity upgrade spends: 5 a tier to magic, twice that to rare. */
export function mapUpgradeSouls(map: MapItem, to: 'magic' | 'rare'): number {
  return MAP_CRAFT_SOULS_PER_TIER * map.tier * (to === 'rare' ? 2 : 1);
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

/** How much of a craft's currency the player holds: the Diamonds, or every stack of its material and the Materials tab. */
export function held(state: GameState, kind: CraftKind): number {
  if (spendsDiamonds(kind)) return state.diamonds;
  const material = kind as Material;
  let n = state.stash.materials[material];
  for (const c of state.bag) if (c?.type === 'material' && c.material === material) n += c.count;
  return n;
}

function pay(state: GameState, kind: CraftKind, cost: number, from?: ItemLoc): void {
  if (spendsDiamonds(kind)) {
    state.diamonds -= cost;
    return;
  }
  const material = kind as Material;
  let left = cost;
  for (const loc of payOrder(state, material, from)) {
    if (left === 0) return;
    if (loc.where === 'materials') {
      const n = Math.min(left, state.stash.materials[material]);
      state.stash.materials[material] -= n;
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
    case 'makeMagic': return item.rarity === 'normal' ? 'ok' : 'wrongRarity';
    case 'makeRare': return item.rarity === 'magic' ? 'ok' : 'wrongRarity';
    case 'tin': return item.rarity === 'magic' ? 'ok' : 'wrongRarity';
    case 'copper':
    case 'iron': return 'wrongRarity';   // retired: Copper's "make it magic" became a Diamond upgrade; Iron is the Minor orb's ore
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

/** A map's rules alone, in order: sealed, then the material's own. Only the two Soul upgrades are crafts on a map. */
function mapRuleCheck(map: MapItem, kind: CraftKind): CraftCheck {
  if (map.sealed === true) return 'sealed';
  switch (kind) {
    case 'makeMagic': return map.rarity === 'normal' ? 'ok' : 'wrongRarity';
    case 'makeRare': return map.rarity === 'magic' ? 'ok' : 'wrongRarity';
    case 'copper':
    case 'tin':
    case 'iron':
    case 'silver':
    case 'mithril':
    case 'starsteel':
    case 'obsidian':
    case 'voidCrystal':
    case 'diamond':
      return 'notForMaps';
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
    // A map's two upgrades spend Souls alone, not a material or Diamonds.
    const to = kind === 'makeMagic' ? 'magic' : 'rare';
    return state.souls >= mapUpgradeSouls(item, to) ? 'ok' : 'noSouls';
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
    case 'makeMagic':
      item.rarity = 'magic';
      reroll(state, item, pickWeighted(state, MAGIC_LINE_WEIGHTS), 1);
      item.name = magicName(item.slot, item.ilvl, item.affixes);
      return undefined;
    case 'makeRare':
      item.rarity = 'rare';
      reroll(state, item, pickWeighted(state, RARE_LINE_WEIGHTS), MAX_SIDE_LINES);
      return undefined;
    case 'tin':
      reroll(state, item, pickWeighted(state, MAGIC_LINE_WEIGHTS), 1);
      item.name = magicName(item.slot, item.ilvl, item.affixes);
      return undefined;
    case 'copper':
    case 'iron':
      throw new Error(`${kind} no longer crafts; ruleCheck refuses it`);
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

/** The craft's effect on a map that passed its rules. */
function applyToMap(state: GameState, map: MapItem, kind: CraftKind): TemperOutcome | undefined {
  switch (kind) {
    case 'makeMagic':
      map.rarity = 'magic';
      map.mods = rollMapMods(state, map, pickWeighted(state, MAGIC_LINE_WEIGHTS));
      rollSpecial(state, map);
      return undefined;
    case 'makeRare':
      map.rarity = 'rare';
      map.mods = rollMapMods(state, { ...map, mods: [] }, pickWeighted(state, RARE_LINE_WEIGHTS));
      rollSpecial(state, map);
      return undefined;
    case 'copper':
    case 'tin':
    case 'iron':
    case 'silver':
    case 'mithril':
    case 'starsteel':
    case 'obsidian':
    case 'voidCrystal':
    case 'diamond':
      throw new Error(`${kind} does not enchant a map`);
  }
}

/**
 * Crafts on the gear or map at `target`. Only an 'ok' pays: from `from` first (a bag stack or the tab slot of the
 * material), then the other bag stacks, then the Materials tab; Diamonds from `state.diamonds`. A map upgrade spends
 * Souls alone. A refusal changes nothing.
 */
export function craft(state: GameState, target: ItemLoc, kind: CraftKind, from?: ItemLoc): CraftResult {
  const check = canCraft(state, target, kind);
  if (check !== 'ok') return { check };
  const found = itemAt(state, target);
  if (found !== undefined && isMap(found)) {
    const souls = mapUpgradeSouls(found, kind === 'makeMagic' ? 'magic' : 'rare');
    const outcome = applyToMap(state, found, kind);
    state.souls -= souls;
    state.stats.soulsSpent += souls;
    checkAchievements(state, 'soulsSpent');
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
  if (spendsDiamonds(kind)) {
    state.stats.diamondsSpent += cost;
    checkAchievements(state, 'diamondsSpent');
  }
  trail(state, item.id, { event: 'crafted' });
  state.stats.itemsCrafted += 1;
  checkAchievements(state, 'craft');
  // Worn mining gear may change lamp sight, as equipping does.
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return outcome === undefined ? { check } : { check, temper: outcome };
}

// ---- Targeted crafting (Plan 27): the orb catalogue ----

/** How many orbs of one kind the player holds: every bag stack and the Orbs tab. */
export function heldOrbKind(state: GameState, family: OrbFamily, side: OrbSide | undefined, tier: OrbTier | undefined): number {
  let n = state.stash.orbs[orbKey(family, side, tier)] ?? 0;
  for (const c of state.bag) if (c?.type === 'orb' && c.family === family && c.side === side && c.tier === tier) n += c.count;
  return n;
}

/** Spends one orb of a kind from the bag stacks first, then the Orbs tab. */
function payOrbKind(state: GameState, family: OrbFamily, side: OrbSide | undefined, tier: OrbTier | undefined): void {
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

/** The orb a targeted action spends. */
function orbOfAction(action: TargetedCraft): { family: OrbFamily; side: OrbSide | undefined; tier: OrbTier | undefined } {
  switch (action.kind) {
    case 'addPrefix': return { family: 'craft', side: 'prefix', tier: action.tier };
    case 'addSuffix': return { family: 'craft', side: 'suffix', tier: action.tier };
    case 'removePrefix': return { family: 'removal', side: 'prefix', tier: undefined };
    case 'removeSuffix': return { family: 'removal', side: 'suffix', tier: undefined };
    case 'scatter': return { family: 'scattering', side: undefined, tier: undefined };
    case 'socketing': return { family: 'socketing', side: undefined, tier: undefined };
    case 'clearSockets': return { family: 'clearSockets', side: undefined, tier: undefined };
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

/** The rules alone: sealed, then the action's own. Socketing and clearing work on any rarity (sockets are
 * orthogonal to it); add, remove and scatter need magic or rare gear. */
function targetedRuleCheck(state: GameState, item: GearItem, action: TargetedCraft): CraftCheck {
  if (item.sealed === true) return 'sealed';
  if (action.kind === 'socketing') return item.sockets < MAX_SOCKETS ? 'ok' : 'socketFull';
  // Cleansing destroys every socketed rune, so it refuses an item with none.
  if (action.kind === 'clearSockets') return item.gems.some((g) => 'rune' in g) ? 'ok' : 'noRunes';
  if (item.rarity === 'legendary') return 'legendary';
  if (item.rarity === 'normal') return 'wrongRarity';
  switch (action.kind) {
    case 'addPrefix': return sideCount(item.affixes, 'prefix') < sideRoom(item) ? 'ok' : 'noRoom';
    case 'addSuffix': return sideCount(item.affixes, 'suffix') < sideRoom(item) ? 'ok' : 'noRoom';
    case 'removePrefix': return rolled(item).some((l) => MOD_SIDE[l.stat] === 'prefix') ? 'ok' : 'nothingToChange';
    case 'removeSuffix': return rolled(item).some((l) => MOD_SIDE[l.stat] === 'suffix') ? 'ok' : 'nothingToChange';
    case 'scatter': return rolled(item).length > 0 ? 'ok' : 'nothingToChange';
  }
}

/** Whether a targeted craft would go through: the rules first, then whether the player holds its orb. */
export function canTargetedCraft(state: GameState, target: ItemLoc, action: TargetedCraft): CraftCheck {
  if (target.where === 'stock') return 'notGear';
  const item = itemAt(state, target);
  if (item !== undefined && isMap(item)) {
    const rule = mapTargetedRuleCheck(item, action);
    if (rule !== 'ok') return rule;
    const orb = orbOfAction(action);
    return heldOrbKind(state, orb.family, orb.side, orb.tier) >= 1 ? 'ok' : 'short';
  }
  if (item === undefined || !isGear(item)) return 'notGear';
  const rule = targetedRuleCheck(state, item, action);
  if (rule !== 'ok') return rule;
  const orb = orbOfAction(action);
  return heldOrbKind(state, orb.family, orb.side, orb.tier) >= 1 ? 'ok' : 'short';
}

/** The rules alone for an orb enchant on a map: sealed, then the action's own. Sockets stay gear-only. */
function mapTargetedRuleCheck(map: MapItem, action: TargetedCraft): CraftCheck {
  if (map.sealed === true) return 'sealed';
  switch (action.kind) {
    case 'socketing':
    case 'clearSockets':
      return 'notForMaps';
    case 'addPrefix':
    case 'addSuffix':
      // A map is upgraded to magic or rare with Souls first; an orb then adds a modifier it lacks, within its cap.
      if (map.rarity === 'normal') return 'wrongRarity';
      return map.mods.length < MAX_MAP_MODS && missingKinds(map).length > 0 ? 'ok' : 'noRoom';
    case 'removePrefix':
    case 'removeSuffix':
      return map.mods.length > 0 ? 'ok' : 'nothingToChange';
    case 'scatter':
      return map.mods.length > 0 ? 'ok' : 'nothingToChange';
  }
}

/** The targeted craft's effect on an item that passed its rules. */
function applyTargeted(state: GameState, item: GearItem, action: TargetedCraft): void {
  switch (action.kind) {
    case 'addPrefix': item.affixes.push(rollSideLineBand(state, item, 'prefix', action.tier)); break;
    case 'addSuffix': item.affixes.push(rollSideLineBand(state, item, 'suffix', action.tier)); break;
    case 'removePrefix':
    case 'removeSuffix': {
      const side = action.kind === 'removePrefix' ? 'prefix' : 'suffix';
      const candidates = item.affixes.map((l, i) => [l, i] as const)
        .filter(([l]) => l.crafted !== true && MOD_SIDE[l.stat] === side);
      const chosen = candidates[pickIndex(state, candidates.length)];
      if (chosen !== undefined) item.affixes.splice(chosen[1], 1);
      break;
    }
    case 'scatter': {
      for (const l of rolled(item)) l.value = rollValue(state, l.stat, l.tier);
      break;
    }
    case 'socketing':
      item.sockets += 1;
      break;
    case 'clearSockets': {
      // Cleansing destroys the runes and leaves the gems socketed: the item is returned, only the runes are gone.
      item.gems = item.gems.filter((g) => !('rune' in g));
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

/** The targeted craft's effect on a map that passed its rules: add/remove a modifier, or reroll every value. */
function applyMapTargeted(state: GameState, map: MapItem, action: TargetedCraft): void {
  switch (action.kind) {
    case 'addPrefix':
    case 'addSuffix': {
      const [m] = rollMapMods(state, map, 1);
      if (m !== undefined) addMapMod(map, m);
      break;
    }
    case 'removePrefix':
    case 'removeSuffix':
      map.mods.splice(pickIndex(state, map.mods.length), 1);
      break;
    case 'scatter':
      for (const m of map.mods) m.value = rollMapValue(state, m.kind, m.tier);
      break;
    case 'socketing':
    case 'clearSockets':
      throw new Error(`${action.kind} does not work on a map`);
  }
}

/**
 * Crafts a targeted change on the gear or map at `target`. Only an 'ok' pays: the orb first (bag stacks, then the Orbs
 * tab). A refusal changes nothing.
 */
export function targetedCraft(state: GameState, target: ItemLoc, action: TargetedCraft): CraftResult {
  const check = canTargetedCraft(state, target, action);
  if (check !== 'ok') return { check };
  const item = itemAt(state, target);
  if (item === undefined) return { check: 'notGear' };
  if (isMap(item)) {
    applyMapTargeted(state, item, action);
  } else if (isGear(item)) {
    applyTargeted(state, item, action);
  } else {
    return { check: 'notGear' };
  }
  payFor(state, action);
  trail(state, item.id, { event: 'crafted' });
  state.stats.itemsCrafted += 1;
  checkAchievements(state, 'craft');
  if (target.where === 'worn' && setOfSlot(target.slot) === 'mining') fillAhead(state, deriveStats(state));
  return { check };
}
