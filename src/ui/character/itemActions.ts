import { GEM_BAG_STACK, GEM_STASH_STACK, MAP_TIER_CAP, MATERIAL_BAG_STACK, MATERIAL_STASH_STACK } from '../../core/balance';
import { firstEmpty, itemAt, mapTierCount } from '../../core/cells';
import { MATERIAL_LABELS } from '../../core/itemData';
import { isGear, MATERIALS } from '../../core/items';
import type { GemItem, Item, MapItem, Material, MaterialItem } from '../../core/items';
import { salvagePay, sellPay } from '../../core/loot';
import type { Loot } from '../../core/loot';
import { canUpgrade, soulUpgradeCost } from '../../core/soulUpgrade';
import type { SoulUpgradeCheck } from '../../core/soulUpgrade';
import { deriveStats } from '../../core/stats';
import type { CraftKind, DropTarget, GameState, InvResult, ItemLoc, Stats } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { sellKey } from '../platform';
import { craftOptions } from './craftView';
import type { ClickIntent, ViewLine } from './itemView';

export type ItemTarget = ItemLoc;

export interface ActionSpec {
  id: 'equip' | 'unequip' | 'sell' | 'salvage' | 'toStash' | 'toBag' | 'take' | 'run' | 'soulUpgrade' | 'craft';
  label: string;
  disabled: boolean;
  /** For 'craft': what it crafts with. */
  kind?: CraftKind;
}

/**
 * After a gear's or map's other actions: a battle gear's Soul upgrade, then one action per craft its card offers. Sealed
 * gear has no upgrade; one the player can't pay for yet, or at the highest level, stays on the card, disabled.
 */
function craftActions(state: GameState, target: ItemTarget): ActionSpec[] {
  const crafts = craftOptions(state, target).map((o): ActionSpec => ({
    id: 'craft', kind: o.kind, label: o.label, disabled: !o.enabled,
  }));
  const item = itemAt(state, target);
  const check = canUpgrade(state, target);
  if (item === undefined || !isGear(item) || check === 'notBattle' || check === 'sealed' || check === 'invalid') return crafts;
  const label = check === 'maxLevel'
    ? `Upgrade with Souls: item level ${formatNumber(item.ilvl)} is the highest`
    : `Upgrade with Souls: item level ${formatNumber(item.ilvl)} → ${formatNumber(item.ilvl + 1)}`
      + ` · ${formatNumber(soulUpgradeCost(item.ilvl))} Souls`;
  return [{ id: 'soulUpgrade', label, disabled: check !== 'ok' }, ...crafts];
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

/** Materials by count, in material order, each with `sign` before it: "2 Copper ore, 1 Tin ore". */
function countsText(counts: Partial<Record<Material, number>>, sign: '' | '+'): string {
  return MATERIALS.flatMap((m) => {
    const n = counts[m];
    return n === undefined || n <= 0 ? [] : [`${sign}${formatNumber(n)} ${MATERIAL_LABELS[m]}`];
  }).join(', ');
}

/** Materials in material order: "2 Copper ore, 1 Tin ore". */
export function materialsText(counts: Partial<Record<Material, number>>): string {
  return countsText(counts, '');
}

/** Materials gained, in material order: "+3 Copper ore, +2 Tin ore". */
export function gainedText(counts: Partial<Record<Material, number>>): string {
  return countsText(counts, '+');
}

/** What salvage gives, for an action's label. */
function yieldText(item: Item, stats: Stats): string {
  return gainedText(salvagePay(item, stats));
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

/** The sell and salvage actions, labelled with what sell bonus and salvage yield will pay; `all` for a Gems-tab stack. */
function sellSalvage(state: GameState, item: Loot, all = false): [ActionSpec, ActionSpec] {
  const stats = deriveStats(state);
  return [
    { id: 'sell', label: `Sell${all ? ' all' : ''} (+${formatNumber(sellPay(item, stats))} Gold)`, disabled: false },
    { id: 'salvage', label: `Salvage${all ? ' all' : ''} (${yieldText(item, stats)})`, disabled: false },
  ];
}

/**
 * A map runs from its card (not while another run is going), moves between the bag and the Maps tab, sells, salvages,
 * and is enchanted from it.
 */
function mapActions(state: GameState, target: ItemTarget, item: MapItem): ActionSpec[] {
  const run: ActionSpec = { id: 'run', label: 'Run this map', disabled: state.activity.kind === 'map' };
  const move: ActionSpec = target.where === 'maps'
    ? { id: 'toBag', label: 'To bag', disabled: firstEmpty(state.bag) < 0 }
    : { id: 'toStash', label: 'To Maps tab', disabled: mapTierCount(state, item.tier) >= MAP_TIER_CAP };
  return [run, move, ...sellSalvage(state, item), ...craftActions(state, target)];
}

export function itemActions(state: GameState, target: ItemTarget): ActionSpec[] {
  const item = itemAt(state, target);
  if (item === undefined) return [];
  if (item.type === 'map') return mapActions(state, target, item);
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
  const [sell, salvage] = sellSalvage(state, item, target.where === 'gems');
  if (item.type === 'gem' && target.where === 'gems') {
    const take: ActionSpec = {
      id: 'take', label: `Take to bag (up to ${formatNumber(GEM_BAG_STACK)})`, disabled: !bagTakesGem(state, item),
    };
    return [take, sell, salvage];
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
  return [sell, salvage, toGems];
}

/**
 * What a click does: `'card'` pins the item's card, `'menu'` opens its action card, else the shortcut's action
 * (undefined when the item has none, as worn gear has no sell).
 */
export function actionForIntent(
  actions: readonly ActionSpec[],
  target: ItemTarget,
  intent: ClickIntent,
): ActionSpec | 'card' | 'menu' | undefined {
  const find = (...ids: ActionSpec['id'][]) => actions.find((a) => ids.includes(a.id));
  switch (intent) {
    case 'card': return 'card';
    case 'menu': return 'menu';
    case 'sell':
    case 'salvage':
      // a Gems-tab stack can be huge, so selling or salvaging it always goes through the card
      return target.where === 'gems' ? 'menu' : find(intent);
    case 'move': return find('toStash', 'toBag', 'take');
  }
}

/** The shortcuts a hover card names; stacks in the stash's Gems and Materials tabs only come back to the bag. */
function shortcutLine(target: ItemTarget, item: Item, mac: boolean): string {
  switch (target.where) {
    case 'worn': return 'Shift+click stash · right-click for actions';
    case 'gems':
    case 'materials': return 'Shift+click take to bag · right-click for actions';
    case 'bag':
    case 'stash':
    case 'maps':
      return item.type === 'material'
        ? 'Shift+click move · right-click for actions'
        : `${sellKey(mac)}+click sell · Alt+click salvage · Shift+click move`;
  }
}

/**
 * The muted lines that close a hover card: what the item sells and salvages for (a stack's whole count; none for a
 * material, which does neither), then its shortcuts, with ⌘ for Ctrl on a Mac (`mac`).
 */
export function hoverNotes(state: GameState, target: ItemTarget, item: Item, mac: boolean): string[] {
  const shortcuts = shortcutLine(target, item, mac);
  if (item.type === 'material') return [shortcuts];
  const stats = deriveStats(state);
  const sells = formatNumber(sellPay(item, stats));
  return [`Sells for ${sells} Gold · Salvages into ${materialsText(salvagePay(item, stats))}`, shortcuts];
}

/** A note an action card shows under the item's lines: a gem is socketed by dragging it, so its card lists no gear. */
export function menuNote(item: Item): string | null {
  return item.type === 'gem' ? 'Drag it onto an item with a free socket to socket it.' : null;
}

/** Lines a hover card adds under the item's own, which its action card leaves out. */
export function hoverLines(item: Item): ViewLine[] {
  if (item.type !== 'map') return [];
  return [{
    text: 'Enchanting never changes the dungeon itself; it scales the monsters and the rewards. Dying still loses the map.',
    tone: 'muted',
  }];
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
    case 'run': return item.type === 'map' ? store.startMap(item.id) : 'invalid';
    case 'soulUpgrade': return store.soulUpgrade(target) === 'ok' ? 'ok' : 'craftRefused';
    case 'craft':
      if (action.kind === undefined) return 'invalid';
      return store.craft(target, action.kind).check === 'ok' ? 'ok' : 'craftRefused';
  }
}

/** The status line after a Soul upgrade: why it was refused; null for a success, which the card's label shows. */
export function soulUpgradeResultText(r: SoulUpgradeCheck): string | null {
  switch (r) {
    case 'ok': return null;
    case 'noSouls': return 'Not enough Souls.';
    case 'maxLevel': return "It can't go any higher.";
    case 'sealed': return "It was tempered and can't be upgraded any more.";
    case 'notBattle': return 'Only battle gear takes Souls.';
    case 'invalid': return 'Only gear can be upgraded.';
  }
}

/**
 * The map whose tier a move from `from` (to `to`, for a drop) puts a map in: the bag map a Maps-tab map swaps with,
 * else the moved map. Read it before the move, for the status line if the tier refuses.
 */
export function refusedMap(state: GameState, from: ItemLoc, to?: DropTarget): MapItem | undefined {
  const there = to === undefined || to.where === 'stashTab' ? undefined : itemAt(state, to);
  if (from.where === 'maps' && there?.type === 'map') return there;
  const moved = itemAt(state, from);
  return moved?.type === 'map' ? moved : undefined;
}

/** The status line after a move; a full map tier is named by `map`, the map it refused (see `refusedMap`). */
export function resultText(r: InvResult, map?: MapItem): string | null {
  switch (r) {
    case 'bagFull': return 'The bag is full.';
    case 'stashFull': return 'The stash is full.';
    case 'mapTierFull':
      // only a map is ever refused for a full tier, so a caller always has one to name
      if (map === undefined) throw new Error('a full map tier needs the refused map to name it');
      return `The tier ${formatNumber(map.tier)} maps are full.`;
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
