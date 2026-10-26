import { checkAchievements } from './achievements';
import {
  MAGIC_LINE_WEIGHTS, RARE_LINE_WEIGHTS, STOCK_BAND_METRES, STOCK_SIZE, TRADER_MAP_SHARE, TRADER_PRICE_MULT,
} from './balance';
import { metreTier } from './bands';
import { firstEmpty } from './cells';
import { rollMapMods } from './crafting';
import { logDrop } from './dropLog';
import { rollGear, rollRarity, type Gen } from './itemGen';
import type { GearItem, MapItem, MapRarity } from './items';
import { sellValue } from './loot';
import { hashN, nextRandom, pickWeighted } from './rng';
import type { GameState } from './types';

/** What Brannoc the Trader sells: gear and maps, never gems or materials. */
export type StockItem = GearItem | MapItem;
export type BuyResult = 'ok' | 'sold' | 'noGold' | 'bagFull' | 'invalid';

export const SALT_TRADER = 0x7ade;

/** The band of depth the stock belongs to; it is rolled afresh every STOCK_BAND_METRES dug. */
export function stockBand(state: Pick<GameState, 'deepest'>): number {
  return Math.floor(state.deepest / STOCK_BAND_METRES);
}

const stockMetre = (band: number): number => Math.max(1, band * STOCK_BAND_METRES);

/** The item level and map tier of a band's stock: those of its first metre, tier 1 at the surface. */
export function stockTier(band: number): number {
  return metreTier(stockMetre(band));
}

/** Legendaries never appear in the stock (Ernest, 2026-10-26): they come from drops, gambling and a special. */
function stockRarity(gen: Gen): MapRarity {
  const rarity = rollRarity(gen);
  return rarity === 'legendary' ? 'rare' : rarity;
}

function stockMap(gen: Gen, band: number): MapItem {
  const metre = stockMetre(band);
  const map: MapItem = { id: gen.nextId++, type: 'map', tier: metreTier(metre), metre, rarity: stockRarity(gen), mods: [] };
  // as Copper or Silver would give; a special comes only from enchanting
  if (map.rarity === 'magic') map.mods = rollMapMods(gen, map, pickWeighted(gen, MAGIC_LINE_WEIGHTS));
  if (map.rarity === 'rare') map.mods = rollMapMods(gen, map, pickWeighted(gen, RARE_LINE_WEIGHTS));
  return map;
}

let memo: { seed: number; band: number; stock: readonly StockItem[] } | null = null;

/**
 * The stock for a world and a band, from a stream of its own, so looking at it or buying from it never moves the
 * loot stream. The last one is kept, as the view asks for it on every render.
 */
export function traderStock(seed: number, band: number): readonly StockItem[] {
  if (memo !== null && memo.seed === seed && memo.band === band) return memo.stock;
  const gen: Gen = { rng: hashN(seed, SALT_TRADER, band), nextId: 1 };
  const stock: StockItem[] = [];
  for (let i = 0; i < STOCK_SIZE; i++) {
    if (nextRandom(gen) < TRADER_MAP_SHARE) {
      stock.push(stockMap(gen, band));
      continue;
    }
    const set = nextRandom(gen) < 0.5 ? 'mining' : 'battle';
    stock.push(rollGear(gen, stockTier(band), set, stockRarity(gen)));
  }
  memo = { seed, band, stock };
  return stock;
}

/** A sell bonus never changes a price. */
export function stockPrice(item: StockItem): number {
  return TRADER_PRICE_MULT * sellValue(item);
}

/** The slots bought in the current band; a record from an earlier band no longer counts. */
export function boughtIn(state: GameState): readonly number[] {
  return state.merchant.band === stockBand(state) ? state.merchant.bought : [];
}

const stockIndex = (index: number): boolean => Number.isInteger(index) && index >= 0 && index < STOCK_SIZE;

/** The item in a stock slot, undefined when the slot is bought or out of range. */
export function stockAt(state: GameState, index: number): StockItem | undefined {
  if (!stockIndex(index) || boughtIn(state).includes(index)) return undefined;
  return traderStock(state.seed, stockBand(state))[index];
}

/**
 * Buys a stock slot into the first empty bag cell: a copy with a fresh id, which skips the loot filter, as the player
 * chose it. The slot stays bought until the band changes. Every check comes before any change, so a refusal leaves the
 * state as it was.
 */
export function buyStock(state: GameState, index: number): { result: BuyResult; item?: StockItem } {
  if (!stockIndex(index)) return { result: 'invalid' };
  const stock = stockAt(state, index);
  if (stock === undefined) return { result: 'sold' };
  const cell = firstEmpty(state.bag);
  if (cell < 0) return { result: 'bagFull' };
  const price = stockPrice(stock);
  if (state.gold < price) return { result: 'noGold' };
  const item: StockItem = { ...structuredClone(stock), id: state.nextId++ };
  state.merchant = { band: stockBand(state), bought: [...boughtIn(state), index] };
  state.bag[cell] = item;
  state.gold -= price;
  state.totals.buys += 1;
  checkAchievements(state, 'merchant');
  logDrop(state, item, { kind: 'merchant' }, { event: 'bag' });
  return { result: 'ok', item };
}
