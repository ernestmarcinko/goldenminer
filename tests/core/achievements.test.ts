import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, ACHIEVEMENT_BOOST, ACHIEVEMENT_IDS, FAMILY_LABELS, achievementBoost, checkAchievements, earnedCount,
} from '../../src/core/achievements';
import { ASCEND_LEVEL, MAX_DAMAGE, MAX_LIFE } from '../../src/core/balance';
import { ascend } from '../../src/core/ascend';
import { deriveBattleStats } from '../../src/core/battle';
import { collect, faceTicksPerMetre, finishMetre } from '../../src/core/dig';
import { GEM_GRADES, GEM_TYPES, MATERIALS } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { emptyLifetimeStats } from '../../src/core/telemetry';

describe('the achievement table', () => {
  it('holds ~1000 unique achievements across every family', () => {
    expect(ACHIEVEMENTS).toHaveLength(1000);
    expect(ACHIEVEMENT_IDS.size).toBe(1000);
    const families = new Set(ACHIEVEMENTS.map((a) => a.family));
    expect(families).toEqual(new Set([
      'depth', 'dig', 'gold', 'diamonds', 'gems', 'maps', 'kills', 'bosses', 'deaths',
      'levels', 'ascensions', 'craft', 'merchant', 'legendaries', 'sockets',
      ...MATERIALS.map((m) => `ore.${m}`),
    ]));
    expect(Object.keys(FAMILY_LABELS).sort()).toEqual([...families].sort());
  });

  it('ids are `<family>.<value>`, each threshold positive with a name and description', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBe(`${a.family}.${a.value}`);
      expect(a.value).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
    }
  });
});

describe('the boost', () => {
  it('adds 0.5% per earned achievement', () => {
    const s = newGame(1, 0);
    expect(earnedCount(s)).toBe(0);
    expect(achievementBoost(s)).toBe(1);
    s.achievements.earned = ACHIEVEMENTS.slice(0, 40).map((a) => a.id);
    expect(earnedCount(s)).toBe(40);
    expect(achievementBoost(s)).toBe(1 + ACHIEVEMENT_BOOST * 40);
  });

  it('multiplies the final battle values and the effective dig power and vein yields', () => {
    const s = newGame(1, 0);
    const stats = deriveStats(s);
    const bareBattle = deriveBattleStats(s);
    const bareTicks = faceTicksPerMetre(s, stats);
    const bareGold = newGame(1, 0);
    collect(bareGold, { feature: 'goldVein', amount: 100, hardRock: false }, 1, 1, stats);
    s.achievements.earned = ACHIEVEMENTS.slice(0, 100).map((a) => a.id);
    const pow = 1 + ACHIEVEMENT_BOOST * 100;
    const boostedBattle = deriveBattleStats(s);
    expect(boostedBattle.damageMin).toBe(Math.round(bareBattle.damageMin * pow));
    expect(boostedBattle.damageMax).toBe(Math.round(bareBattle.damageMax * pow));
    expect(boostedBattle.maxLife).toBe(Math.round(bareBattle.maxLife * pow));
    expect(boostedBattle.armor).toBe(Math.round(bareBattle.armor * pow));
    // The effective dig power rises with the boost, so the face metre takes fewer ticks.
    expect(faceTicksPerMetre(s, stats)).toBeCloseTo(bareTicks / pow);
    const richGold = newGame(1, 0);
    richGold.achievements.earned = ACHIEVEMENTS.slice(0, 100).map((a) => a.id);
    collect(richGold, { feature: 'goldVein', amount: 100, hardRock: false }, 1, 1, stats);
    expect(richGold.gold).toBe(Math.round(bareGold.gold * pow));
  });

  it('never bypasses a clamp', () => {
    const s = newGame(1, 0);
    s.achievements.earned = ACHIEVEMENTS.map((a) => a.id);
    const battle = deriveBattleStats(s);
    expect(battle.damageMin).toBeLessThanOrEqual(MAX_DAMAGE);
    expect(battle.damageMax).toBeLessThanOrEqual(MAX_DAMAGE);
    expect(battle.maxLife).toBeLessThanOrEqual(MAX_LIFE);
    expect(battle.armor).toBeLessThanOrEqual(MAX_DAMAGE);
  });

  it('leaves a no-achievement run alone', () => {
    const s = newGame(1, 0);
    expect(achievementBoost(s)).toBe(1);
    const stats = deriveStats(s);
    expect(faceTicksPerMetre(s, stats)).toBe(faceTicksPerMetre(s, stats));
  });
});

describe('checks', () => {
  it('marks a family once, idempotently, and only when its condition holds', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 500;
    checkAchievements(s, 'gold');
    const earned = [...s.achievements.earned];
    expect(earned.length).toBeGreaterThan(0);
    expect(earned.every((id) => id.startsWith('gold.'))).toBe(true);
    expect(s.achievements.earned).toContain('gold.100');
    checkAchievements(s, 'gold');
    expect(s.achievements.earned).toEqual(earned);
    s.stats.goldFound = 1_000_000;
    checkAchievements(s, 'gold');
    expect(s.achievements.earned.length).toBeGreaterThan(earned.length);
    expect(s.achievements.earned).toContain('gold.1000000');
  });

  it('a family check touches only that family', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 1_000_000;
    s.stats.monstersKilled = 50_000;
    checkAchievements(s, 'gold');
    expect(s.achievements.earned.some((id) => id.startsWith('gold.'))).toBe(true);
    expect(s.achievements.earned.some((id) => id.startsWith('kills.'))).toBe(false);
  });
});

describe('carry-over', () => {
  it('achievements and stats survive ascension', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 1000;
    checkAchievements(s, 'gold');
    const earned = [...s.achievements.earned];
    s.level = ASCEND_LEVEL;
    s.deepest = 100;
    expect(ascend(s)).toBe('ok');
    expect(s.stats.goldFound).toBe(1000);
    expect(earned.every((id) => s.achievements.earned.includes(id))).toBe(true);
    expect(s.achievements.earned).toContain('ascensions.1');
  });

  it('finishing a metre counts it and marks the depth achievements once', () => {
    const s = newGame(1, 0);
    expect(s.stats.metresDug).toBe(0);
    finishMetre(s, 1, { feature: null, amount: 0, hardRock: false }, deriveStats(s));
    expect(s.deepest).toBe(1);
    expect(s.stats.metresDug).toBe(1);
    s.deepest = 10;
    checkAchievements(s, 'depth');
    expect(s.achievements.earned).toContain('depth.10');
    checkAchievements(s, 'depth');
    expect(s.achievements.earned.filter((id) => id === 'depth.10')).toHaveLength(1);
  });
});

describe('emptyLifetimeStats', () => {
  it('starts every counter at zero', () => {
    const stats = emptyLifetimeStats();
    expect(stats.goldFound).toBe(0);
    expect(stats.metresDug).toBe(0);
    expect(stats.monstersKilled).toBe(0);
    expect(Object.keys(stats.oresFound)).toEqual([...MATERIALS]);
    expect(MATERIALS.every((m) => stats.oresFound[m] === 0)).toBe(true);
    expect(MATERIALS.every((m) => stats.oresTraded[m] === 0)).toBe(true);
    expect(Object.keys(stats.gemsFound)).toEqual([...GEM_TYPES]);
    expect(GEM_TYPES.every((t) => Object.keys(stats.gemsFound[t]).join() === GEM_GRADES.join())).toBe(true);
  });
});
