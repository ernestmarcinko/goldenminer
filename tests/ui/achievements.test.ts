import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, checkAchievements } from '../../src/core/achievements';
import { newGame } from '../../src/core/newGame';
import { achievementBoostPercent, achievementVMs } from '../../src/ui/achievements/achievementsView';

describe('the achievements tab view model', () => {
  it('groups every achievement by family, nothing earned on a fresh game', () => {
    const s = newGame(1, 0);
    const families = achievementVMs(s);
    expect(families).toHaveLength(Object.keys(FAMILY_LABELS).length);
    expect(families.reduce((n, f) => n + f.achievements.length, 0)).toBe(ACHIEVEMENTS.length);
    expect(families.every((f) => f.earned === 0 && f.achievements.every((a) => !a.earned))).toBe(true);
  });

  it('marks earned achievements and reports per-family progress', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 1000;
    checkAchievements(s, 'gold');
    const gold = achievementVMs(s).find((f) => f.family === 'gold');
    expect(gold?.earned).toBeGreaterThan(0);
    expect(gold?.achievements.find((a) => a.id === 'gold.100')?.earned).toBe(true);
    expect(gold?.achievements.some((a) => !a.earned)).toBe(true);
  });

  it('the boost percent is 0.5 × earned', () => {
    const s = newGame(1, 0);
    expect(achievementBoostPercent(s)).toBe(0);
    s.achievements.earned = ACHIEVEMENTS.slice(0, 100).map((a) => a.id);
    expect(achievementBoostPercent(s)).toBeCloseTo(ACHIEVEMENT_BOOST * 100 * 100);
  });
});
