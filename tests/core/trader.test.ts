import { describe, expect, it } from 'vitest';
import { BAG_SIZE, MAGIC_LINE_WEIGHTS, RARE_LINE_WEIGHTS, STOCK_SIZE, TRADER_MAP_SHARE, TRADER_PRICE_MULT } from '../../src/core/balance';
import { itemAt } from '../../src/core/cells';
import type { Item } from '../../src/core/items';
import { sellValue } from '../../src/core/loot';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import {
  boughtIn, buyStock, SALT_TRADER, stockAt, stockBand, stockPrice, stockTier, traderStock, type StockItem,
} from '../../src/core/trader';
import type { GameState } from '../../src/core/types';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { gear } from '../helpers/items';

const counts = (weights: readonly (readonly [number, number])[]): number[] => weights.map(([n]) => n);

/** A miner at `deepest` with Gold to spend; the metres it rolled ahead lie above the new depth, so they go. */
function at(deepest: number, gold = 10_000_000): GameState {
  const s = newGame(11, 0);
  s.deepest = deepest;
  s.ahead = {};
  s.gold = gold;
  return s;
}

describe('the stock', () => {
  it('is a pure function of the seed and the band', () => {
    expect([STOCK_SIZE, TRADER_PRICE_MULT, TRADER_MAP_SHARE, SALT_TRADER]).toEqual([12, 4, 0.25, 0x7ade]);
    const a = traderStock(7, 42);
    expect(structuredClone(traderStock(7, 42))).toEqual(structuredClone(a));
    traderStock(7, 43);
    expect(traderStock(7, 42)).toEqual(a);
    expect(traderStock(7, 43)).not.toEqual(a);
    expect(traderStock(8, 42)).not.toEqual(a);
    expect(a).toHaveLength(12);
    for (const item of a) {
      if (item.type === 'gear') {
        expect(item.ilvl).toBe(stockTier(42));
        expect(item.rarity).not.toBe('legendary');
        continue;
      }
      expect(item.tier).toBe(stockTier(42));
      expect(item.metre).toBe(420);
      expect(['normal', 'magic', 'rare']).toContain(item.rarity);
      expect(item.special).toBeUndefined();
      const allowed = item.rarity === 'normal' ? [0] : item.rarity === 'magic' ? counts(MAGIC_LINE_WEIGHTS) : counts(RARE_LINE_WEIGHTS);
      expect(allowed).toContain(item.mods.length);
    }
    let maps = 0;
    for (let band = 0; band < 200; band++) {
      for (const item of traderStock(7, band)) {
        if (item.type === 'map') maps++;
        else expect(item.rarity).not.toBe('legendary');   // Ernest, 2026-10-26: legendaries never appear in the stock
      }
    }
    expect(maps / (200 * STOCK_SIZE)).toBeGreaterThan(0.15);
    expect(maps / (200 * STOCK_SIZE)).toBeLessThan(0.35);
  });

  it('is rolled at the tier of the band, tier 1 at the surface', () => {
    expect(stockBand({ deepest: 0 })).toBe(0);
    expect(stockBand({ deepest: 419 })).toBe(41);
    expect(stockBand({ deepest: 420 })).toBe(42);
    expect(stockTier(0)).toBe(1);
    expect(traderStock(7, 0).every((i) => (i.type === 'gear' ? i.ilvl : i.tier) === 1)).toBe(true);
    expect(traderStock(7, 0).filter((i) => i.type === 'map').every((i) => i.type === 'map' && i.metre === 1)).toBe(true);
  });

  it('costs 4 × what an item sells for', () => {
    for (const item of traderStock(7, 42)) expect(stockPrice(item)).toBe(4 * sellValue(item));
  });
});

describe('buying', () => {
  it('viewing the stock and buying never touch the loot stream', () => {
    const s = at(419);
    const { rng, uniqueRng, nextId } = s;
    traderStock(s.seed, 41);
    traderStock(s.seed, 99);
    for (let i = 0; i < STOCK_SIZE; i++) itemAt(s, { where: 'stock', index: i });
    expect([s.rng, s.uniqueRng, s.nextId]).toEqual([rng, uniqueRng, nextId]);
    expect(buyStock(s, 3).result).toBe('ok');
    expect([s.rng, s.uniqueRng]).toEqual([rng, uniqueRng]);
  });

  it('a buy takes the price, copies the item into the first empty bag cell with a fresh id, and marks the slot', () => {
    const s = at(419);
    s.bag[0] = gear(s, 'pickaxe');
    s.settings.lootFilter = [{ kind: 'any', action: 'sell' }];
    const index = 5;
    const stock = stockAt(s, index) as StockItem;
    const id = s.nextId;
    const r = buyStock(s, index);
    expect(r.result).toBe('ok');
    expect(s.gold).toBe(10_000_000 - 4 * sellValue(stock));
    const bought = s.bag[1] as Item;
    expect(r.item).toBe(bought);
    expect(bought).toEqual({ ...stock, id });
    expect(s.nextId).toBe(id + 1);
    expect(s.merchant).toEqual({ band: 41, bought: [index] });
    expect(s.drops.at(-1)).toMatchObject({ id, origin: { kind: 'merchant' }, trail: [{ event: 'bag' }] });
    expect(s.lootTally).toEqual({ kept: 0, sold: 0, salvaged: 0 });   // the filter's sell rule never ran
    expect(validateState(s)).toBe(true);
    // the slot is empty until the band changes; another slot still sells
    expect(stockAt(s, index)).toBeUndefined();
    expect(itemAt(s, { where: 'stock', index })).toBeUndefined();
    expect(boughtIn(s)).toEqual([index]);
    const gold = s.gold;
    expect(buyStock(s, index)).toEqual({ result: 'sold' });
    expect(s.gold).toBe(gold);
    expect(buyStock(s, 0).result).toBe('ok');
    expect(s.merchant).toEqual({ band: 41, bought: [index, 0] });
    expect(validateState(s)).toBe(true);
  });

  it('a new band brings a fresh stock with every slot', () => {
    const s = at(419);
    const index = 2;
    const bought = structuredClone(stockAt(s, index));
    expect(buyStock(s, index).result).toBe('ok');
    s.deepest = 420;
    expect(boughtIn(s)).toEqual([]);
    const fresh = stockAt(s, index);
    expect(fresh).toBeDefined();
    expect(fresh).not.toEqual(bought);
    expect(buyStock(s, index).result).toBe('ok');
    expect(s.merchant).toEqual({ band: 42, bought: [index] });
  });

  it('a refusal changes nothing', () => {
    const short = at(419);
    short.gold = stockPrice(stockAt(short, 4) as StockItem) - 1;
    const before = structuredClone(short);
    expect(buyStock(short, 4)).toEqual({ result: 'noGold' });
    expect(short).toEqual(before);

    const full = at(419);
    for (let i = 0; i < BAG_SIZE; i++) full.bag[i] = gear(full, 'boots');
    const fullBefore = structuredClone(full);
    expect(buyStock(full, 4)).toEqual({ result: 'bagFull' });
    expect(full).toEqual(fullBefore);

    const s = at(419);
    const clean = structuredClone(s);
    for (const index of [12, -1, 1.5, Number.NaN]) {
      expect(buyStock(s, index)).toEqual({ result: 'invalid' });
      expect(stockAt(s, index)).toBeUndefined();
    }
    expect(s).toEqual(clean);
  });
});

describe('the store', () => {
  it('buys and bumps the version only on ok', () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    const s = store.state;
    s.deepest = 419;
    s.ahead = {};
    const price = stockPrice(stockAt(s, 0) as StockItem);
    s.gold = price;
    const version = store.version;
    expect(store.buyStock(0)).toBe('ok');
    expect(store.version).toBe(version + 1);
    expect(s.gold).toBe(0);
    expect(store.buyStock(0)).toBe('sold');
    expect(store.buyStock(1)).toBe('noGold');
    expect(store.buyStock(12)).toBe('invalid');
    expect(store.version).toBe(version + 1);
  });
});
