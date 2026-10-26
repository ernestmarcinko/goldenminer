import { describe, expect, it } from 'vitest';
import { applyTicks } from '../../src/core/dig';
import { PREMIUM_CAP, PREMIUM_DECAY_KEEP, PREMIUM_STEP, essenceBand, oreForTier } from '../../src/core/balance';
import { buyEssence, buyOrb, costOf, decayPremiums, emptyPremium, tradeOres } from '../../src/core/oreMarket';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GameState } from '../../src/core/types';

describe('oreForTier and the essence band', () => {
  it('maps tiers 1..6 to the deep ores, Copper and Tin aside', () => {
    expect([1, 2, 3, 4, 5, 6].map(oreForTier)).toEqual(['iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal']);
    expect(oreForTier(0)).toBeUndefined();
    expect(oreForTier(7)).toBeUndefined();
  });

  it('an essence of tier T rolls in [T, T+2]', () => {
    expect(essenceBand(4)).toEqual([4, 6]);
  });

  it('an empty premium starts every ore at 0', () => {
    expect(emptyPremium()).toEqual({
      copper: 0, tin: 0, iron: 0, silver: 0, mithril: 0, starsteel: 0, obsidian: 0, voidCrystal: 0,
    });
  });
});

describe('tradeOres', () => {
  it('exchanges 4 : 1 up and 1 : 3 down', () => {
    const s = newGame(1, 0);
    s.stash.materials.copper = 8;
    expect(tradeOres(s, 'copper', 'tin', 2)).toBe('ok');   // 2 tin cost 8 copper
    expect([s.stash.materials.copper, s.stash.materials.tin]).toEqual([0, 2]);
    s.stash.materials.tin = 1;
    expect(tradeOres(s, 'tin', 'copper', 3)).toBe('ok');   // 3 copper cost 1 tin
    expect([s.stash.materials.tin, s.stash.materials.copper]).toEqual([0, 3]);
    expect(validateState(s)).toBe(true);
  });

  it('raises the bought ore\'s premium, so the next buy is dearer, and refuses when short', () => {
    const s = newGame(1, 0);
    s.stash.materials.copper = 4;
    expect(s.oreMarket.premium.tin).toBe(0);
    expect(tradeOres(s, 'copper', 'tin', 1)).toBe('ok');
    expect(s.oreMarket.premium.tin).toBe(PREMIUM_STEP);
    s.stash.materials.copper = 4;                          // the second 1-tin now costs ceil(4 × 1.1) = 5
    expect(tradeOres(s, 'copper', 'tin', 1)).toBe('short');
    s.stash.materials.copper = 5;
    expect(tradeOres(s, 'copper', 'tin', 1)).toBe('ok');
    expect(s.oreMarket.premium.tin).toBeCloseTo(2 * PREMIUM_STEP);
  });

  it('refuses a non-adjacent pair or a bad amount, and changes nothing', () => {
    const s = newGame(1, 0);
    s.stash.materials.copper = 100;
    for (const args of [
      ['copper', 'mithril', 1], ['copper', 'tin', 0], ['copper', 'tin', 1.5], ['copper', 'tin', -1],
    ] as const) {
      expect(tradeOres(s, args[0], args[1], args[2]), args.join()).toBe('invalid');
    }
    expect(s.stash.materials.copper).toBe(100);
  });

  it('buying never draws from state.rng', () => {
    const s = newGame(1, 0);
    s.stash.materials.copper = 8;
    const { rng, uniqueRng } = s;
    expect(tradeOres(s, 'copper', 'tin', 1)).toBe('ok');
    expect([s.rng, s.uniqueRng]).toEqual([rng, uniqueRng]);
  });
});

describe('the premium', () => {
  it('decays toward 0 each applied tick', () => {
    const s = newGame(1, 0);
    s.oreMarket.premium.tin = PREMIUM_CAP;
    decayPremiums(s, 1);
    expect(s.oreMarket.premium.tin).toBeCloseTo(PREMIUM_CAP * PREMIUM_DECAY_KEEP);
    decayPremiums(s, 100);
    expect(s.oreMarket.premium.tin).toBeCloseTo(PREMIUM_CAP * PREMIUM_DECAY_KEEP ** 101);
    decayPremiums(s, 0);
    expect(s.oreMarket.premium.tin).toBeCloseTo(PREMIUM_CAP * PREMIUM_DECAY_KEEP ** 101);
  });

  it('caps at PREMIUM_CAP', () => {
    const s = newGame(1, 0);
    s.oreMarket.premium.tin = PREMIUM_CAP;
    for (let i = 0; i < 10; i++) {
      s.stash.materials.copper = 100;
      expect(tradeOres(s, 'copper', 'tin', 1)).toBe('ok');
    }
    expect(s.oreMarket.premium.tin).toBe(PREMIUM_CAP);
  });

  it('costOf scales by the premium', () => {
    const s = newGame(1, 0);
    expect(costOf(s, 'tin', 4)).toBe(4);
    s.oreMarket.premium.tin = 0.5;
    expect(costOf(s, 'tin', 4)).toBe(6);
  });

  it('applyTicks decays premiums, live and offline alike', () => {
    const s = newGame(1, 0);
    s.oreMarket.premium.iron = 1.0;
    applyTicks(s, 10, deriveStats(s));
    expect(s.oreMarket.premium.iron).toBeCloseTo(PREMIUM_DECAY_KEEP ** 10);
  });
});

describe('buying essences and orbs', () => {
  it('spends the recipe ore and never draws from state.rng', () => {
    const s = newGame(1, 0);
    s.stash.materials.iron = 10;
    const { rng, uniqueRng } = s;
    expect(buyEssence(s, 'digPower', 1)).toBe('ok');        // 1 Iron
    expect(s.stash.materials.iron).toBe(9);
    expect(s.bag[0]).toMatchObject({ type: 'essence', stat: 'digPower', tier: 1, count: 1 });
    expect([s.rng, s.uniqueRng]).toEqual([rng, uniqueRng]);
    expect(validateState(s)).toBe(true);
  });

  it('a tier-6 essence costs its ore, and refuses when short', () => {
    const s = newGame(1, 0);
    expect(buyEssence(s, 'damage', 6)).toBe('short');
    s.stash.materials.voidCrystal = 13;
    expect(buyEssence(s, 'damage', 6)).toBe('ok');
    expect(s.stash.materials.voidCrystal).toBe(0);
    expect(s.bag[0]).toMatchObject({ type: 'essence', stat: 'damage', tier: 6, count: 1 });
  });

  it('rejects a bad tier', () => {
    const s = newGame(1, 0);
    expect(buyEssence(s, 'damage', 0)).toBe('invalid');
    expect(buyEssence(s, 'damage', 7)).toBe('invalid');
    expect(buyEssence(s, 'damage', 2.5)).toBe('invalid');
  });

  it('buys orbs for ORB_COST Iron, topping up an existing stack', () => {
    const s = newGame(1, 0);
    s.stash.materials.iron = 4;
    expect(buyOrb(s, 'prefix')).toBe('ok');
    expect(buyOrb(s, 'prefix')).toBe('ok');
    expect(s.stash.materials.iron).toBe(0);
    expect(s.bag[0]).toMatchObject({ type: 'orb', side: 'prefix', count: 2 });
    expect(validateState(s)).toBe(true);
  });

  it('a full bag puts the bought item in the Essences tab', () => {
    const s = newGame(1, 0);
    for (let i = 0; i < s.bag.length; i++) s.bag[i] = { id: s.nextId++, type: 'material', material: 'copper', count: 1 };
    s.stash.materials.iron = 10;
    expect(buyOrb(s, 'suffix')).toBe('ok');
    expect(s.stash.essences.suffix).toBe(1);
    expect(validateState(s)).toBe(true);
  });
});
