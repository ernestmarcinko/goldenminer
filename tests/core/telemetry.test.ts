import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../src/core/achievements';
import { ascend } from '../../src/core/ascend';
import { ASCEND_LEVEL, BAG_SIZE } from '../../src/core/balance';
import { advance } from '../../src/core/clock';
import { applyTicks, collect, finishMetre } from '../../src/core/dig';
import { BATTLE_SLOTS, GEM_GRADES, GEM_TYPES, MATERIALS } from '../../src/core/items';
import { rollGear } from '../../src/core/itemGen';
import { receiveItem, receiveMaterial, sellFind } from '../../src/core/loot';
import { addMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { tradeOres } from '../../src/core/oreMarket';
import { deriveStats } from '../../src/core/stats';
import { emptyLifetimeStats, totalGemsFound } from '../../src/core/telemetry';
import { gem, stashMap } from '../helpers/items';

describe('emptyLifetimeStats', () => {
  it('has exactly the MATERIALS keys in the ore ledgers and the GEM_TYPES × GEM_GRADES keys in gemsFound', () => {
    const stats = emptyLifetimeStats();
    expect(Object.keys(stats.oresFound)).toEqual([...MATERIALS]);
    expect(Object.keys(stats.oresTraded)).toEqual([...MATERIALS]);
    expect(MATERIALS.every((m) => stats.oresFound[m] === 0 && stats.oresTraded[m] === 0)).toBe(true);
    expect(Object.keys(stats.gemsFound)).toEqual([...GEM_TYPES]);
    expect(GEM_TYPES.every((t) => Object.keys(stats.gemsFound[t]).join() === GEM_GRADES.join())).toBe(true);
    expect(GEM_TYPES.every((t) => GEM_GRADES.every((g) => stats.gemsFound[t][g] === 0))).toBe(true);
  });

  it('newGame produces a valid, all-zero ledger', () => {
    expect(newGame(1, 0).stats).toEqual(emptyLifetimeStats());
  });
});

describe('counter hooks', () => {
  const stats = deriveStats(newGame(1, 0));

  it('a gold vein and a diamond vein count found currency, and a chest counts as opened', () => {
    const s = newGame(1, 0);
    collect(s, { feature: 'goldVein', amount: 100, hardRock: false }, 1, 1, stats);
    collect(s, { feature: 'diamondVein', amount: 100, hardRock: false }, 2, 1, stats);
    collect(s, { feature: 'chest', amount: 0, hardRock: false }, 3, 1, stats);
    expect(s.stats.goldFound).toBeGreaterThan(0);
    expect(s.stats.diamondsFound).toBeGreaterThan(0);
    expect(s.stats.chestsOpened).toBe(1);
  });

  it('finishing a metre counts metresDug', () => {
    const s = newGame(1, 0);
    expect(s.stats.metresDug).toBe(0);
    finishMetre(s, 1, { feature: null, amount: 0, hardRock: false }, stats);
    expect(s.stats.metresDug).toBe(1);
  });

  it('a found material counts the right ore, and a market trade counts the received ore', () => {
    const s = newGame(1, 0);
    receiveMaterial(s, 'copper', 5, { kind: 'metre', metre: 1 });
    expect(s.stats.oresFound.copper).toBe(5);
    s.stash.materials.copper = 8;
    expect(tradeOres(s, 'copper', 'tin', 2)).toBe('ok');
    expect(s.stats.oresTraded.tin).toBe(2);
  });

  it('a found gem counts its total and its type-and-grade, and a sale counts goldFromSales', () => {
    const s = newGame(1, 0);
    receiveItem(s, gem(s, 'ruby', { grade: 'small', count: 3 }), { kind: 'metre', metre: 1 });
    expect(s.stats.gems).toBe(3);
    expect(s.stats.gemsFound.ruby.small).toBe(3);
    expect(totalGemsFound(s.stats)).toBe(3);
    const before = s.stats.goldFromSales;
    sellFind(s, gem(s, 'sapphire', { count: 1 }));
    expect(s.stats.goldFromSales).toBeGreaterThan(before);
  });

  it('a found map counts mapsFound', () => {
    const s = newGame(1, 0);
    addMap(s, 1, 1);
    expect(s.stats.mapsFound).toBe(1);
  });

  it('a map run counts kills, boss kills, souls, gold and a clear', () => {
    const s = newGame(1, 0);
    s.level = 20;
    for (const slot of BATTLE_SLOTS) s.equipped.battle[slot] = rollGear(s, 8, 'battle', 'magic', slot);
    const map = stashMap(s, 1, 2);
    expect(startMap(s, map.id)).toBe('ok');
    const battle = deriveStats(s);
    let guard = 0;
    while (s.activity.kind === 'map' && guard++ < 20_000) {
      applyTicks(s, 10, battle);
      s.bag = Array.from({ length: BAG_SIZE }, () => null);
      s.overflow = [];
    }
    expect(s.lastRun?.outcome).toBe('cleared');
    expect(s.stats.mapsCleared).toBe(1);
    expect(s.stats.bossKills).toBeGreaterThanOrEqual(1);
    expect(s.stats.monstersKilled).toBeGreaterThanOrEqual(1);
    expect(s.stats.soulsEarned).toBeGreaterThan(0);
    expect(s.stats.goldFound).toBeGreaterThan(0);
  });
});

describe('time tracking', () => {
  it('advance adds live elapsed to timePlayedMs and away elapsed to timeAwayMs', () => {
    const live = newGame(1, 0);
    advance(live, 2500, deriveStats(live));
    expect(live.stats.timePlayedMs).toBe(2500);
    expect(live.stats.timeAwayMs).toBe(0);

    const away = newGame(1, 0);
    advance(away, 2500, deriveStats(away), undefined, false, true);
    expect(away.stats.timePlayedMs).toBe(0);
    expect(away.stats.timeAwayMs).toBe(2500);
  });

  it('a zero tick rate still accumulates played time', () => {
    const s = newGame(1, 0);
    const stats = deriveStats(s);
    expect(advance(s, 5000, { ...stats, autoTicksPerSecond: 0 })).toBe(0);
    expect(s.stats.timePlayedMs).toBe(5000);
  });

  it('dig ticks split deterministically into mining/combat/idle buckets', () => {
    const base = newGame(1, 0);
    const stats = deriveStats(base);
    const dtMs = 1000 / stats.autoTicksPerSecond;

    const dig = newGame(1, 0);
    applyTicks(dig, 100, stats);
    expect(dig.stats.timeDiggingMs + dig.stats.timeCombatMs + dig.stats.timeIdleMs).toBeCloseTo(100 * dtMs);
    expect(dig.stats.timeCombatMs).toBe(0);
    expect(dig.stats.timeIdleMs).toBe(0);

    const paused = newGame(1, 0);
    applyTicks(paused, 10, stats, [], true);
    expect(paused.stats.timeIdleMs).toBeCloseTo(10 * dtMs);

    const combat = newGame(1, 0);
    const map = stashMap(combat, 1, 2);
    expect(startMap(combat, map.id)).toBe('ok');
    applyTicks(combat, 5, stats);
    expect(combat.stats.timeCombatMs).toBeCloseTo(5 * dtMs);
  });
});

describe('purity', () => {
  it('the stats hooks never read or advance the RNG streams', () => {
    const seed = 98765;
    // Pre-earn every achievement so the boost (which reads achievements, never the ledger) is constant: then two runs
    // that differ only in their stats values must take the identical path and draw the identical RNG stream.
    const make = (perturb: boolean) => {
      const s = newGame(seed, 0);
      s.achievements.earned = ACHIEVEMENTS.map((a) => a.id);
      if (perturb) {
        s.stats.goldFound = 123456;
        s.stats.metresDug = 98765;
        s.stats.monstersKilled = 5555;
        for (const m of MATERIALS) { s.stats.oresFound[m] = 999; s.stats.oresTraded[m] = 999; }
        for (const t of GEM_TYPES) for (const g of GEM_GRADES) s.stats.gemsFound[t][g] = 999;
      }
      const stats = deriveStats(s);
      for (let t = 0; t < 5000 && s.deepest < 120; t++) applyTicks(s, 1, stats);
      return { rng: s.rng, uniqueRng: s.uniqueRng };
    };
    expect(make(true)).toEqual(make(false));
  });

  it('ascension preserves the lifetime stats ledger', () => {
    const s = newGame(1, 0);
    s.stats.metresDug = 42;
    s.level = ASCEND_LEVEL;
    expect(ascend(s)).toBe('ok');
    expect(s.stats.metresDug).toBe(42);
  });
});
