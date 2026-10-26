import { GEM_BAG_STACK, GEM_STASH_STACK, MATERIAL_BAG_STACK, MATERIAL_STASH_STACK } from './balance';
import { firstEmpty, itemAt, mapTierCount, sameLoc } from './cells';
import { craft } from './crafting';
import { trail } from './dropLog';
import { isGear, isMap, isStack, setOfSlot } from './items';
import type { Cell, GearItem, Item, MaterialItem, Slot, Stack } from './items';
import { fillAhead } from './metres';
import { salvagePay, sellFind, stackIntoBag, stashMaterials } from './loot';
import type { Loot } from './loot';
import { putMap, takeMapAt } from './maps';
import { deriveStats } from './stats';
import type { CraftResult, DropTarget, GameState, InvResult, ItemLoc } from './types';

type CellLoc = Extract<ItemLoc, { where: 'bag' | 'stash' }>;
/** A Gems or Materials stack: a count in a stash tab rather than a cell. */
type TabLoc = Extract<ItemLoc, { where: 'gems' | 'materials' }>;

function refillAhead(state: GameState): void {
  fillAhead(state, deriveStats(state));
}

const isTabLoc = (loc: ItemLoc): loc is TabLoc => loc.where === 'gems' || loc.where === 'materials';
const isCellLoc = (loc: ItemLoc): loc is CellLoc => loc.where === 'bag' || loc.where === 'stash';
// The Trader's stock is only ever bought from, so every move, drop, socket, sale or salvage that touches it is refused.
const isStock = (loc: DropTarget): loc is Extract<ItemLoc, { where: 'stock' }> => loc.where === 'stock';

function cellsOf(state: GameState, loc: CellLoc): readonly Cell[] {
  switch (loc.where) {
    case 'bag': return state.bag;
    case 'stash': return state.stash.general;
  }
}

/** True when a cell index is inside its grid; the stash tabs are as long as their pages. */
function inGrid(state: GameState, loc: CellLoc): boolean {
  return Number.isInteger(loc.index) && loc.index >= 0 && loc.index < cellsOf(state, loc).length;
}

function writeCell(state: GameState, loc: CellLoc, value: Cell): void {
  switch (loc.where) {
    case 'bag':
      state.bag[loc.index] = value;
      return;
    case 'stash':
      if (value !== null && !isGear(value)) throw new Error('the General tab holds gear only');
      state.stash.general[loc.index] = value;
  }
}

/** Logs an item crossing into the stash from the bag or a worn slot (stashed), or into the bag from elsewhere (back). */
function noteMove(state: GameState, item: Item, from: ItemLoc['where'], to: ItemLoc['where']): void {
  if (to === 'bag' && from !== 'bag') trail(state, item.id, { event: 'toBag' });
  else if ((to === 'stash' || to === 'maps') && (from === 'bag' || from === 'worn')) trail(state, item.id, { event: 'stashed' });
}

/** Whether an item may live at a location: anything in the bag, gear in General, maps in Maps, stacks in their own tab. */
function fits(item: Item, loc: ItemLoc): InvResult {
  switch (loc.where) {
    case 'bag': return 'ok';
    case 'stash': return isGear(item) ? 'ok' : 'gearOnly';
    case 'maps': return isMap(item) ? 'ok' : 'mapsOnly';
    case 'gems': return item.type === 'gem' ? 'ok' : 'gemsOnly';
    case 'materials': return item.type === 'material' ? 'ok' : 'materialsOnly';
    case 'worn': return isGear(item) ? (item.slot === loc.slot ? 'ok' : 'wrongSlot') : 'invalid';
    case 'stock': return 'invalid';
  }
}

/** The same kind of stack: the same gem and grade, or the same material. */
function sameStack(a: Stack, b: Stack): boolean {
  if (a.type === 'gem') return b.type === 'gem' && a.gem === b.gem && a.grade === b.grade;
  return b.type === 'material' && a.material === b.material;
}

const bagStackCap = (item: Stack): number => (item.type === 'gem' ? GEM_BAG_STACK : MATERIAL_BAG_STACK);
const tabStackCap = (item: Stack): number => (item.type === 'gem' ? GEM_STASH_STACK : MATERIAL_STASH_STACK);

function tabLocOf(item: Stack): TabLoc {
  return item.type === 'gem'
    ? { where: 'gems', gem: item.gem, grade: item.grade }
    : { where: 'materials', material: item.material };
}

/** The tab count of a stack's own kind. */
function tabCount(state: GameState, item: Stack): number {
  return item.type === 'gem' ? state.stash.gems[item.gem][item.grade] : state.stash.materials[item.material];
}

function addToTab(state: GameState, item: Stack, n: number): void {
  if (item.type === 'gem') state.stash.gems[item.gem][item.grade] += n;
  else state.stash.materials[item.material] += n;
}

/** Takes `n` from `item`, the stack at `from`: a bag stack or a tab stack. */
function removeUnits(state: GameState, from: ItemLoc, item: Stack, n: number): void {
  if (isTabLoc(from)) {
    addToTab(state, item, -n);
    return;
  }
  if (from.where !== 'bag') return;
  item.count -= n;
  if (item.count <= 0) writeCell(state, from, null);
}

function newStack(state: GameState, item: Stack, count: number): Stack {
  return item.type === 'gem'
    ? { id: state.nextId++, type: 'gem', gem: item.gem, grade: item.grade, count }
    : { id: state.nextId++, type: 'material', material: item.material, count };
}

/** Moves as many of `item` as fit into the tab count of its own kind. */
function putInTab(state: GameState, from: ItemLoc, item: Stack): InvResult {
  if (isTabLoc(from)) return 'invalid';
  const room = tabStackCap(item) - tabCount(state, item);
  if (room <= 0) return 'stackFull';
  const n = Math.min(room, item.count);
  addToTab(state, item, n);
  removeUnits(state, from, item, n);
  return 'ok';
}

/** Moves units from a bag or tab stack onto an identical bag stack, up to the bag stack cap. */
function mergeStacks(state: GameState, from: ItemLoc, item: Stack, target: Stack): InvResult {
  const room = bagStackCap(target) - target.count;
  if (room <= 0) return 'stackFull';
  const n = Math.min(room, item.count);
  target.count += n;
  removeUnits(state, from, item, n);
  return 'ok';
}

/**
 * Into or out of the Map stash. A map dropped anywhere on it joins its own tier (the cell is ignored); one taken out
 * goes to an empty bag cell, or swaps with a bag map, which must have room in its own tier (a map of the same tier
 * takes the place this one leaves).
 */
function moveMap(state: GameState, from: ItemLoc, item: Item, to: CellLoc | Extract<ItemLoc, { where: 'maps' }>): InvResult {
  if (to.where === 'maps') {
    if (!isMap(item)) return 'mapsOnly';
    if (from.where === 'maps') return 'ok';   // within the stash, nothing moves
    if (from.where !== 'bag') return 'invalid';
    const put = putMap(state, item);
    if (put === 'ok') {
      writeCell(state, from, null);
      noteMove(state, item, from.where, 'maps');
    }
    return put;
  }
  if (from.where !== 'maps' || !isMap(item)) return 'invalid';
  const fit = fits(item, to);
  if (fit !== 'ok') return fit;
  if (!inGrid(state, to)) return 'invalid';
  const target = itemAt(state, to);
  if (target !== undefined && !isMap(target)) return 'invalid';
  if (target !== undefined && target.tier === item.tier) {
    // within one tier this map leaves first, so even a full tier swaps
    takeMapAt(state, from);
    putMap(state, target);
  } else {
    if (target !== undefined) {
      const put = putMap(state, target);
      if (put !== 'ok') return put;
    }
    takeMapAt(state, from);
  }
  writeCell(state, to, item);
  noteMove(state, item, 'maps', to.where);
  if (target !== undefined) noteMove(state, target, to.where, 'maps');
  return 'ok';
}

/** Cell to cell: a move, a swap, a stack merge, or a put into or take from a Gems or Materials stack. */
export function moveItem(state: GameState, from: ItemLoc, to: ItemLoc): InvResult {
  if (isStock(from) || isStock(to)) return 'invalid';
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
  if (sameLoc(from, to)) return 'ok';
  if (from.where === 'worn' || to.where === 'worn') return 'invalid';
  if (to.where === 'gems') return item.type === 'gem' ? putInTab(state, from, item) : 'gemsOnly';
  if (to.where === 'materials') {
    if (item.type !== 'material') return 'materialsOnly';
    return item.material === to.material ? putInTab(state, from, item) : 'invalid';   // only its own slot
  }
  if (to.where === 'maps' || from.where === 'maps') return moveMap(state, from, item, to);
  if (!inGrid(state, to)) return 'invalid';
  const fit = fits(item, to);
  if (fit !== 'ok') return fit;
  const target = itemAt(state, to);
  if (isTabLoc(from)) {
    if (!isStack(item)) return 'invalid';
    if (target === undefined) {
      const n = Math.min(bagStackCap(item), item.count);
      writeCell(state, to, newStack(state, item, n));
      removeUnits(state, from, item, n);
      return 'ok';
    }
    return isStack(target) && sameStack(item, target) ? mergeStacks(state, from, item, target) : 'invalid';
  }
  if (target === undefined) {
    writeCell(state, to, item);
    writeCell(state, from, null);
    noteMove(state, item, from.where, to.where);
    return 'ok';
  }
  if (isStack(item) && isStack(target) && sameStack(item, target)) return mergeStacks(state, from, item, target);
  const back = fits(target, from);
  if (back !== 'ok') return back;
  writeCell(state, to, item);
  writeCell(state, from, target);
  noteMove(state, item, from.where, to.where);
  noteMove(state, target, to.where, from.where);
  return 'ok';
}

/** Wears gear from a bag or General cell; the item it replaces goes back into that cell. */
export function equip(state: GameState, from: ItemLoc): InvResult {
  if (from.where !== 'bag' && from.where !== 'stash') return 'invalid';
  const item = itemAt(state, from);
  if (item === undefined || !isGear(item)) return 'invalid';
  const set = setOfSlot(item.slot);
  const worn = state.equipped[set][item.slot];
  state.equipped[set][item.slot] = item;
  writeCell(state, from, worn ?? null);
  trail(state, item.id, { event: 'equipped' });
  if (worn !== undefined) noteMove(state, worn, 'worn', from.where);
  refillAhead(state);
  return 'ok';
}

/** Takes worn gear off into `to` (swapping with gear for the same slot), or into the bag's first empty cell. */
export function unequip(state: GameState, slot: Slot, to?: ItemLoc): InvResult {
  const set = setOfSlot(slot);
  const worn = state.equipped[set][slot];
  if (worn === undefined) return 'invalid';
  let dest: CellLoc;
  if (to === undefined) {
    const index = firstEmpty(state.bag);
    if (index < 0) return 'bagFull';
    dest = { where: 'bag', index };
  } else {
    if (to.where === 'worn') return 'invalid';
    const fit = fits(worn, to);
    if (fit !== 'ok') return fit;
    if (!isCellLoc(to) || !inGrid(state, to)) return 'invalid';
    const there = itemAt(state, to);
    if (there !== undefined && !isGear(there)) return 'invalid';
    if (there !== undefined && there.slot !== slot) return 'wrongSlot';
    dest = to;
  }
  const there = itemAt(state, dest);
  writeCell(state, dest, worn);
  noteMove(state, worn, 'worn', dest.where);
  if (there !== undefined && isGear(there)) {
    state.equipped[set][slot] = there;
    trail(state, there.id, { event: 'equipped' });
  } else delete state.equipped[set][slot];
  refillAhead(state);
  return 'ok';
}

/** Sockets one gem from a bag or Gems-tab stack into worn gear, or gear in a bag or General cell. */
export function socketGem(state: GameState, gem: ItemLoc, into: ItemLoc): InvResult {
  if (isStock(gem) || isStock(into)) return 'invalid';
  const item = itemAt(state, gem);
  if (item?.type !== 'gem' || gem.where === 'worn') return 'invalid';
  const target = itemAt(state, into);
  if (target === undefined || !isGear(target)) return 'invalid';
  if (target.gems.length >= target.sockets) return 'noSocket';
  target.gems.push({ gem: item.gem, grade: item.grade });
  removeUnits(state, gem, item, 1);
  if (into.where === 'worn') refillAhead(state);
  return 'ok';
}

/**
 * Empties a cell, a tier list's place or a Gems-tab stack (all of it) of gear, gems or a map, returning what was there.
 * Materials stay: they are crafting currency.
 */
function discard(state: GameState, from: ItemLoc): Loot | undefined {
  const item = itemAt(state, from);
  if (item === undefined || item.type === 'material') return undefined;
  if (from.where === 'gems') state.stash.gems[from.gem][from.grade] = 0;
  else if (from.where === 'maps') takeMapAt(state, from);
  else if (isCellLoc(from)) writeCell(state, from, null);
  else return undefined;
  return item;
}

export function sell(state: GameState, from: ItemLoc): InvResult {
  const item = discard(state, from);
  if (item === undefined) return 'invalid';
  trail(state, item.id, { event: 'sold', gold: sellFind(state, item).value });
  return 'ok';
}

export function salvage(state: GameState, from: ItemLoc): InvResult {
  const item = discard(state, from);
  if (item === undefined) return 'invalid';
  trail(state, item.id, { event: 'salvaged', materials: stashMaterials(state, salvagePay(item, deriveStats(state))) });
  return 'ok';
}

/** Up to a bag stack of a tab stack goes into the bag: existing stacks are topped up first, then one new cell. */
function takeStack(state: GameState, from: TabLoc, item: Stack): InvResult {
  const total = Math.min(bagStackCap(item), item.count);
  const left = stackIntoBag(state, item, total, 1, (n) => newStack(state, item, n));
  if (left === total) return 'bagFull';
  removeUnits(state, from, item, total - left);
  return 'ok';
}

/**
 * The click and card shortcut. To 'stash': gear to the first empty General cell, a map to its tier in the Map stash,
 * a gem or material stack to its tab, worn gear unequipped into General. To 'bag': General gear or a stashed map to
 * the bag's first empty cell, or up to a bag stack of a Gems or Materials stack.
 */
export function sendItem(state: GameState, from: ItemLoc, to: 'stash' | 'bag'): InvResult {
  if (isStock(from)) return 'invalid';
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
  if (to === 'stash') {
    if (from.where === 'stash' || from.where === 'maps' || isTabLoc(from)) return 'invalid';
    if (isStack(item)) return moveItem(state, from, tabLocOf(item));
    if (isMap(item)) return moveItem(state, from, { where: 'maps', tier: item.tier, index: mapTierCount(state, item.tier) });
    const index = firstEmpty(state.stash.general);
    if (index < 0) return 'stashFull';
    const dest: ItemLoc = { where: 'stash', index };
    return from.where === 'worn' ? unequip(state, from.slot, dest) : moveItem(state, from, dest);
  }
  if (isTabLoc(from) && isStack(item)) return takeStack(state, from, item);
  if (from.where === 'stash' || from.where === 'maps') {
    const index = firstEmpty(state.bag);
    return index < 0 ? 'bagFull' : moveItem(state, from, { where: 'bag', index });
  }
  return 'invalid';
}

/** The tab an item is stored in, for a drop on a tab button. */
function homeOf(item: Item): ItemLoc['where'] {
  switch (item.type) {
    case 'gear': return 'stash';
    case 'gem': return 'gems';
    case 'map': return 'maps';
    case 'material': return 'materials';
  }
}

/** Told of every craft a drop makes, refused or not, so the store can say why. */
export type CraftListener = (target: ItemLoc, item: MaterialItem, result: CraftResult) => void;

/** A material dropped on gear or a map crafts with it, paid from the dragged stack first. */
function craftDrop(state: GameState, from: ItemLoc, item: MaterialItem, to: ItemLoc, onCraft?: CraftListener): InvResult {
  const result = craft(state, to, item.material, from);
  onCraft?.(to, item, result);
  return result.check === 'ok' ? 'ok' : 'craftRefused';
}

/** Every drag-and-drop, however it ends: equip, unequip, socket, craft, move, swap, merge or send to a tab. */
export function dropItem(state: GameState, from: ItemLoc, to: DropTarget, onCraft?: CraftListener): InvResult {
  if (isStock(from) || isStock(to)) return 'invalid';
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
  if (item.type === 'material' && to.where !== 'stashTab') {
    const target = itemAt(state, to);
    if (target !== undefined && (isGear(target) || isMap(target))) return craftDrop(state, from, item, to, onCraft);
  }
  if (to.where === 'worn') {
    if (from.where === 'worn') return sameLoc(from, to) ? 'ok' : 'wrongSlot';
    if (item.type === 'gem') return socketGem(state, from, to);
    if (!isGear(item)) return 'invalid';
    return item.slot === to.slot ? equip(state, from) : 'wrongSlot';
  }
  if (to.where === 'stashTab') {
    if (to.tab === 'gems' && item.type !== 'gem') return 'gemsOnly';
    if (to.tab === 'general' && !isGear(item)) return 'gearOnly';
    if (to.tab === 'maps' && !isMap(item)) return 'mapsOnly';
    if (to.tab === 'materials' && item.type !== 'material') return 'materialsOnly';
    if (from.where === homeOf(item)) return 'ok';
    return sendItem(state, from, 'stash');
  }
  if (from.where === 'worn') return unequip(state, from.slot, to);
  if (item.type === 'gem' && (to.where === 'bag' || to.where === 'stash')) {
    const target = itemAt(state, to);
    if (target !== undefined && isGear(target)) return socketGem(state, from, to);
  }
  return moveItem(state, from, to);
}
