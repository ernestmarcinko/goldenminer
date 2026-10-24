import { BAG_SIZE, STASH_SIZE } from './balance';
import { isGear, setOfSlot } from './items';
import type { GearSet, Slot } from './items';
import { fillAhead } from './metres';
import { itemsIn, salvageValue, sellValue } from './loot';
import { deriveStats } from './stats';
import type { Container, GameState, InvResult } from './types';

function refillAhead(state: GameState): void {
  fillAhead(state, deriveStats(state));
}

export function equip(state: GameState, set: GearSet, index: number): InvResult {
  const bag = state.bags[set];
  const item = bag[index];
  if (item === undefined || !isGear(item) || setOfSlot(item.slot) !== set) return 'invalid';
  const worn = state.equipped[set][item.slot];
  state.equipped[set][item.slot] = item;
  if (worn === undefined) bag.splice(index, 1);
  else bag[index] = worn;
  refillAhead(state);
  return 'ok';
}

export function unequip(state: GameState, slot: Slot): InvResult {
  const set = setOfSlot(slot);
  const worn = state.equipped[set][slot];
  if (worn === undefined) return 'invalid';
  const bag = state.bags[set];
  if (bag.length >= BAG_SIZE) return 'bagFull';
  delete state.equipped[set][slot];
  bag.push(worn);
  refillAhead(state);
  return 'ok';
}

export function sell(state: GameState, from: Container, index: number): InvResult {
  const list = itemsIn(state, from);
  const item = list[index];
  if (item === undefined) return 'invalid';
  state.gold += sellValue(item);
  list.splice(index, 1);
  return 'ok';
}

export function salvage(state: GameState, from: Container, index: number): InvResult {
  const list = itemsIn(state, from);
  const item = list[index];
  if (item === undefined) return 'invalid';
  state.diamonds += salvageValue(item);
  list.splice(index, 1);
  return 'ok';
}

export function moveItem(state: GameState, from: Container, index: number, to: Container): InvResult {
  if (from === to) return 'invalid';
  const source = itemsIn(state, from);
  const item = source[index];
  if (item === undefined) return 'invalid';
  if (to !== 'stash' && isGear(item) && setOfSlot(item.slot) !== to) return 'invalid';
  const target = itemsIn(state, to);
  if (target.length >= (to === 'stash' ? STASH_SIZE : BAG_SIZE)) return to === 'stash' ? 'stashFull' : 'bagFull';
  source.splice(index, 1);
  target.push(item);
  return 'ok';
}

export function socketGem(state: GameState, from: Container, index: number, slot: Slot): InvResult {
  const list = itemsIn(state, from);
  const item = list[index];
  if (item === undefined || isGear(item)) return 'invalid';
  const worn = state.equipped[setOfSlot(slot)][slot];
  if (worn === undefined) return 'invalid';
  if (worn.gems.length >= worn.sockets) return 'noSocket';
  worn.gems.push(item);
  list.splice(index, 1);
  refillAhead(state);
  return 'ok';
}
