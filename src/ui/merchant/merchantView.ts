import { EXCHANGE_DOWN, EXCHANGE_UP, STOCK_BAND_METRES, STOCK_SIZE, orbCost, orbOre } from '../../core/balance';
import { firstEmpty } from '../../core/cells';
import { MATERIAL_LABELS, itemName } from '../../core/itemData';
import { BATTLE_SLOTS, MATERIALS, MINING_SLOTS, ORBS, type GearItem, type GearSet, type Material, type OrbFamily, type OrbSide, type OrbTier, type Slot } from '../../core/items';
import { costOf, heldMaterial, type MarketResult } from '../../core/oreMarket';
import { gamblePrice, type GambleResult } from '../../core/merchant';
import { stockAt, stockBand, stockPrice, type BuyResult, type StockItem } from '../../core/trader';
import type { GameState } from '../../core/types';
import type { SpriteName } from '../../sprites/atlas';
import { formatNumber } from '../format';
import { SLOT_LABELS, gearKindBase, orbEffectText, orbSprite, rarityOf } from '../character/itemView';

/** The three merchants: the same names and looks in every world. */
export const MERCHANTS: Readonly<Record<'trader' | 'gambler' | 'refiner', { name: string; sprite: SpriteName }>> = {
  trader: { name: 'Brannoc the Trader', sprite: 'brannoc' },
  gambler: { name: 'Old Mirela', sprite: 'mirela' },
  refiner: { name: 'Ferrel the Refiner', sprite: 'ferrel' },
};

/** One orb for sale at the Refiner: its name, what it does, sprite and fixed ore cost. */
export interface OrbOffer {
  family: OrbFamily; side: OrbSide | undefined; tier: OrbTier | undefined;
  name: string; effect: string; sprite: SpriteName; cost: number; ore: Material; oreLabel: string; affordable: boolean;
}
export interface OrbGroup { key: string; title: string; offers: OrbOffer[] }
export interface ExchangeOffer {
  from: Material; to: Material; amount: number; base: number; cost: number; affordable: boolean; up: boolean;
}

const ORB_GROUPS: readonly { key: string; title: string; families: readonly OrbFamily[] }[] = [
  { key: 'crafting', title: 'Crafting orbs', families: ['craft'] },
  { key: 'misc', title: 'Misc orbs', families: ['removal', 'scattering', 'socketing', 'clearSockets'] },
];

/** The 11 orbs in two groups — Crafting and Misc — each tile with its sprite, name, effect and ore cost. */
export function orbOffers(state: GameState): OrbGroup[] {
  return ORB_GROUPS.map((group): OrbGroup => ({
    key: group.key,
    title: group.title,
    offers: ORBS.filter((o) => group.families.includes(o.family)).map((o): OrbOffer => {
      const ore = orbOre(o.family, o.side, o.tier);
      const cost = orbCost(o.family, o.side, o.tier);
      return {
        family: o.family, side: o.side, tier: o.tier, name: o.name,
        effect: orbEffectText({ id: 0, type: 'orb', family: o.family, side: o.side, tier: o.tier, count: 1 }),
        sprite: orbSprite(o.family, o.side, o.tier), cost, ore, oreLabel: MATERIAL_LABELS[ore], affordable: heldMaterial(state, ore) >= cost,
      };
    }),
  }));
}

/** One exchange from `from` to `to`; null for the same ore. `amount` is the units received, `base` the units paid before premium. */
export function exchangeOffer(state: GameState, from: Material, to: Material): ExchangeOffer | null {
  const f = MATERIALS.indexOf(from);
  const t = MATERIALS.indexOf(to);
  const d = t - f;
  if (d === 0) return null;
  const up = d > 0;
  const base = up ? EXCHANGE_UP ** d : 1;
  const amount = up ? 1 : EXCHANGE_DOWN ** -d;
  const cost = up ? Math.ceil(costOf(state, to, base)) : Math.ceil(costOf(state, to, 1));
  return { from, to, amount, base, cost, affordable: heldMaterial(state, from) >= cost, up };
}

/** Every ore exchange, every ore to every ore, with their premium-scaled costs. */
export function exchangeOffers(state: GameState): ExchangeOffer[] {
  const offers: ExchangeOffer[] = [];
  for (const from of MATERIALS) {
    for (const to of MATERIALS) {
      const offer = exchangeOffer(state, from, to);
      if (offer !== null) offers.push(offer);
    }
  }
  return offers;
}

/** Why a Refiner buy or exchange was refused; null for an 'ok'. */
export function refinerResultText(r: MarketResult): string | null {
  switch (r) {
    case 'ok': return null;
    case 'short': return 'Not enough ore.';
    case 'invalid': return "That can't be traded.";
  }
}

/** Under the Trader's name: when his stock is rolled again, e.g. "New stock every 10 m dug · next at 440 m". */
export function stockCaption(state: GameState): string {
  const next = (stockBand(state) + 1) * STOCK_BAND_METRES;
  return `New stock every ${formatNumber(STOCK_BAND_METRES)} m dug · next at ${formatNumber(next)} m`;
}

export interface StockTile {
  index: number;
  /** null once bought: the tile stays, reading Sold, so nothing moves under the pointer. */
  item: StockItem | null;
  name: string;
  tone: ReturnType<typeof rarityOf> | 'sold';
  price: number;
  affordable: boolean;
  /** The bag has a free cell for it. */
  room: boolean;
}

/** One tile per slot of the stock, in order. */
export function stockTiles(state: GameState): StockTile[] {
  const room = firstEmpty(state.bag) >= 0;
  return Array.from({ length: STOCK_SIZE }, (_, index): StockTile => {
    const item = stockAt(state, index) ?? null;
    if (item === null) return { index, item, name: 'Sold', tone: 'sold', price: 0, affordable: false, room };
    const price = stockPrice(item);
    return { index, item, name: itemName(item), tone: rarityOf(item), price, affordable: state.gold >= price, room };
  });
}

export function buyLabel(price: number): string {
  return `Buy · ${formatNumber(price)} Gold`;
}

/** Why a buy was refused; an 'ok' needs no words, the tile reads Sold. */
export function buyResultText(r: BuyResult): string | null {
  switch (r) {
    case 'ok': return null;
    case 'sold': return 'That one is sold.';
    case 'noGold': return 'Not enough Gold.';
    case 'bagFull': return 'Your bag is full.';
    case 'invalid': return "That can't be bought.";
  }
}

/**
 * Whether a refused buy of slot `index` is still refused for the same reason, so its words never contradict a Buy
 * button that Gold or room has since enabled.
 */
export function buyRefusalHolds(state: GameState, index: number, r: BuyResult): boolean {
  switch (r) {
    case 'ok': return false;
    case 'sold': return stockAt(state, index) === undefined;
    case 'noGold': {
      const item = stockAt(state, index);
      return item !== undefined && state.gold < stockPrice(item);
    }
    case 'bagFull': return firstEmpty(state.bag) < 0;
    case 'invalid': return true;
  }
}

export interface GambleSlot { slot: Slot; label: string; price: number; affordable: boolean }
export interface GambleGroup { set: GearSet; slots: GambleSlot[] }

/** The slots the merchant gambles on, mining gear then battle gear, each at today's price. */
export function gambleSlots(state: GameState): GambleGroup[] {
  const price = gamblePrice(state);
  const row = (slot: Slot): GambleSlot => ({ slot, label: SLOT_LABELS[slot], price, affordable: state.gold >= price });
  return [
    { set: 'mining', slots: MINING_SLOTS.map(row) },
    { set: 'battle', slots: BATTLE_SLOTS.map(row) },
  ];
}

/** Why a gamble was refused; an 'ok' needs no words, the "You got" panel shows the item. */
export function gambleResultText(r: GambleResult): string | null {
  switch (r) {
    case 'ok': return null;
    case 'noGold': return 'Not enough Gold.';
    case 'bagFull': return 'Your bag is full.';
  }
}

/** The "You got" panel's line under the item's name, e.g. "Rare gloves · item level 7 · now in your bag". */
export function gambledLine(item: GearItem): string {
  return `${gearKindBase(item)} · now in your bag`;
}
