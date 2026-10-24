import { BAG_SIZE, GEM_BAG_STACK, GEM_STASH_STACK, STASH_SIZE } from './balance';
import { firstEmpty, itemAt, sameLoc } from './cells';
import { isGear, setOfSlot } from './items';
import type { Cell, GearSet, Gem, GemItem, Item, Slot } from './items';
import { fillAhead } from './metres';
import { salvageValue, sellValue } from './loot';
import { deriveStats } from './stats';
import type { DropTarget, GameState, InvResult, ItemLoc } from './types';

type CellLoc = Extract<ItemLoc, { where: 'bag' | 'stash' }>;

function refillAhead(state: GameState): void {
  fillAhead(state, deriveStats(state));
}

const sameGem = (a: Gem, b: Gem): boolean => a.gem === b.gem && a.grade === b.grade;

/** True when a bag or General cell index is inside its grid. */
function inGrid(loc: CellLoc): boolean {
  const size = loc.where === 'bag' ? BAG_SIZE : STASH_SIZE;
  return Number.isInteger(loc.index) && loc.index >= 0 && loc.index < size;
}

function writeCell(state: GameState, loc: CellLoc, value: Cell): void {
  if (loc.where === 'bag') state.bags[loc.set][loc.index] = value;
  else if (value === null || isGear(value)) state.stash.general[loc.index] = value;
  else throw new Error('the General tab holds gear only');
}

/** Whether an item may live at a location: gear in its own set's bag or in General, gems in any bag or the Gems tab. */
function fits(item: Item, loc: ItemLoc): InvResult {
  switch (loc.where) {
    case 'bag': return isGear(item) && setOfSlot(item.slot) !== loc.set ? 'wrongSet' : 'ok';
    case 'stash': return isGear(item) ? 'ok' : 'gearOnly';
    case 'gems': return isGear(item) ? 'gemsOnly' : 'ok';
    case 'worn': return isGear(item) ? (item.slot === loc.slot ? 'ok' : 'wrongSlot') : 'invalid';
  }
}

/** Takes `n` gems from a bag stack or a Gems-tab stack. */
function removeGems(state: GameState, from: ItemLoc, n: number): void {
  if (from.where === 'gems') {
    state.stash.gems[from.gem][from.grade] -= n;
    return;
  }
  const item = itemAt(state, from);
  if (item === undefined || isGear(item) || (from.where !== 'bag' && from.where !== 'stash')) return;
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
  if (to.where === 'gems') return isGear(item) ? 'gemsOnly' : putGems(state, from, item);
  if (!inGrid(to)) return 'invalid';
  const fit = fits(item, to);
  if (fit !== 'ok') return fit;
  const target = itemAt(state, to);
  if (from.where === 'gems') {
    if (isGear(item)) return 'invalid';
    if (target === undefined) {
      writeCell(state, to, newStack(state, item, Math.min(GEM_BAG_STACK, item.count)));
      removeGems(state, from, Math.min(GEM_BAG_STACK, item.count));
      return 'ok';
    }
    return !isGear(target) && sameGem(item, target) ? mergeStacks(state, from, item, target) : 'invalid';
  }
  if (target === undefined) {
    writeCell(state, to, item);
    writeCell(state, from, null);
    return 'ok';
  }
  if (!isGear(item) && !isGear(target) && sameGem(item, target)) return mergeStacks(state, from, item, target);
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
  if (from.where === 'bag' && from.set !== set) return 'wrongSet';
  const worn = state.equipped[set][item.slot];
  state.equipped[set][item.slot] = item;
  writeCell(state, from, worn ?? null);
  refillAhead(state);
  return 'ok';
}

/** Takes worn gear off into `to` (swapping with gear for the same slot), or into its bag's first empty cell. */
export function unequip(state: GameState, slot: Slot, to?: ItemLoc): InvResult {
  const set = setOfSlot(slot);
  const worn = state.equipped[set][slot];
  if (worn === undefined) return 'invalid';
  let dest: CellLoc;
  if (to === undefined) {
    const index = firstEmpty(state.bags[set]);
    if (index < 0) return 'bagFull';
    dest = { where: 'bag', set, index };
  } else {
    if (to.where === 'worn') return 'invalid';
    if (to.where === 'gems') return 'gemsOnly';
    const fit = fits(worn, to);
    if (fit !== 'ok') return fit;
    if (!inGrid(to)) return 'invalid';
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
  if (item === undefined || isGear(item) || gem.where === 'worn') return 'invalid';
  const target = itemAt(state, into);
  if (target === undefined || !isGear(target)) return 'invalid';
  if (target.gems.length >= target.sockets) return 'noSocket';
  target.gems.push({ gem: item.gem, grade: item.grade });
  removeGems(state, gem, 1);
  if (into.where === 'worn') refillAhead(state);
  return 'ok';
}

/** Empties a bag cell, General cell or Gems-tab stack (all of it), returning what was there. */
function discard(state: GameState, from: ItemLoc): Item | undefined {
  if (from.where === 'worn') return undefined;
  const item = itemAt(state, from);
  if (item === undefined) return undefined;
  if (from.where === 'gems') state.stash.gems[from.gem][from.grade] = 0;
  else writeCell(state, from, null);
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

/** Up to a bag stack of a Gems-tab stack goes into a bag: existing stacks are topped up first, then one new cell. */
function takeGems(state: GameState, from: Extract<ItemLoc, { where: 'gems' }>, item: GemItem, set: GearSet): InvResult {
  const cells = state.bags[set];
  const total = Math.min(GEM_BAG_STACK, item.count);
  let left = total;
  for (const c of cells) {
    if (left === 0) break;
    if (c === null || isGear(c) || !sameGem(c, item) || c.count >= GEM_BAG_STACK) continue;
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
 * The click and card shortcut. To 'stash': gear to the first empty General cell, a gem stack to the Gems tab, worn
 * gear unequipped into General. To a set's bag: General gear to its own set's bag (whatever set is named), or up to
 * a bag stack of a Gems-tab stack to the named bag.
 */
export function sendItem(state: GameState, from: ItemLoc, to: 'stash' | GearSet): InvResult {
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
  if (to === 'stash') {
    if (from.where === 'stash' || from.where === 'gems') return 'invalid';
    if (!isGear(item)) return moveItem(state, from, { where: 'gems', gem: item.gem, grade: item.grade });
    const index = firstEmpty(state.stash.general);
    if (index < 0) return 'stashFull';
    const dest: ItemLoc = { where: 'stash', index };
    return from.where === 'worn' ? unequip(state, from.slot, dest) : moveItem(state, from, dest);
  }
  if (from.where === 'gems' && !isGear(item)) return takeGems(state, from, item, to);
  if (from.where === 'stash' && isGear(item)) {
    const set = setOfSlot(item.slot);
    const index = firstEmpty(state.bags[set]);
    return index < 0 ? 'bagFull' : moveItem(state, from, { where: 'bag', set, index });
  }
  return 'invalid';
}

/** Every drag-and-drop, however it ends: equip, unequip, socket, move, swap, merge or send to a tab. */
export function dropItem(state: GameState, from: ItemLoc, to: DropTarget): InvResult {
  const item = itemAt(state, from);
  if (item === undefined) return 'invalid';
  if (to.where === 'worn') {
    if (from.where === 'worn') return sameLoc(from, to) ? 'ok' : 'wrongSlot';
    if (!isGear(item)) return socketGem(state, from, to);
    return item.slot === to.slot ? equip(state, from) : 'wrongSlot';
  }
  if (to.where === 'stashTab') {
    const isGem = !isGear(item);
    if (to.tab === 'gems' && !isGem) return 'gemsOnly';
    if (to.tab === 'general' && isGem) return 'gearOnly';
    if (from.where === (isGem ? 'gems' : 'stash')) return 'ok';
    return sendItem(state, from, 'stash');
  }
  if (from.where === 'worn') return unequip(state, from.slot, to);
  if (!isGear(item) && (to.where === 'bag' || to.where === 'stash')) {
    const target = itemAt(state, to);
    if (target !== undefined && isGear(target)) return socketGem(state, from, to);
  }
  return moveItem(state, from, to);
}
