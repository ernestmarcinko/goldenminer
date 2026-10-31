import { describe, expect, it } from 'vitest';
import { applyTicks } from '../../src/core/dig';
import { PREMIUM_CAP, PREMIUM_DECAY_KEEP, PREMIUM_STEP, orbCost, orbOre, orbTierBand } from '../../src/core/balance';
import { buyOrb, costOf, decayPremiums, emptyPremium, tradeOres } from '../../src/core/oreMarket';
import { ORBS } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GameState } from '../../src/core/types';

describe('the orb catalogue and bands', () => {
  it('has exactly 11 orbs with 11 unique names', () => {
    expect(ORBS).toHaveLength(11);
    expect(new Set(ORBS.map((o) => o.name)).size).toBe(11);
  });

  it('orbTierBand splits a cap into thirds', () => {
    expect(orbTierBand('minor', 9)).toEqual([1, 3]);
    expect(orbTierBand('normal', 9)).toEqual([4, 6]);
    expect(orbTierBand('greater', 9)).toEqual([7, 11]);
    expect(orbTierBand('minor', 1)).toEqual([1, 1]);
    expect(orbTierBand('greater', 1)).toEqual([1, 3]);
  });

  it('orb costs and ores: only craft orbs are tiered, everything else is untiered', () => {
    expect(orbOre('craft', 'prefix', 'minor')).toBe('iron');
    expect(orbCost('craft', 'prefix', 'minor')).toBe(2);
    expect(orbOre('craft', 'suffix', 'greater')).toBe('voidCrystal');
    expect(orbCost('craft', 'suffix', 'greater')).toBe(4);
    expect(orbOre('removal', 'prefix', undefined)).toBe('mithril');
    expect(orbCost('removal', 'suffix', undefined)).toBe(3);
    expect(orbOre('scattering', undefined, undefined)).toBe('mithril');
    expect(orbCost('scattering', undefined, undefined)).toBe(6);
    expect(orbOre('socketing', undefined, undefined)).toBe('iron');
    expect(orbCost('socketing', undefined, undefined)).toBe(2);
    expect(orbOre('clearSockets', undefined, undefined)).toBe('mithril');
    expect(orbCost('clearSockets', undefined, undefined)).toBe(2);
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

  it('refuses the same ore or a bad amount, and changes nothing', () => {
    const s = newGame(1, 0);
    s.stash.materials.copper = 100;
    for (const args of [
      ['copper', 'copper', 1], ['copper', 'tin', 0], ['copper', 'tin', 1.5], ['copper', 'tin', -1],
    ] as const) {
      expect(tradeOres(s, args[0], args[1], args[2]), args.join()).toBe('invalid');
    }
    expect(s.stash.materials.copper).toBe(100);
  });

  it('trades any ore for any ore: 4 : 1 per rung up, 1 : 3 per rung down', () => {
    const s = newGame(1, 0);
    // copper (0) → mithril (4): four rungs up, so 4^4 = 256 copper for 1 mithril.
    s.stash.materials.copper = 256;
    expect(tradeOres(s, 'copper', 'mithril', 1)).toBe('ok');
    expect([s.stash.materials.copper, s.stash.materials.mithril]).toEqual([0, 1]);
    // mithril → copper: four rungs down, so 1 mithril pays 3^4 = 81 copper.
    s.stash.materials.mithril = 1;
    expect(tradeOres(s, 'mithril', 'copper', 81)).toBe('ok');
    expect([s.stash.materials.mithril, s.stash.materials.copper]).toEqual([0, 81]);
    // copper → tin stays 4 : 1, and a short holding refuses.
    s.stash.materials.copper = 3;
    expect(tradeOres(s, 'copper', 'tin', 1)).toBe('short');
    expect(validateState(s)).toBe(true);
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

describe('buying orbs', () => {
  it('spends the right ore for a family and tier, and never draws from state.rng', () => {
    const s = newGame(1, 0);
    s.stash.materials.iron = 10;
    const { rng, uniqueRng } = s;
    expect(buyOrb(s, 'craft', 'prefix', 'minor')).toBe('ok');   // 2 Iron
    expect(s.stash.materials.iron).toBe(8);
    expect(s.bag[0]).toMatchObject({ type: 'orb', family: 'craft', side: 'prefix', tier: 'minor', count: 1 });
    expect([s.rng, s.uniqueRng]).toEqual([rng, uniqueRng]);
    expect(validateState(s)).toBe(true);
  });

  it('a scattering orb costs 6 Mithril, and refuses when short', () => {
    const s = newGame(1, 0);
    expect(buyOrb(s, 'scattering', undefined, undefined)).toBe('short');
    s.stash.materials.mithril = 6;
    expect(buyOrb(s, 'scattering', undefined, undefined)).toBe('ok');
    expect(s.stash.materials.mithril).toBe(0);
    expect(s.bag[0]).toMatchObject({ type: 'orb', family: 'scattering', count: 1 });
    expect((s.bag[0] as { tier?: unknown }).tier).toBeUndefined();
    expect(validateState(s)).toBe(true);
  });

  it('buys orbs into an existing stack', () => {
    const s = newGame(1, 0);
    s.stash.materials.iron = 4;
    expect(buyOrb(s, 'craft', 'prefix', 'minor')).toBe('ok');
    expect(buyOrb(s, 'craft', 'prefix', 'minor')).toBe('ok');
    expect(s.stash.materials.iron).toBe(0);
    expect(s.bag[0]).toMatchObject({ type: 'orb', family: 'craft', side: 'prefix', tier: 'minor', count: 2 });
    expect(validateState(s)).toBe(true);
  });

  it('a full bag puts the bought orb in the Orbs tab', () => {
    const s = newGame(1, 0);
    for (let i = 0; i < s.bag.length; i++) s.bag[i] = { id: s.nextId++, type: 'material', material: 'copper', count: 1 };
    s.stash.materials.mithril = 10;
    expect(buyOrb(s, 'removal', 'suffix', undefined)).toBe('ok');
    expect(s.stash.orbs['removal:suffix']).toBe(1);
    expect(validateState(s)).toBe(true);
  });
});
