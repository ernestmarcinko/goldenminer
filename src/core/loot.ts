import {
  GEM_BAG_STACK, GEM_GRADE_LEVEL, GEM_SALVAGE_DIAMONDS, GEM_SELL_GOLD, GEM_STASH_STACK, MAX_OVERFLOW,
  SALVAGE_DIAMONDS, SELL_GOLD,
} from './balance';
import { firstEmpty } from './cells';
import { itemName } from './itemData';
import { isGear, setOfSlot } from './items';
import type { Cell, GearItem, Gem, GemItem, Rarity } from './items';
import type { GameState, LootAction, LootNote, LootOutcome, LootRule } from './types';

const tierFactor = (level: number): number => 1 + Math.floor(level / 5);

export function gemSellValue(g: Gem): number {
  return GEM_SELL_GOLD * GEM_GRADE_LEVEL[g.grade];
}

export function gemSalvageValue(g: Gem): number {
  return GEM_SALVAGE_DIAMONDS * tierFactor(GEM_GRADE_LEVEL[g.grade]);
}

/** What the loot filter, selling and salvaging deal in: gear and gem stacks. */
type Loot = GearItem | GemItem;

export function sellValue(item: Loot): number {
  if (!isGear(item)) return gemSellValue(item) * item.count;
  return item.gems.reduce((sum, g) => sum + gemSellValue(g), SELL_GOLD[item.rarity] * item.ilvl);
}

export function salvageValue(item: Loot): number {
  if (!isGear(item)) return gemSalvageValue(item) * item.count;
  return item.gems.reduce((sum, g) => sum + gemSalvageValue(g), SALVAGE_DIAMONDS[item.rarity] * tierFactor(item.ilvl));
}

export function lootAction(rules: LootRule[], item: Loot): LootAction {
  for (const rule of rules) {
    const rarityOk = rule.rarity === 'any' || (isGear(item) && item.rarity === rule.rarity);
    const targetOk = rule.target === 'any'
      || (isGear(item)
        ? rule.target === item.slot || rule.target === setOfSlot(item.slot)
        : rule.target === 'gem');
    if (rarityOk && targetOk) return rule.action;
  }
  return 'keep';
}

function note(item: Loot, outcome: LootOutcome, value = 0): LootNote {
  return isGear(item)
    ? { name: itemName(item), rarity: item.rarity, base: item.slot, outcome, value }
    : { name: itemName(item), rarity: 'gem', base: item.gem, outcome, value };
}

function tally(state: GameState, notes: LootNote[]): LootNote[] {
  for (const n of notes) {
    if (n.outcome === 'sold') state.lootTally.sold += 1;
    else if (n.outcome === 'salvaged') state.lootTally.salvaged += 1;
    else state.lootTally.kept += 1;
  }
  return notes;
}

const RARITY_RANK: Readonly<Record<Rarity, number>> = { normal: 0, magic: 1, rare: 2, legendary: 3 };

// Lower rarity rank sells first, then lower Gold; the new item wins exact ties.
function isWorse(a: GearItem, b: GearItem): boolean {
  const ra = RARITY_RANK[a.rarity];
  const rb = RARITY_RANK[b.rarity];
  return ra < rb || (ra === rb && sellValue(a) < sellValue(b));
}

// Only gear is ever sold to make room, from the bag and every General page; the new item takes the cell.
function sellWorst(state: GameState, item: GearItem): LootNote[] {
  const bag = state.bag;
  let worst: { list: Cell[]; index: number; sold: GearItem } | null = null;
  let worstItem = item;
  for (const list of [bag, state.stash.general]) {
    for (const [index, sold] of list.entries()) {
      if (sold !== null && isGear(sold) && isWorse(sold, worstItem)) { worst = { list, index, sold }; worstItem = sold; }
    }
  }
  const worstValue = sellValue(worstItem);
  state.gold += worstValue;
  if (worst === null) return [note(item, 'sold', worstValue)];
  const { list, index, sold } = worst;
  list[index] = item;
  return [note(sold, 'sold', worstValue), note(item, list === bag ? 'bag' : 'stash')];
}

function stowGear(state: GameState, item: GearItem): LootNote[] | null {
  const bag = state.bag;
  const inBag = firstEmpty(bag);
  if (inBag >= 0) {
    bag[inBag] = item;
    return [note(item, 'bag')];
  }
  const general = state.stash.general;
  const inGeneral = firstEmpty(general);
  if (inGeneral >= 0) {
    general[inGeneral] = item;
    return [note(item, 'stash')];
  }
  return null;
}

// A found stack tops up bag stacks, then fills the first empty cell (one stack, under the incoming id), then joins the
// Gems tab; whatever is left is sold. One note, for where the first gem went (a sold remainder still pays out).
function stowGem(state: GameState, gem: GemItem, bag: Cell[]): LootNote[] {
  let left = gem.count;
  let first: LootOutcome | null = null;
  for (const c of bag) {
    if (left === 0) break;
    if (c?.type !== 'gem' || c.gem !== gem.gem || c.grade !== gem.grade || c.count >= GEM_BAG_STACK) continue;
    const take = Math.min(GEM_BAG_STACK - c.count, left);
    c.count += take;
    left -= take;
    first ??= 'bag';
  }
  const empty = firstEmpty(bag);
  if (left > 0 && empty >= 0) {
    const take = Math.min(GEM_BAG_STACK, left);
    bag[empty] = { ...gem, count: take };
    left -= take;
    first ??= 'bag';
  }
  const counts = state.stash.gems[gem.gem];
  const room = Math.min(left, GEM_STASH_STACK - counts[gem.grade]);
  if (room > 0) {
    counts[gem.grade] += room;
    left -= room;
    first ??= 'stash';
  }
  if (left === 0) return [note(gem, first ?? 'bag')];
  const value = gemSellValue(gem) * left;
  state.gold += value;
  return [note(gem, first ?? 'sold', first === null ? value : 0)];
}

export function receiveItem(state: GameState, item: Loot): LootNote[] {
  const action = lootAction(state.settings.lootFilter, item);
  if (action === 'sell') {
    const value = sellValue(item);
    state.gold += value;
    return tally(state, [note(item, 'sold', value)]);
  }
  if (action === 'salvage') {
    const value = salvageValue(item);
    state.diamonds += value;
    return tally(state, [note(item, 'salvaged', value)]);
  }
  if (!isGear(item)) return tally(state, stowGem(state, item, state.bag));
  const stowed = stowGear(state, item);
  if (stowed !== null) return tally(state, stowed);
  if (state.settings.bagFull === 'stop' && state.overflow.length < MAX_OVERFLOW) {
    state.overflow.push(item);
    return tally(state, [note(item, 'held')]);
  }
  return tally(state, sellWorst(state, item));
}

export function drainOverflow(state: GameState): void {
  while (state.overflow.length > 0) {
    const first = state.overflow[0];
    if (first === undefined) return;
    const action = lootAction(state.settings.lootFilter, first);
    if (action === 'sell') {
      state.gold += sellValue(first);
      state.overflow.shift();
      continue;
    }
    if (action === 'salvage') {
      state.diamonds += salvageValue(first);
      state.overflow.shift();
      continue;
    }
    if (stowGear(state, first) === null) {
      if (state.settings.bagFull === 'stop') return;
      sellWorst(state, first);
    }
    state.overflow.shift();
  }
}
