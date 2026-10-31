import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, checkAchievements } from '../../src/core/achievements';
import { newGame } from '../../src/core/newGame';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { HIDDEN_DESC, HIDDEN_NAME, achievementBoostPercent, achievementVMs, type AchievementVM } from '../../src/ui/achievements/achievementsView';

const flat = (groups: ReturnType<typeof achievementVMs>): AchievementVM[] =>
  groups.flatMap((g) => g.families.flatMap((f) => f.achievements));

describe('the achievements tab view model', () => {
  it('lists every achievement exactly once, nothing earned on a fresh game', () => {
    const s = newGame(1, 0);
    const groups = achievementVMs(s);
    const families = groups.flatMap((g) => g.families);
    expect(families).toHaveLength(Object.keys(FAMILY_LABELS).length);
    expect(flat(groups)).toHaveLength(ACHIEVEMENTS.length);
    expect(families.every((f) => f.earned === 0 && f.achievements.every((a) => !a.earned))).toBe(true);
  });

  it('comes in four groups: Milestones, Feats, Collections, Secrets', () => {
    const groups = achievementVMs(newGame(1, 0));
    expect(groups.map((g) => g.label)).toEqual(['Milestones', 'Feats', 'Collections', 'Secrets']);
    expect(groups.map((g) => g.kind)).toEqual(['ladder', 'feat', 'collection', 'hidden']);
    for (const g of groups) {
      expect(g.total).toBe(ACHIEVEMENTS.filter((a) => a.kind === g.kind).length);
      expect(g.families.every((f) => f.achievements.length > 0)).toBe(true);
    }
  });

  it('marks earned achievements and reports per-family progress', () => {
    const s = newGame(1, 0);
    s.stats.goldFound = 2_000_000;
    checkAchievements(s, 'gold');
    const gold = achievementVMs(s).flatMap((g) => g.families).find((f) => f.family === 'gold');
    expect(gold?.earned).toBeGreaterThan(0);
    expect(gold?.achievements.find((a) => a.id === 'gold.1000000')?.earned).toBe(true);
    expect(gold?.achievements.some((a) => !a.earned)).toBe(true);
  });

  it('an unearned secret reads ??? with no real name, description, id or icon anywhere in the view model', () => {
    const s = newGame(1, 0);
    const secrets = achievementVMs(s).find((g) => g.kind === 'hidden');
    const defs = ACHIEVEMENTS.filter((a) => a.kind === 'hidden');
    expect(defs.length).toBeGreaterThan(0);
    expect(secrets?.families.flatMap((f) => f.achievements)).toHaveLength(defs.length);
    for (const vm of secrets?.families.flatMap((f) => f.achievements) ?? []) {
      expect(vm).toMatchObject({ name: '???', desc: 'A secret. Keep playing.', earned: false, hidden: true, icon: null });
    }
    expect(HIDDEN_NAME).toBe('???');
    expect(HIDDEN_DESC).toBe('A secret. Keep playing.');
    const dump = JSON.stringify(achievementVMs(s).find((g) => g.kind === 'hidden'));
    for (const def of defs) {
      expect(dump).not.toContain(def.name);
      expect(dump).not.toContain(def.desc);
      expect(dump).not.toContain(def.id);
    }
  });

  it('only feats, collections and ladders are named before they are earned', () => {
    const groups = achievementVMs(newGame(1, 0));
    for (const g of groups.filter((x) => x.kind !== 'hidden')) {
      for (const vm of g.families.flatMap((f) => f.achievements)) {
        expect(vm.hidden).toBe(false);
        expect(vm.name).not.toBe('???');
      }
    }
  });

  it('an earned secret shows its real name, description and icon', () => {
    const s = newGame(1, 0);
    const def = ACHIEVEMENTS.find((a) => a.kind === 'hidden');
    if (def === undefined) throw new Error('no hidden achievement');
    s.achievements.earned.push(def.id);
    const vm = flat(achievementVMs(s)).find((a) => a.id === def.id);
    expect(vm).toMatchObject({ name: def.name, desc: def.desc, earned: true, hidden: false, kind: 'hidden' });
    expect(vm?.icon).not.toBeNull();
  });

  it('the Secrets group counts earned / total, hidden ones counting toward the total', () => {
    const s = newGame(1, 0);
    const defs = ACHIEVEMENTS.filter((a) => a.kind === 'hidden');
    const find = () => achievementVMs(s).find((g) => g.kind === 'hidden');
    expect(find()).toMatchObject({ earned: 0, total: defs.length });
    for (const def of defs.slice(0, 3)) s.achievements.earned.push(def.id);
    const group = find();
    expect(group).toMatchObject({ earned: 3, total: defs.length });
    expect(group?.families.reduce((n, f) => n + f.earned, 0)).toBe(3);
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
    const first = ACHIEVEMENTS.find((a) => a.family === 'gold');
    if (first === undefined) throw new Error('no gold achievement');
    store.state.stats.goldFound = first.value;
    checkAchievements(store.state, 'gold');
    store.setMotion({}); // any counter-free mutation runs the store's single changed() path
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]).toMatchObject({
      name: first.name,
      desc: `Earn ${first.value.toLocaleString('en-US')} Gold over your lifetime.`,
      icon: 'goldYield',
    });
  });

  it('an earned secret toasts with its real name and description', () => {
    const { store } = make();
    store.load();
    const def = ACHIEVEMENTS.find((a) => a.kind === 'hidden');
    if (def === undefined) throw new Error('no hidden achievement');
    store.state.achievements.earned.push(def.id);
    store.setMotion({});
    expect(store.notifications[0]).toMatchObject({ name: def.name, desc: def.desc });
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
    store.state.stats.goldFound = ACHIEVEMENTS.find((a) => a.family === 'gold')?.value ?? 0;
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
    store.state.stats.goldFound = ACHIEVEMENTS.find((a) => a.family === 'gold')?.value ?? 0;
    checkAchievements(store.state, 'gold');
    store.setMotion({});
    expect(store.notifications).toHaveLength(1);
    store.save();
    const again = make(now, storage).store;
    again.load();
    expect(again.notifications).toEqual([]);
  });
});
