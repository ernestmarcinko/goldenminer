import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY, BACKUP_PREFIX, safeStorage } from '../../src/store/storage';
import { decodeSave, encodeSave } from '../../src/core/save';
import { compressToBase64 } from 'lz-string';
import { newGame } from '../../src/core/newGame';
import { addMap, startMap } from '../../src/core/maps';
import { advance } from '../../src/core/clock';
import { freshWorld } from '../../src/core/seed';
import { deriveBattleStats } from '../../src/core/battle';
import { deriveStats } from '../../src/core/stats';
import { xpToNext } from '../../src/core/levels';
import { seedFromText } from '../../src/core/seed';
import { MAX_LOOT_RULES } from '../../src/core/balance';
import type { LootRule, TickEvent } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

function make(now = { t: 0 }, storage = new MemoryStorage(), available = true) {
  const store = new GameStore({ storage, storageAvailable: available, now: () => now.t, newSeed: () => 7 });
  return { store, storage, now };
}

describe('GameStore', () => {
  it('starts a new game when there is no save', () => {
    const { store } = make();
    store.load();
    expect(store.state.worldSeed).toMatch(/^[a-z]+-[a-z]+-\d{1,3}$/);
    expect(store.state.seed).toBe(seedFromText(store.state.worldSeed));
    expect(store.notice).toBeNull();
    expect(store.offlineSummary).toBeNull();
  });

  it('saves and restores', () => {
    const { store, storage, now } = make();
    store.load(); now.t = 5000; store.pump(); store.save();
    const again = make(now, storage).store; again.load();
    expect(again.state.gold).toBe(store.state.gold);
  });

  it('shows an offline summary only for long absences', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, encodeSave(newGame(1, 0), 0));
    const short = make({ t: 100_000 }, storage).store; short.load();
    expect(short.offlineSummary).toBeNull();
    const long = make({ t: 600_000 }, storage).store; long.load();
    expect(long.offlineSummary?.ticks).toBe(600);
  });

  it('keeps an unreadable save as a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const { store } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'corrupt', backupKey: BACKUP_PREFIX + '42' });
    expect(storage.getItem(BACKUP_PREFIX + '42')).toBe('garbage');
    store.save();
    expect(storage.getItem(BACKUP_PREFIX + '42')).toBe('garbage');
  });

  it('survives storage that refuses writes', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    const { store } = make({ t: 0 }, storage); store.load();
    expect(() => store.save()).not.toThrow();
    expect(store.notice).toEqual({ kind: 'saveFailed' });
  });

  it('reports when storage is unavailable', () => {
    const { store } = make({ t: 0 }, new MemoryStorage(), false); store.load();
    expect(store.notice).toEqual({ kind: 'storageUnavailable' });
    const probe = safeStorage(() => { throw new Error('SecurityError'); });
    expect(probe.available).toBe(false);
  });

  it('a bad import leaves the game untouched', () => {
    const { store, now } = make(); store.load(); now.t = 3000; store.pump();
    const gold = store.state.gold;
    expect(store.importSave('nope')).toEqual({ ok: false, reason: 'corrupt' });
    expect(store.state.gold).toBe(gold);
    const other = newGame(2, 0); other.gold = 999;
    expect(store.importSave(encodeSave(other, 0)).ok).toBe(true);
    expect(store.state.seed).toBe(2);
  });

  it('caps clicks at 10 per second', () => {
    const { store } = make(); store.load();
    for (let i = 0; i < 11; i++) store.click();
    expect(store.state.tickCount).toBe(10);
  });

  it('aggregates feedback between drains', () => {
    const { store, now } = make(); store.load(); now.t = 5000; store.pump();
    expect(store.drainFeedback().gold).toBe(5);
    expect(store.drainFeedback()).toEqual({ gold: 0, diamonds: 0, finds: [], strikes: [], hurt: 0 });
  });

  it('never loses an unreadable save when its backup cannot be written', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const real = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      if (k.startsWith(BACKUP_PREFIX)) throw new Error('QuotaExceededError');
      real(k, v);
    };
    const { store } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'corrupt', backupKey: null });
    expect(store.unreadableSave).toBe('garbage');
    store.save();
    expect(storage.getItem(SAVE_KEY)).toBe('garbage');
    store.newWorld(null);
    expect(store.unreadableSave).toBeNull();
    expect(storage.getItem(SAVE_KEY)).not.toBe('garbage');
    expect(decodeSave(storage.getItem(SAVE_KEY) ?? '').ok).toBe(true);
  });

  it('a future save is never overwritten', () => {
    const storage = new MemoryStorage();
    const future = compressToBase64(JSON.stringify({ schema: 99, savedAt: 0, state: {} }));
    storage.setItem(SAVE_KEY, future);
    const { store, now } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'future', backupKey: BACKUP_PREFIX + '42' });
    expect(store.unreadableSave).toBe(future);
    now.t = 5000; store.pump(); store.save();
    expect(storage.getItem(SAVE_KEY)).toBe(future);
    // a stale build reloading again does not pile up backup keys
    now.t = 9000;
    const again = make(now, storage).store; again.load();
    expect(again.notice).toEqual({ kind: 'loadFailed', reason: 'future', backupKey: BACKUP_PREFIX + '42' });
    expect(storage.getItem(BACKUP_PREFIX + '9000')).toBeNull();
    store.newWorld(null);
    expect(store.notice).toBeNull();
    expect(storage.getItem(SAVE_KEY)).not.toBe(future);
    expect(decodeSave(storage.getItem(SAVE_KEY) ?? '').ok).toBe(true);
  });

  it('importing or resetting clears a load-failed notice', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const { store } = make({ t: 1 }, storage); store.load();
    expect(store.notice?.kind).toBe('loadFailed');
    expect(store.importSave(encodeSave(newGame(2, 0), 0)).ok).toBe(true);
    expect(store.notice).toBeNull();
    storage.setItem(SAVE_KEY, 'garbage');
    store.load();
    expect(store.notice?.kind).toBe('loadFailed');
    store.newWorld(null);
    expect(store.notice).toBeNull();
  });
});

describe('inventory intents', () => {
  it('an action bumps the version and lets held loot into the room it made', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.settings.bagFull = 'stop';
    s.bags.mining = s.bags.mining.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    const held = gear(s, 'pickaxe');
    s.overflow.push({ bag: 'mining', item: held });
    const v = store.version;
    expect(store.sell({ where: 'bag', set: 'mining', index: 0 })).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(s.overflow).toEqual([]);
    expect(s.bags.mining[0]).toBe(held);
  });

  it('a refused action changes nothing', () => {
    const { store } = make();
    store.load();
    const v = store.version;
    expect(store.unequip('pickaxe')).toBe('invalid');
    expect(store.version).toBe(v);
  });

  it('equipping into an empty slot leaves a notice; a swap does not', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bags.mining[0] = gear(s, 'pickaxe', { name: 'Stonebiter' });
    s.bags.mining[1] = gear(s, 'pickaxe');
    s.bags.mining[2] = gear(s, 'lamp', { name: 'Oil Lamp Helm' });
    expect(store.equipNotice).toBeNull();
    expect(store.equip({ where: 'bag', set: 'mining', index: 0 })).toBe('ok');
    expect(store.equipNotice).toEqual({ id: 1, slot: 'pickaxe', name: 'Stonebiter', rarity: 'magic' });
    expect(store.drop({ where: 'bag', set: 'mining', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('ok');
    expect(store.equipNotice?.id).toBe(1);
    expect(store.drop({ where: 'bag', set: 'mining', index: 2 }, { where: 'worn', slot: 'lamp' })).toBe('ok');
    expect(store.equipNotice).toEqual({ id: 2, slot: 'lamp', name: 'Oil Lamp Helm', rarity: 'magic' });
  });

  it('replacing the game clears the equip notice', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bags.mining[0] = gear(s, 'pickaxe');
    expect(store.equip({ where: 'bag', set: 'mining', index: 0 })).toBe('ok');
    expect(store.equipNotice).not.toBeNull();
    expect(store.importSave(store.exportSave()).ok).toBe(true);
    expect(store.equipNotice).toBeNull();
    store.state.bags.mining[0] = gear(store.state, 'lamp');
    store.equip({ where: 'bag', set: 'mining', index: 0 });
    expect(store.equipNotice?.id).toBe(2);
    expect(store.newWorld(null)).toBe(true);
    expect(store.equipNotice).toBeNull();
  });

  it('a refused equip leaves no notice, and unequipping does not either', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bags.mining[0] = gear(s, 'pickaxe');
    s.bags.mining[1] = gear(s, 'boots');
    expect(store.drop({ where: 'bag', set: 'mining', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('wrongSlot');
    expect(store.equipNotice).toBeNull();
    expect(store.equip({ where: 'bag', set: 'mining', index: 0 })).toBe('ok');
    expect(store.unequip('pickaxe')).toBe('ok');
    expect(store.equipNotice?.id).toBe(1);
  });

  it('the other moves go through the store and bump the version', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bags.mining[0] = gem(s, 'ruby', { count: 5 });
    const v = store.version;
    expect(store.sendItem({ where: 'bag', set: 'mining', index: 0 }, 'stash')).toBe('ok');
    expect(s.stash.gems.ruby.tiny).toBe(5);
    expect(store.sendItem({ where: 'gems', gem: 'ruby', grade: 'tiny' }, 'battle')).toBe('ok');
    expect(s.bags.battle[0]).toMatchObject({ gem: 'ruby', count: 5 });
    expect(store.moveItem({ where: 'bag', set: 'battle', index: 0 }, { where: 'bag', set: 'battle', index: 9 })).toBe('ok');
    expect(store.salvage({ where: 'bag', set: 'battle', index: 9 })).toBe('ok');
    expect(store.version).toBe(v + 4);
    expect(store.moveItem({ where: 'bag', set: 'battle', index: 9 }, { where: 'stash', index: 0 })).toBe('invalid');
    expect(store.version).toBe(v + 4);
  });

  it('settings keep at most 20 rules, and switching to sellWorst drains held loot', () => {
    const { store } = make();
    store.load();
    const rule: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };
    store.setLootFilter(Array.from({ length: 25 }, () => rule));
    expect(store.state.settings.lootFilter).toHaveLength(MAX_LOOT_RULES);
    const s = store.state;
    s.settings.bagFull = 'stop';
    s.bags.mining = s.bags.mining.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    s.overflow.push({ bag: 'mining', item: gear(s, 'pickaxe') });
    store.setBagFull('sellWorst');
    expect(s.overflow).toEqual([]);
  });

  it('a new world from typed text, or refused when empty', () => {
    const { store } = make(); store.load();
    expect(store.newWorld('  Golden Mole ')).toBe(true);
    expect([store.state.worldSeed, store.state.seed]).toEqual(['Golden Mole', 2_552_287_895]);
    expect(store.newWorld('   ')).toBe(false);
    expect(store.state.worldSeed).toBe('Golden Mole');
    expect(store.newWorld(null)).toBe(true);
    expect(store.state.worldSeed).toMatch(/^[a-z]+-[a-z]+-\d{1,3}$/);
  });

  it('setMotion applies a patch and skips undefined entries', () => {
    const { store } = make(); store.load();
    store.setMotion({ floats: false, shaft: 'smooth' });
    store.setMotion({ shaft: undefined, pops: false });
    expect(store.state.settings.motion).toEqual({ floats: false, pops: false, lampFlicker: true, shaft: 'smooth' });
    // the next save must still be readable
    expect(make().store.importSave(store.exportSave()).ok).toBe(true);
  });
});

describe('maps', () => {
  it('a click in a map is a hit, never a dig, and still capped', () => {
    const { store } = make(); store.load();
    const map = addMap(store.state, 1, 2);
    expect(store.startMap(map.id)).toBe('ok');
    const ticks = store.state.tickCount;
    const events = store.click();
    expect(events.some((e) => e.kind === 'strike' && e.click)).toBe(true);
    expect(store.state.tickCount).toBe(ticks);
    for (let i = 0; i < 20; i++) store.click();
    const hits = store.state.activity.kind === 'map' ? store.state.activity.run.log.filter((l) => l.kind === 'hit' && l.click).length : 0;
    expect(hits).toBeLessThanOrEqual(10);
  });

  it('leaving and dismissing', () => {
    const { store } = make(); store.load();
    store.startMap(addMap(store.state, 1, 2).id);
    expect(store.leaveMap()).toBe(true);
    expect(store.state.lastRun).toMatchObject({ outcome: 'left', seen: false });
    store.dismissRun();
    expect(store.state.lastRun?.seen).toBe(true);
  });

  it('auto strikes reach the feedback', () => {
    const { store, now } = make(); store.load();
    store.startMap(addMap(store.state, 1, 2).id);
    now.t = 3000; store.pump();
    const fb = store.drainFeedback();
    expect(fb.strikes.length).toBeGreaterThan(0);
  });

  /** The same run on a plain core game, pumped at the same moments, with every event it produced. */
  function runEvents(seconds: number): TickEvent[] {
    const reference = freshWorld(() => 7, 0);
    startMap(reference, addMap(reference, 1, 2).id);
    const events: TickEvent[] = [];
    for (let t = 250; t <= seconds * 1000; t += 250) advance(reference, t, deriveStats(reference), events);
    expect(reference.activity.kind).toBe('map');
    return events;
  }

  function pumpedRun(seconds: number) {
    const { store, now } = make(); store.load();
    store.startMap(addMap(store.state, 1, 2).id);
    for (now.t = 250; now.t <= seconds * 1000; now.t += 250) store.pump();
    expect(store.state.activity.kind).toBe('map');
    return store;
  }

  it('keeps only the newest 6 auto strikes', () => {
    const struck = runEvents(10).flatMap((e) => (e.kind === 'strike' && !e.click ? [{ amount: e.amount, crit: e.crit }] : []));
    expect(struck.length).toBeGreaterThan(6);
    expect(pumpedRun(10).drainFeedback().strikes).toEqual(struck.slice(-6));
  });

  it('click strikes stay out of the feedback', () => {
    const { store } = make(); store.load();
    store.startMap(addMap(store.state, 1, 2).id);
    expect(store.click().some((e) => e.kind === 'strike' && e.click)).toBe(true);
    expect(store.drainFeedback().strikes).toEqual([]);
  });

  it('sums the damage taken and starts again after a drain', () => {
    const hurt = runEvents(10).reduce((sum, e) => sum + (e.kind === 'hurt' ? e.amount : 0), 0);
    expect(hurt).toBeGreaterThan(0);
    const store = pumpedRun(10);
    expect(store.drainFeedback().hurt).toBeCloseTo(hurt, 6);
    expect(store.drainFeedback().hurt).toBe(0);
  });

  it('a click after the run has ended digs again', () => {
    const { store } = make(); store.load();
    store.startMap(addMap(store.state, 1, 2).id);
    store.leaveMap();
    expect(store.state.activity.kind).toBe('dig');
    const ticks = store.state.tickCount;
    store.click();
    expect(store.state.tickCount).toBeGreaterThan(ticks);
  });

  it('dismissing with no run, or an already seen one, changes nothing', () => {
    const { store } = make(); store.load();
    let v = store.version;
    store.dismissRun();
    expect(store.state.lastRun).toBeNull();
    expect(store.version).toBe(v);
    store.startMap(addMap(store.state, 1, 2).id);
    store.leaveMap();
    store.dismissRun();
    v = store.version;
    store.dismissRun();
    expect(store.version).toBe(v);
  });

  it('a dismissed run stays dismissed across a save and load', () => {
    const { store, storage, now } = make(); store.load();
    store.startMap(addMap(store.state, 1, 2).id);
    store.leaveMap();
    store.dismissRun();
    store.save();
    const again = make(now, storage).store; again.load();
    expect(again.state.lastRun).toMatchObject({ outcome: 'left', seen: true });
  });
});

describe('battle stats', () => {
  it('start from the fresh game and follow worn battle gear', () => {
    const { store } = make(); store.load();
    expect(store.battle).toEqual(deriveBattleStats(store.state));
    const before = store.battle.damageMin;
    store.state.bags.battle[0] = gear(store.state, 'weapon');
    expect(store.equip({ where: 'bag', set: 'battle', index: 0 })).toBe('ok');
    expect(store.battle.damageMin).toBeGreaterThan(before);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
  });

  it('follow a level gained inside a pump', () => {
    const { store, now } = make(); store.load();
    const before = store.battle.maxLife;
    store.state.xp = xpToNext(store.state.level) - 1;
    store.startMap(addMap(store.state, 1, 2).id);
    for (now.t = 250; store.state.level === 1 && now.t <= 60_000; now.t += 250) store.pump();
    expect(store.state.level).toBeGreaterThan(1);
    expect(store.battle.maxLife).toBeGreaterThan(before);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
  });

  it('follow an imported save and a new world', () => {
    const { store } = make(); store.load();
    const other = newGame(2, 0);
    other.level = 5;
    expect(store.importSave(encodeSave(other, 0)).ok).toBe(true);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
    expect(store.battle.maxLife).toBeGreaterThan(deriveBattleStats(newGame(2, 0)).maxLife);
    expect(store.newWorld(null)).toBe(true);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
    expect(store.battle.maxLife).toBe(deriveBattleStats(newGame(2, 0)).maxLife);
  });
});
