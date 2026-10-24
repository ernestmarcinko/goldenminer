import { BAG_SIZE, STASH_SIZE } from '../../core/balance';
import { BATTLE_SLOTS, isGear, MINING_SLOTS, setOfSlot } from '../../core/items';
import type { GearSet, Item, Slot } from '../../core/items';
import { salvageValue, sellValue } from '../../core/loot';
import { gemEffect } from '../../core/stats';
import type { Container, GameState, InvResult } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber, plural } from '../format';
import type { ClickIntent } from './itemView';
import { statText } from './itemView';

export type ItemTarget =
  | { where: 'bag'; set: GearSet; index: number }
  | { where: 'stash'; index: number }
  | { where: 'worn'; slot: Slot };

export interface ActionSpec {
  id: 'equip' | 'unequip' | 'sell' | 'salvage' | 'toStash' | 'toBag' | 'socket';
  label: string;
  disabled: boolean;
  slot?: Slot;
}

export function targetItem(state: GameState, target: ItemTarget): Item | undefined {
  if (target.where === 'worn') return state.equipped[setOfSlot(target.slot)][target.slot];
  return target.where === 'bag' ? state.bags[target.set][target.index] : state.stash[target.index];
}

const containerOf = (target: ItemTarget & { where: 'bag' | 'stash' }): Container =>
  target.where === 'bag' ? target.set : 'stash';

/** The bag an item leaves the stash for: gear to its own set's bag, a gem to the bag being shown. */
function bagFor(item: Item, shownSet: GearSet): GearSet {
  return isGear(item) ? setOfSlot(item.slot) : shownSet;
}

function socketActions(state: GameState, item: Item): ActionSpec[] {
  if (isGear(item)) return [];
  const specs: ActionSpec[] = [];
  for (const slot of [...MINING_SLOTS, ...BATTLE_SLOTS]) {
    const worn = state.equipped[setOfSlot(slot)][slot];
    if (worn === undefined || worn.gems.length >= worn.sockets) continue;
    const e = gemEffect(item, setOfSlot(slot));
    specs.push({ id: 'socket', label: `Socket into ${worn.name} (${statText(e.stat, e.value)})`, disabled: false, slot });
  }
  return specs;
}

export function itemActions(state: GameState, target: ItemTarget, shownSet: GearSet): ActionSpec[] {
  const item = targetItem(state, target);
  if (item === undefined) return [];
  if (target.where === 'worn') {
    return [{ id: 'unequip', label: 'Unequip', disabled: state.bags[setOfSlot(target.slot)].length >= BAG_SIZE }];
  }
  const sell: ActionSpec = { id: 'sell', label: `Sell (+${formatNumber(sellValue(item))} Gold)`, disabled: false };
  const salvage: ActionSpec = {
    id: 'salvage', label: `Salvage (+${plural(salvageValue(item), 'Diamond', 'Diamonds')})`, disabled: false,
  };
  if (target.where === 'stash') {
    const toBag: ActionSpec = {
      id: 'toBag', label: 'To bag', disabled: state.bags[bagFor(item, shownSet)].length >= BAG_SIZE,
    };
    return [toBag, ...socketActions(state, item), sell, salvage];
  }
  const toStash: ActionSpec = { id: 'toStash', label: 'To stash', disabled: state.stash.length >= STASH_SIZE };
  if (isGear(item)) return [{ id: 'equip', label: 'Equip', disabled: false }, sell, salvage, toStash];
  return [...socketActions(state, item), sell, salvage, toStash];
}

export function actionForIntent(
  actions: readonly ActionSpec[],
  target: ItemTarget,
  intent: ClickIntent,
): ActionSpec | 'menu' | undefined {
  const find = (...ids: ActionSpec['id'][]) => actions.find((a) => ids.includes(a.id));
  if (intent === 'menu') return 'menu';
  if (intent === 'sell') return find('sell');
  if (intent === 'move') return find('toStash', 'toBag');
  if (target.where === 'worn') return find('unequip');
  if (target.where === 'stash') return find('toBag');
  return find('equip') ?? 'menu';
}

export function hoverNote(target: ItemTarget, item: Item): string {
  if (target.where === 'worn') return 'Click to unequip';
  if (target.where === 'stash') return 'Click to move to your bag · Alt+click to sell';
  return `Click to ${isGear(item) ? 'equip' : 'socket'} · Alt+click to sell · Shift+click to stash`;
}

export function runAction(store: GameStore, target: ItemTarget, action: ActionSpec, shownSet: GearSet): InvResult {
  if (target.where === 'worn') return action.id === 'unequip' ? store.unequip(target.slot) : 'invalid';
  const item = targetItem(store.state, target);
  if (item === undefined) return 'invalid';
  const from = containerOf(target);
  switch (action.id) {
    case 'equip': return target.where === 'bag' ? store.equip(target.set, target.index) : 'invalid';
    case 'sell': return store.sell(from, target.index);
    case 'salvage': return store.salvage(from, target.index);
    case 'toStash': return target.where === 'bag' ? store.moveItem(from, target.index, 'stash') : 'invalid';
    case 'toBag': return target.where === 'stash' ? store.moveItem('stash', target.index, bagFor(item, shownSet)) : 'invalid';
    case 'socket': return action.slot !== undefined ? store.socketGem(from, target.index, action.slot) : 'invalid';
    case 'unequip': return 'invalid';
  }
}

export function resultText(r: InvResult): string | null {
  switch (r) {
    case 'bagFull': return 'That bag is full.';
    case 'stashFull': return 'The stash is full.';
    case 'noSocket': return 'That item has no open socket.';
    case 'ok':
    case 'invalid': return null;
  }
}
