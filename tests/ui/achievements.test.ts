import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, checkAchievements } from '../../src/core/achievements';
import { newGame } from '../../src/core/newGame';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
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
    s.stats.goldFound = 2_000_000;
    checkAchievements(s, 'gold');
    const gold = achievementVMs(s).find((f) => f.family === 'gold');
    expect(gold?.earned).toBeGreaterThan(0);
    expect(gold?.achievements.find((a) => a.id === 'gold.1000000')?.earned).toBe(true);
    expect(gold?.achievements.some((a) => !a.earned)).toBe(true);
  });

  it('the boost percent is 1 × earned', () => {
    const s = newGame(1, 0);
    expect(achievementBoostPercent(s)).toBe(0);
    s.achievements.earned = ACHIEVEMENTS.slice(0, 100).map((a) => a.id);
    expect(achievementBoostPercent(s)).toBeCloseTo(ACHIEVEMENT_BOOST * 100 * 100);
  });
});

describe('the achievement toast queue', () => {
  function make(now = { t: 0 }, storage = new MemoryStorage()) {
    const store = new GameStore({ storage, storageAvailable: true, now: () => now.t, newSeed: () => 7 });
    return { store, storage, now };
  }

  it('a fresh store starts with an empty queue', () => {
    const { store } = make();
    expect(store.notifications).toEqual([]);
    store.load();
    expect(store.notifications).toEqual([]);
  });

  it('crossing one threshold enqueues exactly one toast with the right desc and icon', () => {
    const { store } = make();
    store.load();
    store.state.stats.goldFound = 1000;
    checkAchievements(store.state, 'gold');
    store.setMotion({}); // any counter-free mutation runs the store's single changed() path
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]).toMatchObject({
      name: ACHIEVEMENTS.find((a) => a.family === 'gold')?.name,
      desc: 'Earn 1,000 Gold over your lifetime.',
      icon: 'goldYield',
    });
  });

  it('crossing three thresholds at once enqueues three, newest on top', () => {
    const { store } = make();
    store.load();
    const gold = ACHIEVEMENTS.filter((a) => a.family === 'gold');
    const first = gold[0];
    const second = gold[1];
    const third = gold[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('the gold family has fewer than three achievements');
    }
    store.state.stats.goldFound = third.value;
    checkAchievements(store.state, 'gold');
    store.setMotion({});
    expect(store.notifications).toHaveLength(3);
    expect(store.notifications.map((n) => n.name)).toEqual([third.name, second.name, first.name]);
    expect(store.notifications.every((n) => n.icon === 'goldYield')).toBe(true);
  });

  it('repeating the same action enqueues nothing', () => {
    const { store } = make();
    store.load();
    store.state.stats.goldFound = 1000;
    checkAchievements(store.state, 'gold');
    store.setMotion({});
    expect(store.notifications).toHaveLength(1);
    checkAchievements(store.state, 'gold');
    store.setMotion({});
    expect(store.notifications).toHaveLength(1);
  });

  it('dismissNotification removes only that id, and dismissAll clears the rest', () => {
    const { store } = make();
    store.load();
    const gold = ACHIEVEMENTS.filter((a) => a.family === 'gold');
    const first = gold[0];
    const second = gold[1];
    const third = gold[2];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('the gold family has fewer than three achievements');
    }
    store.state.stats.goldFound = third.value;
    checkAchievements(store.state, 'gold');
    store.setMotion({});
    const ids = store.notifications.map((n) => n.id);
    expect(ids).toHaveLength(3);
    const middle = ids[1];
    if (middle === undefined) throw new Error('expected a middle notification');
    store.dismissNotification(middle);
    expect(store.notifications.map((n) => n.id)).toEqual([ids[0], ids[2]]);
    store.dismissAll();
    expect(store.notifications).toEqual([]);
  });

  it('reloading a save that already earned an achievement never re-toasts', () => {
    const { store, storage, now } = make();
    store.load();
    store.state.stats.goldFound = 1000;
    checkAchievements(store.state, 'gold');
    store.setMotion({});
    expect(store.notifications).toHaveLength(1);
    store.save();
    const again = make(now, storage).store;
    again.load();
    expect(again.notifications).toEqual([]);
  });
});
