import { describe, expect, it } from 'vitest';
import { BAG_SIZE, STOCK_SIZE } from '../../src/core/balance';
import { itemName } from '../../src/core/itemData';
import { newGame } from '../../src/core/newGame';
import { buyStock, stockBand, stockPrice, traderStock } from '../../src/core/trader';
import type { GameState } from '../../src/core/types';
import { rarityOf } from '../../src/ui/character/itemView';
import {
  buyLabel, buyRefusalHolds, buyResultText, exchangeOffer, exchangeOffers, gambleResultText,
  gambleSlots, gambledLine, MERCHANTS, orbOffers, refinerResultText, stockCaption, stockTiles,
} from '../../src/ui/merchant/merchantView';
import { gear } from '../helpers/items';

it('lists the mining slots, then the battle slots, with their price and whether you can pay it', () => {
  const s = newGame(1, 0);
  s.deepest = 1_100;
  s.gold = 14_700;
  const groups = gambleSlots(s);
  expect(groups.map((g) => g.set)).toEqual(['mining', 'battle']);
  expect(groups[0]?.slots.map((x) => [x.slot, x.label])).toEqual([
    ['pickaxe', 'Pickaxe'], ['lamp', 'Lamp helm'], ['gloves', 'Gloves'], ['boots', 'Boots'],
  ]);
  expect(groups[1]?.slots.map((x) => [x.slot, x.label])).toEqual([
    ['weapon', 'Weapon'], ['armor', 'Armor'], ['helm', 'Helm'], ['ring', 'Ring'], ['amulet', 'Amulet'],
  ]);
  const all = groups.flatMap((g) => g.slots);
  expect(all.every((x) => x.price === 14_700 && x.affordable)).toBe(true);
  s.gold = 14_699;
  expect(gambleSlots(s).flatMap((g) => g.slots).some((x) => x.affordable)).toBe(false);
  s.deepest = 0;
  expect(gambleSlots(s).flatMap((g) => g.slots).every((x) => x.price === 300 && x.affordable)).toBe(true);
});

it('says why a gamble was refused', () => {
  expect(gambleResultText('noGold')).toBe('Not enough Gold.');
  expect(gambleResultText('bagFull')).toBe('Your bag is full.');
  expect(gambleResultText('ok')).toBeNull();
});

it('describes the gambled item', () => {
  const s = newGame(1, 0);
  expect(gambledLine(gear(s, 'gloves', { rarity: 'rare', ilvl: 7 }))).toBe('Rare gloves · item level 7 · now in your bag');
  expect(gambledLine(gear(s, 'lamp', { rarity: 'normal', ilvl: 1_200 }))).toBe('Normal lamp helm · item level 1,200 · now in your bag');
});

describe('the Trader', () => {
  /** A miner at 430 m with Gold to spend; the metres it rolled ahead lie above the new depth, so they go. */
  function at430(): GameState {
    const s = newGame(11, 0);
    s.deepest = 430;
    s.ahead = {};
    s.gold = 10_000_000;
    return s;
  }

  it('names both merchants, whatever the world', () => {
    expect(MERCHANTS.trader).toEqual({ name: 'Brannoc the Trader', sprite: 'brannoc' });
    expect(MERCHANTS.gambler).toEqual({ name: 'Old Mirela', sprite: 'mirela' });
    expect(MERCHANTS.refiner).toEqual({ name: 'Ferrel the Refiner', sprite: 'ferrel' });
  });

  it('says when the stock is next rolled', () => {
    expect(stockCaption(at430())).toBe('New stock every 10 m dug · next at 440 m');
    const s = at430();
    s.deepest = 0;
    expect(stockCaption(s)).toBe('New stock every 10 m dug · next at 10 m');
  });

  it('shows a tile per slot, a bought one as Sold', () => {
    const s = at430();
    const tiles = stockTiles(s);
    expect(tiles).toHaveLength(STOCK_SIZE);
    expect(tiles.map((t) => t.index)).toEqual([...Array(STOCK_SIZE).keys()]);
    const stock = traderStock(s.seed, stockBand(s));
    tiles.forEach((t, i) => {
      const item = stock[i]!;
      expect(t).toEqual({
        index: i, item, name: itemName(item), tone: rarityOf(item), price: stockPrice(item), affordable: true, room: true,
      });
    });
    expect(buyStock(s, 3).result).toBe('ok');
    expect(stockTiles(s)[3]).toMatchObject({ index: 3, item: null, name: 'Sold', tone: 'sold', price: 0 });
    expect(stockTiles(s)[4]?.item).toBe(stock[4]);
  });

  it('marks a tile you are 1 Gold short of, and every tile when the bag is full', () => {
    const s = at430();
    const price = stockTiles(s)[5]!.price;
    s.gold = price - 1;
    expect(stockTiles(s)[5]?.affordable).toBe(false);
    s.gold = price;
    expect(stockTiles(s)[5]?.affordable).toBe(true);
    s.bag = s.bag.map(() => gear(s, 'gloves'));
    expect(s.bag).toHaveLength(BAG_SIZE);
    expect(stockTiles(s).some((t) => t.room)).toBe(false);
  });

  it('labels the Buy button and says why a buy was refused', () => {
    expect(buyLabel(1_240)).toBe('Buy · 1,240 Gold');
    expect(buyResultText('ok')).toBeNull();
    expect(buyResultText('sold')).toBe('That one is sold.');
    expect(buyResultText('noGold')).toBe('Not enough Gold.');
    expect(buyResultText('bagFull')).toBe('Your bag is full.');
    expect(buyResultText('invalid')).toBe("That can't be bought.");
  });

  it('keeps a refusal only while it still holds', () => {
    const s = at430();
    const price = stockTiles(s)[2]!.price;
    s.gold = price - 1;
    expect(buyRefusalHolds(s, 2, 'noGold')).toBe(true);
    s.gold = price;
    expect(buyRefusalHolds(s, 2, 'noGold')).toBe(false);
    expect(buyRefusalHolds(s, 2, 'sold')).toBe(false);
    expect(buyRefusalHolds(s, 2, 'bagFull')).toBe(false);
    expect(buyStock(s, 2).result).toBe('ok');
    expect(buyRefusalHolds(s, 2, 'sold')).toBe(true);
    expect(buyRefusalHolds(s, 2, 'noGold')).toBe(false);
    s.bag = s.bag.map(() => gear(s, 'boots'));
    expect(buyRefusalHolds(s, 2, 'bagFull')).toBe(true);
    expect(buyRefusalHolds(s, 2, 'ok')).toBe(false);
  });
});

describe('the Refiner', () => {
  it('sells the 11 orbs in two groups, each tile with its sprite, name, effect and ore cost', () => {
    const s = newGame(1, 0);
    const groups = orbOffers(s);
    expect(groups.map((g) => g.key)).toEqual(['crafting', 'misc']);
    expect(groups.map((g) => g.title)).toEqual(['Crafting orbs', 'Misc orbs']);
    expect(groups.flatMap((g) => g.offers)).toHaveLength(11);
    const craft = groups[0]?.offers ?? [];
    expect(craft.map((o) => [o.tier, o.side, o.cost, o.ore])).toEqual([
      ['minor', 'prefix', 2, 'iron'], ['normal', 'prefix', 3, 'mithril'], ['greater', 'prefix', 4, 'voidCrystal'],
      ['minor', 'suffix', 2, 'iron'], ['normal', 'suffix', 3, 'mithril'], ['greater', 'suffix', 4, 'voidCrystal'],
    ]);
    expect(craft.map((o) => o.name)).toEqual([
      'Flint Orb', 'Jasper Orb', 'Sunstone Orb', 'Shale Orb', 'Amber Orb', 'Moonstone Orb',
    ]);
    expect(craft[0]?.sprite).toBe('orbPrefixMinor');
    expect(craft[0]?.effect).toContain('prefix');
    const misc = groups[1]?.offers ?? [];
    expect(misc.map((o) => [o.family, o.side, o.tier, o.cost, o.ore])).toEqual([
      ['removal', 'prefix', undefined, 3, 'mithril'], ['removal', 'suffix', undefined, 3, 'mithril'],
      ['scattering', undefined, undefined, 6, 'mithril'],
      ['socketing', undefined, undefined, 2, 'iron'],
      ['clearSockets', undefined, undefined, 2, 'mithril'],
    ]);
    expect(misc.find((o) => o.family === 'scattering')?.sprite).toBe('orbScatterNormal');
    expect(misc.find((o) => o.family === 'scattering')?.effect).toContain('value');
    expect(groups.flatMap((g) => g.offers).every((o) => !o.affordable)).toBe(true);
    s.stash.materials.iron = 3;
    expect(orbOffers(s).flatMap((g) => g.offers).filter((o) => o.ore === 'iron').every((o) => o.affordable)).toBe(true);
  });

  it('the exchange panel shows the premium-raised cost', () => {
    const s = newGame(1, 0);
    expect(exchangeOffers(s).find((e) => e.up && e.from === 'copper'))
      .toMatchObject({ from: 'copper', to: 'tin', amount: 1, base: 4, cost: 4 });
    s.oreMarket.premium.tin = 0.25;
    expect(exchangeOffers(s).find((e) => e.up && e.from === 'copper'))
      .toMatchObject({ from: 'copper', to: 'tin', base: 4, cost: 5 });
  });

  it('offers every ore for every ore, with the ladder rate for the distance', () => {
    const s = newGame(1, 0);
    expect(exchangeOffers(s)).toHaveLength(8 * 7);
    expect(exchangeOffer(s, 'copper', 'copper')).toBeNull();
    // four rungs up is 4^4 : 1; four rungs down is 1 : 3^4.
    expect(exchangeOffer(s, 'copper', 'mithril')).toMatchObject({ from: 'copper', to: 'mithril', base: 256, amount: 1, up: true });
    expect(exchangeOffer(s, 'mithril', 'copper')).toMatchObject({ from: 'mithril', to: 'copper', base: 1, amount: 81, up: false });
  });

  it('says why a buy or exchange was refused', () => {
    expect(refinerResultText('ok')).toBeNull();
    expect(refinerResultText('short')).toBe('Not enough ore.');
    expect(refinerResultText('invalid')).toBe("That can't be traded.");
  });
});
