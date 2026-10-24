import { GEM_STASH_STACK } from './balance';
import { firstEmpty } from './cells';
import { isGear, setOfSlot } from './items';
import type { Cell, GearSet, Slot } from './items';
import { fillAhead } from './metres';
import { salvageValue, sellValue } from './loot';
import { deriveStats } from './stats';
import type { Container, GameState, InvResult } from './types';

function refillAhead(state: GameState): void {
  fillAhead(state, deriveStats(state));
}

// The cells a Container names: a bag, or the stash's General tab.
function cellsIn(state: GameState, c: Container): Cell[] {
  return c === 'stash' ? state.stash.general : state.bags[c];
}

export function equip(state: GameState, set: GearSet, index: number): InvResult {
  const bag = state.bags[set];
  const item = bag[index];
  if (item === undefined || item === null || !isGear(item) || setOfSlot(item.slot) !== set) return 'invalid';
  const worn = state.equipped[set][item.slot];
  state.equipped[set][item.slot] = item;
  bag[index] = worn ?? null;
  refillAhead(state);
  return 'ok';
}

export function unequip(state: GameState, slot: Slot): InvResult {
  const set = setOfSlot(slot);
  const worn = state.equipped[set][slot];
  if (worn === undefined) return 'invalid';
  const bag = state.bags[set];
  const empty = firstEmpty(bag);
  if (empty < 0) return 'bagFull';
  delete state.equipped[set][slot];
  bag[empty] = worn;
  refillAhead(state);
  return 'ok';
}

export function sell(state: GameState, from: Container, index: number): InvResult {
  const cells = cellsIn(state, from);
  const item = cells[index];
  if (item === undefined || item === null) return 'invalid';
  state.gold += sellValue(item);
  cells[index] = null;
  return 'ok';
}

export function salvage(state: GameState, from: Container, index: number): InvResult {
  const cells = cellsIn(state, from);
  const item = cells[index];
  if (item === undefined || item === null) return 'invalid';
  state.diamonds += salvageValue(item);
  cells[index] = null;
  return 'ok';
}

export function moveItem(state: GameState, from: Container, index: number, to: Container): InvResult {
  if (from === to) return 'invalid';
  const source = cellsIn(state, from);
  const item = source[index];
  if (item === undefined || item === null) return 'invalid';
  if (to !== 'stash' && isGear(item) && setOfSlot(item.slot) !== to) return 'invalid';
  if (to === 'stash' && !isGear(item)) {
    const counts = state.stash.gems[item.gem];
    if (counts[item.grade] + item.count > GEM_STASH_STACK) return 'stashFull';
    counts[item.grade] += item.count;
    source[index] = null;
    return 'ok';
  }
  const target = cellsIn(state, to);
  const empty = firstEmpty(target);
  if (empty < 0) return to === 'stash' ? 'stashFull' : 'bagFull';
  source[index] = null;
  target[empty] = item;
  return 'ok';
}

export function socketGem(state: GameState, from: Container, index: number, slot: Slot): InvResult {
  const cells = cellsIn(state, from);
  const item = cells[index];
  if (item === undefined || item === null || isGear(item)) return 'invalid';
  const worn = state.equipped[setOfSlot(slot)][slot];
  if (worn === undefined) return 'invalid';
  if (worn.gems.length >= worn.sockets) return 'noSocket';
  worn.gems.push({ gem: item.gem, grade: item.grade });
  if (item.count > 1) item.count -= 1;
  else cells[index] = null;
  refillAhead(state);
  return 'ok';
}
