import { GEM_BAG_STACK, GEM_STASH_STACK } from './balance';
import { firstEmpty, itemAt, sameLoc } from './cells';
import { isGear, isMap, setOfSlot } from './items';
import type { Cell, GearItem, Gem, GemItem, Item, Slot } from './items';
import { fillAhead } from './metres';
import { salvageValue, sellValue } from './loot';
import { deriveStats } from './stats';
import type { DropTarget, GameState, InvResult, ItemLoc } from './types';

type CellLoc = Extract<ItemLoc, { where: 'bag' | 'stash' | 'maps' }>;

function refillAhead(state: GameState): void {
  fillAhead(state, deriveStats(state));
}

const sameGem = (a: Gem, b: Gem): boolean => a.gem === b.gem && a.grade === b.grade;
const isCellLoc = (loc: ItemLoc): loc is CellLoc => loc.where === 'bag' || loc.where === 'stash' || loc.where === 'maps';

function cellsOf(state: GameState, loc: CellLoc): readonly Cell[] {
  switch (loc.where) {
    case 'bag': return state.bag;
    case 'stash': return state.stash.general;
    case 'maps': return state.stash.maps;
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
      return;
    case 'maps':
      if (value !== null && !isMap(value)) throw new Error('the Maps tab holds maps only');
      state.stash.maps[loc.index] = value;
  }
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
  }
}

// Material stacks don't move yet: every move that would touch one is refused.
const touchesMaterials = (loc: ItemLoc, item: Item | undefined): boolean =>
  loc.where === 'materials' || item?.type === 'material';

/** Takes `n` gems from a bag stack or a Gems-tab stack. */
function removeGems(state: GameState, from: ItemLoc, n: number): void {
  if (from.where === 'gems') {
    state.stash.gems[from.gem][from.grade] -= n;
    return;
  }
  const item = itemAt(state, from);
  if (item?.type !== 'gem' || from.where !== 'bag') return;
  item.count -= n;
  if (item.count <= 0) writeCell(state, from, null);
}

function newStack(state: GameState, g: Gem, count: number): GemItem {
  return { id: state.nextId++, type: 'gem', gem: g.gem, grade: g.grade, count };
}

/** Moves as many of `item` as fit into the Gems-tab count of its own kind. */
function putGems(state: GameState, from: ItemLoc, item: GemItem): InvResult {
  if (from.where === 'gems') return 'invalid';
  const counts = state.stash.gems[item.gem];
  const room = GEM_STASH_STACK - counts[item.grade];
  if (room <= 0) return 'stackFull';
  const n = Math.min(room, item.count);
  counts[item.grade] += n;
  removeGems(state, from, n);
  return 'ok';
}

/** Moves gems from a bag or Gems-tab stack onto an identical bag stack, up to the stack cap. */
function mergeStacks(state: GameState, from: ItemLoc, item: GemItem, target: GemItem): InvResult {
  const room = GEM_BAG_STACK - target.count;
  if (room <= 0) return 'stackFull';
  const n = Math.min(room, item.count);
  target.count += n;
  removeGems(state, from, n);
  return 'ok';
}

/** Cell to cell: a move, a swap, a stack merge, or a Gems-tab put or take. */
export function moveItem(state: GameState, from: ItemLoc, to: ItemLoc): InvResult {
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
  if (sameLoc(from, to)) return 'ok';
  if (from.where === 'worn' || to.where === 'worn') return 'invalid';
  if (from.where === 'materials' || item.type === 'material') return 'invalid';   // see touchesMaterials
  if (to.where === 'materials') return 'materialsOnly';
  if (to.where === 'gems') return item.type === 'gem' ? putGems(state, from, item) : 'gemsOnly';
  if (!inGrid(state, to)) return 'invalid';
  const fit = fits(item, to);
  if (fit !== 'ok') return fit;
  const target = itemAt(state, to);
  if (touchesMaterials(to, target)) return 'invalid';
  if (from.where === 'gems') {
    if (item.type !== 'gem') return 'invalid';
    if (target === undefined) {
      writeCell(state, to, newStack(state, item, Math.min(GEM_BAG_STACK, item.count)));
      removeGems(state, from, Math.min(GEM_BAG_STACK, item.count));
      return 'ok';
    }
    return target.type === 'gem' && sameGem(item, target) ? mergeStacks(state, from, item, target) : 'invalid';
  }
  if (target === undefined) {
    writeCell(state, to, item);
    writeCell(state, from, null);
    return 'ok';
  }
  if (item.type === 'gem' && target.type === 'gem' && sameGem(item, target)) return mergeStacks(state, from, item, target);
  const back = fits(target, from);
  if (back !== 'ok') return back;
  writeCell(state, to, item);
  writeCell(state, from, target);
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
  if (there !== undefined && isGear(there)) state.equipped[set][slot] = there;
  else delete state.equipped[set][slot];
  refillAhead(state);
  return 'ok';
}

/** Sockets one gem from a bag or Gems-tab stack into worn gear, or gear in a bag or General cell. */
export function socketGem(state: GameState, gem: ItemLoc, into: ItemLoc): InvResult {
  const item = itemAt(state, gem);
  if (item?.type !== 'gem' || gem.where === 'worn') return 'invalid';
  const target = itemAt(state, into);
  if (target === undefined || !isGear(target)) return 'invalid';
  if (target.gems.length >= target.sockets) return 'noSocket';
  target.gems.push({ gem: item.gem, grade: item.grade });
  removeGems(state, gem, 1);
  if (into.where === 'worn') refillAhead(state);
  return 'ok';
}

/** Empties a cell or a Gems-tab stack (all of it) of gear or gems, returning what was there. Maps and materials stay. */
function discard(state: GameState, from: ItemLoc): GearItem | GemItem | undefined {
  const item = itemAt(state, from);
  if (item === undefined || item.type === 'map' || item.type === 'material') return undefined;
  if (from.where === 'gems') state.stash.gems[from.gem][from.grade] = 0;
  else if (isCellLoc(from)) writeCell(state, from, null);
  else return undefined;
  return item;
}

export function sell(state: GameState, from: ItemLoc): InvResult {
  const item = discard(state, from);
  if (item === undefined) return 'invalid';
  state.gold += sellValue(item);
  return 'ok';
}

export function salvage(state: GameState, from: ItemLoc): InvResult {
  const item = discard(state, from);
  if (item === undefined) return 'invalid';
  state.diamonds += salvageValue(item);
  return 'ok';
}

/** Up to a bag stack of a Gems-tab stack goes into the bag: existing stacks are topped up first, then one new cell. */
function takeGems(state: GameState, from: Extract<ItemLoc, { where: 'gems' }>, item: GemItem): InvResult {
  const cells = state.bag;
  const total = Math.min(GEM_BAG_STACK, item.count);
  let left = total;
  for (const c of cells) {
    if (left === 0) break;
    if (c?.type !== 'gem' || !sameGem(c, item) || c.count >= GEM_BAG_STACK) continue;
    const n = Math.min(left, GEM_BAG_STACK - c.count);
    c.count += n;
    left -= n;
  }
  const empty = firstEmpty(cells);
  if (left > 0 && empty >= 0) {
    cells[empty] = newStack(state, item, left);
    left = 0;
  }
  if (left === total) return 'bagFull';
  removeGems(state, from, total - left);
  return 'ok';
}

/**
 * The click and card shortcut. To 'stash': gear to the first empty General cell, a map to the first empty Maps cell,
 * a gem stack to the Gems tab, worn gear unequipped into General. To 'bag': General gear or a Maps-tab map to the
 * bag's first empty cell, or up to a bag stack of a Gems-tab stack.
 */
export function sendItem(state: GameState, from: ItemLoc, to: 'stash' | 'bag'): InvResult {
  const item = itemAt(state, from);
  if (item === undefined || touchesMaterials(from, item)) return 'invalid';
  if (to === 'stash') {
    if (from.where === 'stash' || from.where === 'maps' || from.where === 'gems') return 'invalid';
    if (item.type === 'gem') return moveItem(state, from, { where: 'gems', gem: item.gem, grade: item.grade });
    const tab = isMap(item) ? state.stash.maps : state.stash.general;
    const index = firstEmpty(tab);
    if (index < 0) return 'stashFull';
    const dest: ItemLoc = { where: isMap(item) ? 'maps' : 'stash', index };
    return from.where === 'worn' ? unequip(state, from.slot, dest) : moveItem(state, from, dest);
  }
  if (from.where === 'gems' && item.type === 'gem') return takeGems(state, from, item);
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

/** Every drag-and-drop, however it ends: equip, unequip, socket, move, swap, merge or send to a tab. */
export function dropItem(state: GameState, from: ItemLoc, to: DropTarget): InvResult {
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
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
    if (touchesMaterials(from, item)) return 'invalid';
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
