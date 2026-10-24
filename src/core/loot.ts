import {
  BAG_SIZE, GEM_SALVAGE_DIAMONDS, GEM_SELL_GOLD, MAX_OVERFLOW, SALVAGE_DIAMONDS, SELL_GOLD, STASH_SIZE,
} from './balance';
import { itemName } from './itemData';
import { isGear, setOfSlot } from './items';
import type { GearSet, Item, Rarity } from './items';
import type { Container, GameState, LootAction, LootNote, LootOutcome, LootRule } from './types';

const GEM_RANK = 1;

function tierFactor(ilvl: number): number {
  return 1 + Math.floor(ilvl / 5);
}

export function sellValue(item: Item): number {
  if (!isGear(item)) return GEM_SELL_GOLD * item.ilvl;
  return item.gems.reduce((sum, g) => sum + sellValue(g), SELL_GOLD[item.rarity] * item.ilvl);
}

export function salvageValue(item: Item): number {
  if (!isGear(item)) return GEM_SALVAGE_DIAMONDS * tierFactor(item.ilvl);
  return item.gems.reduce((sum, g) => sum + salvageValue(g), SALVAGE_DIAMONDS[item.rarity] * tierFactor(item.ilvl));
}

export function itemsIn(state: GameState, c: Container): Item[] {
  return c === 'stash' ? state.stash : state.bags[c];
}

export function lootAction(rules: LootRule[], item: Item): LootAction {
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

function note(item: Item, outcome: LootOutcome, value = 0): LootNote {
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

function rankOf(item: Item): number {
  return isGear(item) ? RARITY_RANK[item.rarity] : GEM_RANK;
}

// Lower rarity rank sells first, then lower Gold; the new item wins exact ties.
function isWorse(a: Item, b: Item): boolean {
  const ra = rankOf(a);
  const rb = rankOf(b);
  return ra < rb || (ra === rb && sellValue(a) < sellValue(b));
}

function sellWorst(state: GameState, item: Item, bagSet: GearSet): LootNote[] {
  const bag = state.bags[bagSet];
  let worst: { list: Item[]; index: number; sold: Item } | null = null;
  let worstItem = item;
  for (const list of [bag, state.stash]) {
    for (const [index, sold] of list.entries()) {
      if (isWorse(sold, worstItem)) { worst = { list, index, sold }; worstItem = sold; }
    }
  }
  const worstValue = sellValue(worstItem);
  state.gold += worstValue;
  if (worst === null) return [note(item, 'sold', worstValue)];
  const { list, index, sold } = worst;
  list.splice(index, 1, item);
  return [note(sold, 'sold', worstValue), note(item, list === bag ? 'bag' : 'stash')];
}

function stow(state: GameState, item: Item, bagSet: GearSet): LootNote[] | null {
  const bag = state.bags[bagSet];
  if (bag.length < BAG_SIZE) {
    bag.push(item);
    return [note(item, 'bag')];
  }
  if (state.stash.length < STASH_SIZE) {
    state.stash.push(item);
    return [note(item, 'stash')];
  }
  return null;
}

export function receiveItem(state: GameState, item: Item, gemBag: GearSet): LootNote[] {
  const bagSet = isGear(item) ? setOfSlot(item.slot) : gemBag;
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
  const stowed = stow(state, item, bagSet);
  if (stowed !== null) return tally(state, stowed);
  if (state.settings.bagFull === 'stop' && state.overflow.length < MAX_OVERFLOW) {
    state.overflow.push({ bag: bagSet, item });
    return tally(state, [note(item, 'held')]);
  }
  return tally(state, sellWorst(state, item, bagSet));
}

export function drainOverflow(state: GameState): void {
  while (state.overflow.length > 0) {
    const first = state.overflow[0];
    if (first === undefined) return;
    const action = lootAction(state.settings.lootFilter, first.item);
    if (action === 'sell') {
      state.gold += sellValue(first.item);
      state.overflow.shift();
      continue;
    }
    if (action === 'salvage') {
      state.diamonds += salvageValue(first.item);
      state.overflow.shift();
      continue;
    }
    if (stow(state, first.item, first.bag) === null) {
      if (state.settings.bagFull === 'stop') return;
      sellWorst(state, first.item, first.bag);
    }
    state.overflow.shift();
  }
}
