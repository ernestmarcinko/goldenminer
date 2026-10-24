import { GEM_BAG_STACK, GEM_STASH_STACK, MATERIAL_BAG_STACK, MATERIAL_STASH_STACK } from '../../core/balance';
import { firstEmpty, itemAt } from '../../core/cells';
import { MATERIAL_LABELS } from '../../core/itemData';
import { BATTLE_SLOTS, isGear, MATERIALS, MINING_SLOTS, setOfSlot } from '../../core/items';
import type { GearItem, GemItem, Item, MaterialItem } from '../../core/items';
import { salvagePay, sellPay } from '../../core/loot';
import { deriveStats, gemEffect } from '../../core/stats';
import type { CraftKind, GameState, InvResult, ItemLoc, Stats } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { craftOptions } from './craftView';
import type { ClickIntent } from './itemView';
import { statText } from './itemView';

export type ItemTarget = ItemLoc;

export interface ActionSpec {
  id: 'equip' | 'unequip' | 'sell' | 'salvage' | 'toStash' | 'toBag' | 'take' | 'socket' | 'run' | 'craft';
  label: string;
  disabled: boolean;
  /** For 'socket': the gear that takes the gem. */
  into?: ItemLoc;
  /** For 'craft': what it crafts with. */
  kind?: CraftKind;
}

/** One action per craft the gear's card offers, after its other actions. */
function craftActions(state: GameState, target: ItemTarget): ActionSpec[] {
  return craftOptions(state, target).map((o) => ({ id: 'craft', kind: o.kind, label: o.label, disabled: !o.enabled }));
}

/** One "Socket into …" action per worn item, then per carried item, that has an open socket. */
function socketActions(state: GameState, item: GemItem): ActionSpec[] {
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
  for (const [index, c] of state.bag.entries()) {
    if (c !== null && isGear(c)) add({ where: 'bag', index }, c, ' (bag)');
  }
  for (const [index, c] of state.stash.general.entries()) {
    if (c !== null) add({ where: 'stash', index }, c, ' (stash)');
  }
  return specs;
}

/** Whether the bag can take at least one gem of this kind: an open cell, or a stack with room. */
function bagTakesGem(state: GameState, item: GemItem): boolean {
  return firstEmpty(state.bag) >= 0 || state.bag.some(
    (c) => c?.type === 'gem' && c.gem === item.gem && c.grade === item.grade && c.count < GEM_BAG_STACK,
  );
}

function bagTakesMaterial(state: GameState, item: MaterialItem): boolean {
  return firstEmpty(state.bag) >= 0 || state.bag.some(
    (c) => c?.type === 'material' && c.material === item.material && c.count < MATERIAL_BAG_STACK,
  );
}

/** What salvage gives, in material order: "+3 Copper ore, +2 Tin ore". */
function yieldText(item: Item, stats: Stats): string {
  const y = salvagePay(item, stats);
  return MATERIALS.flatMap((m) => {
    const n = y[m];
    return n === undefined || n <= 0 ? [] : [`+${formatNumber(n)} ${MATERIAL_LABELS[m]}`];
  }).join(', ');
}

/** A bag stack joins its Materials count, unless that count is at its cap; a tab stack comes back to the bag. */
function materialActions(state: GameState, target: ItemTarget, item: MaterialItem): ActionSpec[] {
  if (target.where === 'materials') {
    return [{
      id: 'take', label: `Take to bag (up to ${formatNumber(MATERIAL_BAG_STACK)})`, disabled: !bagTakesMaterial(state, item),
    }];
  }
  const full = state.stash.materials[item.material] >= MATERIAL_STASH_STACK;
  return [{ id: 'toStash', label: 'To Materials tab', disabled: full }];
}

/** A map runs from its card (not while another run is going) and moves between the bag and the Maps tab. */
function mapActions(state: GameState, target: ItemTarget): ActionSpec[] {
  const run: ActionSpec = { id: 'run', label: 'Run this map', disabled: state.activity.kind === 'map' };
  if (target.where === 'maps') return [run, { id: 'toBag', label: 'To bag', disabled: firstEmpty(state.bag) < 0 }];
  return [run, { id: 'toStash', label: 'To Maps tab', disabled: firstEmpty(state.stash.maps) < 0 }];
}

export function itemActions(state: GameState, target: ItemTarget): ActionSpec[] {
  const item = itemAt(state, target);
  if (item === undefined) return [];
  if (item.type === 'map') return mapActions(state, target);
  if (item.type === 'material') return materialActions(state, target, item);
  const bagFull = firstEmpty(state.bag) < 0;
  const generalFull = firstEmpty(state.stash.general) < 0;
  if (target.where === 'worn') {
    return [
      { id: 'unequip', label: 'Unequip', disabled: bagFull },
      { id: 'toStash', label: 'To stash', disabled: generalFull },
      ...craftActions(state, target),
    ];
  }
  const all = target.where === 'gems';
  const stats = deriveStats(state);   // the labels show what sell bonus and salvage yield will pay
  const sell: ActionSpec = {
    id: 'sell', label: `Sell${all ? ' all' : ''} (+${formatNumber(sellPay(item, stats))} Gold)`, disabled: false,
  };
  const salvage: ActionSpec = {
    id: 'salvage', label: `Salvage${all ? ' all' : ''} (${yieldText(item, stats)})`, disabled: false,
  };
  if (item.type === 'gem' && target.where === 'gems') {
    const take: ActionSpec = {
      id: 'take', label: `Take to bag (up to ${formatNumber(GEM_BAG_STACK)})`, disabled: !bagTakesGem(state, item),
    };
    return [take, ...socketActions(state, item), sell, salvage];
  }
  if (target.where === 'stash') {
    return [
      { id: 'equip', label: 'Equip', disabled: false }, { id: 'toBag', label: 'To bag', disabled: bagFull }, sell, salvage,
      ...craftActions(state, target),
    ];
  }
  if (isGear(item)) {
    return [
      { id: 'equip', label: 'Equip', disabled: false }, sell, salvage,
      { id: 'toStash', label: 'To stash', disabled: generalFull },
      ...craftActions(state, target),
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
  if (target.where === 'gems' || target.where === 'materials') return find('take');
  return find('equip') ?? 'menu';
}

export function hoverNote(target: ItemTarget, item: Item): string {
  if (target.where === 'worn') return 'Click to unequip';
  if (target.where === 'stash') return 'Click to move to your bag · Alt+click to sell';
  if (target.where === 'gems') return `Click to take up to ${formatNumber(GEM_BAG_STACK)} · right-click for more`;
  if (target.where === 'materials') return `Click to take up to ${formatNumber(MATERIAL_BAG_STACK)} · right-click for more`;
  if (target.where === 'maps') return 'Click for actions · Shift+click to your bag';
  if (item.type === 'map') return 'Click for actions · Shift+click to the Maps tab';
  if (item.type === 'material') return 'Click for actions · Shift+click to the Materials tab';
  return isGear(item)
    ? 'Click to equip · Alt+click to sell · Shift+click to stash'
    : 'Click for actions · Alt+click to sell · Shift+click to the Gems tab';
}

export function runAction(store: GameStore, target: ItemTarget, action: ActionSpec): InvResult {
  const item = itemAt(store.state, target);
  if (item === undefined) return 'invalid';
  switch (action.id) {
    case 'equip': return store.equip(target);
    case 'unequip': return target.where === 'worn' ? store.unequip(target.slot) : 'invalid';
    case 'sell': return store.sell(target);
    case 'salvage': return store.salvage(target);
    case 'toStash': return store.sendItem(target, 'stash');
    case 'toBag':
    case 'take': return store.sendItem(target, 'bag');
    case 'socket': return action.into !== undefined ? store.socketGem(target, action.into) : 'invalid';
    case 'run': return item.type === 'map' ? store.startMap(item.id) : 'invalid';
    case 'craft':
      if (action.kind === undefined) return 'invalid';
      return store.craft(target, action.kind).check === 'ok' ? 'ok' : 'craftRefused';
  }
}

export function resultText(r: InvResult): string | null {
  switch (r) {
    case 'bagFull': return 'The bag is full.';
    case 'stashFull': return 'The stash is full.';
    case 'noSocket': return 'That item has no open socket.';
    case 'wrongSlot': return "That doesn't fit that slot.";
    case 'gemsOnly': return 'Only gems go in the Gems tab.';
    case 'gearOnly': return 'Only gear goes in the General tab.';
    case 'mapsOnly': return 'Only maps go in the Maps tab.';
    case 'materialsOnly': return 'Only materials go in the Materials tab.';
    case 'busy': return 'Leave the current map first.';
    case 'stackFull': return 'That stack is full.';
    case 'craftRefused': return "That craft didn't work.";
    case 'invalid': return "That can't go there.";
    case 'ok': return null;
  }
}
