import { ESSENCE_COST, EXCHANGE_DOWN, EXCHANGE_UP, ORB_COST, STOCK_BAND_METRES, STOCK_SIZE, oreForTier } from '../../core/balance';
import { firstEmpty } from '../../core/cells';
import { MATERIAL_LABELS, STAT_NAMES, itemName } from '../../core/itemData';
import { ALL_STATS, BATTLE_SLOTS, MATERIALS, MINING_SLOTS, type GearItem, type GearSet, type Material, type OrbSide, type Slot, type StatKey } from '../../core/items';
import { costOf, heldMaterial, type MarketResult } from '../../core/oreMarket';
import { gamblePrice, type GambleResult } from '../../core/merchant';
import { stockAt, stockBand, stockPrice, type BuyResult, type StockItem } from '../../core/trader';
import type { GameState } from '../../core/types';
import type { SpriteName } from '../../sprites/atlas';
import { formatNumber } from '../format';
import { SLOT_LABELS, gearKindBase, rarityOf } from '../character/itemView';

/** The three merchants: the same names and looks in every world. */
export const MERCHANTS: Readonly<Record<'trader' | 'gambler' | 'refiner', { name: string; sprite: SpriteName }>> = {
  trader: { name: 'Brannoc the Trader', sprite: 'brannoc' },
  gambler: { name: 'Old Mirela', sprite: 'mirela' },
  refiner: { name: 'Ferrel the Refiner', sprite: 'ferrel' },
};

/** The Refiner's fixed essence tier ladder: the ore each tier costs and how much of it. */
export interface EssenceTier { tier: number; ore: Material; oreLabel: string; cost: number; held: number; affordable: boolean }
export interface EssenceOffer { stat: StatKey; tier: number; cost: number; affordable: boolean }
export interface OrbOffer { side: OrbSide; label: string; cost: number; affordable: boolean }
export interface ExchangeOffer {
  from: Material; to: Material; amount: number; base: number; cost: number; affordable: boolean; up: boolean;
}

/** The six essence tiers, cheapest first. */
export function essenceTiers(state: GameState): EssenceTier[] {
  const out: EssenceTier[] = [];
  for (let tier = 1; tier <= 6; tier++) {
    const ore = oreForTier(tier);
    if (ore === undefined) continue;
    const cost = ESSENCE_COST[tier] ?? 0;
    const held = heldMaterial(state, ore);
    out.push({ tier, ore, oreLabel: MATERIAL_LABELS[ore], cost, held, affordable: held >= cost });
  }
  return out;
}

/** The essences on sale at one tier: one per stat, all at that tier's price. */
export function essenceOffersForTier(state: GameState, tier: number): EssenceOffer[] {
  const ore = oreForTier(tier);
  const cost = ESSENCE_COST[tier] ?? 0;
  const affordable = ore !== undefined && heldMaterial(state, ore) >= cost;
  return ALL_STATS.map((stat) => ({ stat, tier, cost, affordable }));
}

/** The two orbs, each ORB_COST Iron. */
export function orbOffers(state: GameState): OrbOffer[] {
  const affordable = heldMaterial(state, 'iron') >= ORB_COST;
  return [
    { side: 'prefix', label: 'Prefix orb', cost: ORB_COST, affordable },
    { side: 'suffix', label: 'Suffix orb', cost: ORB_COST, affordable },
  ];
}

/** The adjacent ore exchanges, up-ladder and down-ladder, with their premium-scaled costs. */
export function exchangeOffers(state: GameState): ExchangeOffer[] {
  const offers: ExchangeOffer[] = [];
  for (let i = 0; i < MATERIALS.length - 1; i++) {
    const from = MATERIALS[i];
    const to = MATERIALS[i + 1];
    if (from === undefined || to === undefined) continue;
    const cost = Math.ceil(costOf(state, to, EXCHANGE_UP));
    offers.push({ from, to, amount: 1, base: EXCHANGE_UP, cost, affordable: heldMaterial(state, from) >= cost, up: true });
  }
  for (let i = 1; i < MATERIALS.length; i++) {
    const from = MATERIALS[i];
    const to = MATERIALS[i - 1];
    if (from === undefined || to === undefined) continue;
    const cost = Math.ceil(costOf(state, to, 1));
    offers.push({ from, to, amount: EXCHANGE_DOWN, base: 1, cost, affordable: heldMaterial(state, from) >= cost, up: false });
  }
  return offers;
}

/** The label of an essence offer: its stat name and tier. */
export function essenceOfferLabel(stat: StatKey, tier: number): string {
  return `T${tier} ${STAT_NAMES[stat]} essence`;
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
