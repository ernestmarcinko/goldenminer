import { GEM_BAG_STACK, GEM_STASH_STACK } from '../../core/balance';
import { firstEmpty, itemAt } from '../../core/cells';
import { BATTLE_SLOTS, GEAR_SETS, isGear, MINING_SLOTS, setOfSlot } from '../../core/items';
import type { GearItem, GearSet, Item } from '../../core/items';
import { salvageValue, sellValue } from '../../core/loot';
import { gemEffect } from '../../core/stats';
import type { GameState, InvResult, ItemLoc } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber, plural } from '../format';
import type { ClickIntent } from './itemView';
import { statText } from './itemView';

export type ItemTarget = ItemLoc;

export interface ActionSpec {
  id: 'equip' | 'unequip' | 'sell' | 'salvage' | 'toStash' | 'toBag' | 'take' | 'socket';
  label: string;
  disabled: boolean;
  /** For 'socket': the gear that takes the gem. */
  into?: ItemLoc;
}

/** The bag an item leaves the stash for: gear to its own set's bag, a gem to the bag being shown. */
function bagFor(item: Item, shownSet: GearSet): GearSet {
  return isGear(item) ? setOfSlot(item.slot) : shownSet;
}

/** One "Socket into …" action per worn item, then per carried item, that has an open socket. */
function socketActions(state: GameState, item: Item): ActionSpec[] {
  if (isGear(item)) return [];
  const specs: ActionSpec[] = [];
  const add = (into: ItemLoc, gear: GearItem, where: string): void => {
    if (gear.gems.length >= gear.sockets) return;
    const e = gemEffect(item, setOfSlot(gear.slot));
    specs.push({ id: 'socket', label: `Socket into ${gear.name} (${statText(e.stat, e.value)})${where}`, disabled: false, into });
  };
  for (const slot of [...MINING_SLOTS, ...BATTLE_SLOTS]) {
    const worn = state.equipped[setOfSlot(slot)][slot];
    if (worn !== undefined) add({ where: 'worn', slot }, worn, '');
  }
  for (const set of GEAR_SETS) {
    for (const [index, c] of state.bags[set].entries()) {
      if (c !== null && isGear(c)) add({ where: 'bag', set, index }, c, ' (bag)');
    }
  }
  for (const [index, c] of state.stash.general.entries()) {
    if (c !== null) add({ where: 'stash', index }, c, ' (stash)');
  }
  return specs;
}

/** Whether a bag can take at least one gem of this kind: an open cell, or a stack with room. */
function bagTakesGem(state: GameState, set: GearSet, item: Item): boolean {
  return firstEmpty(state.bags[set]) >= 0 || state.bags[set].some(
    (c) => c !== null && !isGear(c) && !isGear(item) && c.gem === item.gem && c.grade === item.grade && c.count < GEM_BAG_STACK,
  );
}

export function itemActions(state: GameState, target: ItemTarget, shownSet: GearSet): ActionSpec[] {
  const item = itemAt(state, target);
  if (item === undefined) return [];
  const generalFull = firstEmpty(state.stash.general) < 0;
  if (target.where === 'worn') {
    return [
      { id: 'unequip', label: 'Unequip', disabled: firstEmpty(state.bags[setOfSlot(target.slot)]) < 0 },
      { id: 'toStash', label: 'To stash', disabled: generalFull },
    ];
  }
  const all = target.where === 'gems';
  const sell: ActionSpec = {
    id: 'sell', label: `Sell${all ? ' all' : ''} (+${formatNumber(sellValue(item))} Gold)`, disabled: false,
  };
  const salvage: ActionSpec = {
    id: 'salvage', label: `Salvage${all ? ' all' : ''} (+${plural(salvageValue(item), 'Diamond', 'Diamonds')})`, disabled: false,
  };
  if (target.where === 'gems') {
    const take: ActionSpec = {
      id: 'take', label: `Take to bag (up to ${GEM_BAG_STACK})`, disabled: !bagTakesGem(state, shownSet, item),
    };
    return [take, ...socketActions(state, item), sell, salvage];
  }
  if (target.where === 'stash') {
    const toBag: ActionSpec = {
      id: 'toBag', label: 'To bag', disabled: firstEmpty(state.bags[bagFor(item, shownSet)]) < 0,
    };
    return [{ id: 'equip', label: 'Equip', disabled: false }, toBag, sell, salvage];
  }
  if (isGear(item)) {
    return [
      { id: 'equip', label: 'Equip', disabled: false }, sell, salvage,
      { id: 'toStash', label: 'To stash', disabled: generalFull },
    ];
  }
  // a gem stack joins its count on the Gems tab, unless that count is at its cap
  const toGems: ActionSpec = {
    id: 'toStash', label: 'To Gems tab', disabled: state.stash.gems[item.gem][item.grade] >= GEM_STASH_STACK,
  };
  return [...socketActions(state, item), sell, salvage, toGems];
}

export function actionForIntent(
  actions: readonly ActionSpec[],
  target: ItemTarget,
  intent: ClickIntent,
): ActionSpec | 'menu' | undefined {
  const find = (...ids: ActionSpec['id'][]) => actions.find((a) => ids.includes(a.id));
  if (intent === 'menu') return 'menu';
  // a Gems-tab stack can be huge, so selling it always goes through the card
  if (intent === 'sell') return target.where === 'gems' ? 'menu' : find('sell');
  if (intent === 'move') return find('toStash', 'toBag', 'take');
  if (target.where === 'worn') return find('unequip');
  if (target.where === 'stash') return find('toBag');
  if (target.where === 'gems') return find('take');
  return find('equip') ?? 'menu';
}

export function hoverNote(target: ItemTarget, item: Item): string {
  if (target.where === 'worn') return 'Click to unequip';
  if (target.where === 'stash') return 'Click to move to your bag · Alt+click to sell';
  if (target.where === 'gems') return `Click to take up to ${GEM_BAG_STACK} to your bag · Alt+click for sell all`;
  return isGear(item)
    ? 'Click to equip · Alt+click to sell · Shift+click to stash'
    : 'Click to socket · Alt+click to sell · Shift+click to Gems tab';
}

export function runAction(store: GameStore, target: ItemTarget, action: ActionSpec, shownSet: GearSet): InvResult {
  const item = itemAt(store.state, target);
  if (item === undefined) return 'invalid';
  switch (action.id) {
    case 'equip': return store.equip(target);
    case 'unequip': return target.where === 'worn' ? store.unequip(target.slot) : 'invalid';
    case 'sell': return store.sell(target);
    case 'salvage': return store.salvage(target);
    case 'toStash': return store.sendItem(target, 'stash');
    case 'toBag': return store.sendItem(target, bagFor(item, shownSet));
    case 'take': return store.sendItem(target, shownSet);
    case 'socket': return action.into !== undefined ? store.socketGem(target, action.into) : 'invalid';
  }
}

export function resultText(r: InvResult): string | null {
  switch (r) {
    case 'bagFull': return 'That bag is full.';
    case 'stashFull': return 'The stash is full.';
    case 'noSocket': return 'That item has no open socket.';
    case 'wrongSet': return 'That gear belongs in the other bag.';
    case 'wrongSlot': return "That doesn't fit that slot.";
    case 'gemsOnly': return 'Only gems go in the Gems tab.';
    case 'gearOnly': return 'Gems go in the Gems tab.';
    case 'stackFull': return 'That stack is full.';
    case 'invalid': return "That can't go there.";
    case 'ok': return null;
  }
}
