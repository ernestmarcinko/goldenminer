import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY, BACKUP_PREFIX, safeStorage } from '../../src/store/storage';
import { decodeSave, encodeSave } from '../../src/core/save';
import { compressToBase64 } from 'lz-string';
import fixture5 from '../fixtures/save-schema-5.txt?raw';
import { newGame } from '../../src/core/newGame';
import { startMap } from '../../src/core/maps';
import { advance } from '../../src/core/clock';
import { freshWorld } from '../../src/core/seed';
import { deriveBattleStats } from '../../src/core/battle';
import { deriveStats } from '../../src/core/stats';
import { xpToNext } from '../../src/core/levels';
import { seedFromText } from '../../src/core/seed';
import { MAX_LOOT_RULES } from '../../src/core/balance';
import type { LootRule, TickEvent } from '../../src/core/types';
import { gear, gem, stashMap } from '../helpers/items';

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
    const { store, now } = make(); store.load();
    store.state.ahead[1] = { feature: 'goldVein', amount: 7, hardRock: false };
    now.t = 30_000; store.pump();   // 30 ticks dig metre 1 and its vein
    const fb = store.drainFeedback();
    expect(fb.gold).toBe(7);
    expect(fb.finds.map((f) => f.kind)).toEqual(['goldVein']);
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
    s.bag = s.bag.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    const held = gear(s, 'pickaxe');
    s.overflow.push(held);
    const v = store.version;
    expect(store.sell({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(s.overflow).toEqual([]);
    expect(s.bag[0]).toBe(held);
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
    s.bag[0] = gear(s, 'pickaxe', { name: 'Stonebiter' });
    s.bag[1] = gear(s, 'pickaxe');
    s.bag[2] = gear(s, 'lamp', { name: 'Oil Lamp Helm' });
    expect(store.equipNotice).toBeNull();
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.equipNotice).toEqual({ id: 1, slot: 'pickaxe', name: 'Stonebiter', rarity: 'magic' });
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('ok');
    expect(store.equipNotice?.id).toBe(1);
    expect(store.drop({ where: 'bag', index: 2 }, { where: 'worn', slot: 'lamp' })).toBe('ok');
    expect(store.equipNotice).toEqual({ id: 2, slot: 'lamp', name: 'Oil Lamp Helm', rarity: 'magic' });
  });

  it('replacing the game clears the equip notice', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe');
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.equipNotice).not.toBeNull();
    expect(store.importSave(store.exportSave()).ok).toBe(true);
    expect(store.equipNotice).toBeNull();
    store.state.bag[0] = gear(store.state, 'lamp');
    store.equip({ where: 'bag', index: 0 });
    expect(store.equipNotice?.id).toBe(2);
    expect(store.newWorld(null)).toBe(true);
    expect(store.equipNotice).toBeNull();
  });

  it('a refused equip leaves no notice, and unequipping does not either', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe');
    s.bag[1] = gear(s, 'boots');
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('wrongSlot');
    expect(store.equipNotice).toBeNull();
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.unequip('pickaxe')).toBe('ok');
    expect(store.equipNotice?.id).toBe(1);
  });

  it('the other moves go through the store and bump the version', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gem(s, 'ruby', { count: 5 });
    const v = store.version;
    expect(store.sendItem({ where: 'bag', index: 0 }, 'stash')).toBe('ok');
    expect(s.stash.gems.ruby.tiny).toBe(5);
    expect(store.sendItem({ where: 'gems', gem: 'ruby', grade: 'tiny' }, 'bag')).toBe('ok');
    expect(s.bag[0]).toMatchObject({ gem: 'ruby', count: 5 });
    expect(store.moveItem({ where: 'bag', index: 0 }, { where: 'bag', index: 9 })).toBe('ok');
    expect(store.salvage({ where: 'bag', index: 9 })).toBe('ok');
    expect(store.version).toBe(v + 4);
    expect(store.moveItem({ where: 'bag', index: 9 }, { where: 'stash', index: 0 })).toBe('invalid');
    expect(store.version).toBe(v + 4);
  });

  it('settings keep at most 20 rules, and a new filter drains the held loot it sells', () => {
    const { store } = make();
    store.load();
    const rule: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };
    const s = store.state;
    s.bag = s.bag.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    s.overflow.push(gear(s, 'pickaxe', { rarity: 'normal' }));
    store.setLootFilter(Array.from({ length: 25 }, () => rule));
    expect(store.state.settings.lootFilter).toHaveLength(MAX_LOOT_RULES);
    expect(s.overflow).toEqual([]);
    expect('setBagFull' in store).toBe(false);
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

describe('crafting', () => {
  it('a craft bumps the version and is kept as the last craft; a refusal is kept but changes nothing', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 });
    s.stash.materials.copper = 10;
    expect(store.lastCraft).toBeNull();
    const v = store.version;
    expect(store.craft({ where: 'bag', index: 0 }, 'copper')).toEqual({ check: 'ok' });
    expect(store.version).toBe(v + 1);
    expect(store.lastCraft).toEqual({ id: 1, target: { where: 'bag', index: 0 }, kind: 'copper', check: 'ok' });
    expect(s.stash.materials.copper).toBe(7);
    expect(store.craft({ where: 'bag', index: 0 }, 'copper')).toEqual({ check: 'wrongRarity' });
    expect(store.version).toBe(v + 1);
    expect(store.lastCraft).toEqual({ id: 2, target: { where: 'bag', index: 0 }, kind: 'copper', check: 'wrongRarity' });
  });

  it('a material dropped on gear crafts through the store and keeps the check', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4 });
    s.bag[1] = { id: s.nextId++, type: 'material', material: 'tin', count: 5 };
    const v = store.version;
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'bag', index: 0 })).toBe('craftRefused');
    expect(store.version).toBe(v);
    expect(store.lastCraft).toMatchObject({ id: 1, kind: 'tin', check: 'wrongRarity' });
    s.bag[1] = { id: s.nextId++, type: 'material', material: 'obsidian', count: 5 };
    s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', affixes: [{ stat: 'goldYield', value: 4 }] });
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'bag', index: 0 })).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(store.lastCraft).toMatchObject({ id: 2, kind: 'obsidian', check: 'ok' });
    expect(store.importSave(store.exportSave()).ok).toBe(true);
    expect(store.lastCraft).toBeNull();
  });
});

describe('stash pages', () => {
  it('buying a General page with enough Gold bumps the version and adds the cells', () => {
    const { store } = make();
    store.load();
    store.state.gold = 5000;
    const v = store.version;
    expect(store.buyStashPage()).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(store.state.stash.general).toHaveLength(180);
    expect(store.state.stash.bought).toEqual({ general: 1 });
    expect(store.state.gold).toBe(0);
  });

  it('a refused purchase changes nothing', () => {
    const { store } = make();
    store.load();
    store.state.gold = 4999;
    const v = store.version;
    expect(store.buyStashPage()).toBe('noGold');
    expect(store.version).toBe(v);
    expect(store.state.stash.general).toHaveLength(120);
  });

  it('a bought page leaves held loot held: only the bag takes it', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag = s.bag.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    const held = gear(s, 'pickaxe');
    s.overflow.push(held);
    s.gold = 5000;
    expect(store.buyStashPage()).toBe('ok');
    expect([s.overflow, s.stash.general[120]]).toEqual([[held], null]);
  });
});

describe('a migrated save with held loot', () => {
  // Schema 6 frees room (one bag of 60, two General pages), so the loot the old bags held can go in at once.
  const decoded = () => { const r = decodeSave(fixture5.trim()); if (!r.ok) throw new Error(r.reason); return r.state; };

  it('loading lets the held items into the room the migration made, and digging goes on', () => {
    const before = decoded();
    expect(before.overflow).toHaveLength(2);
    const held = before.overflow.map((i) => i.id);
    const now = { t: before.lastTickAt };
    const { store, storage } = make(now);
    storage.setItem(SAVE_KEY, fixture5.trim());
    store.load();
    const s = store.state;
    expect(s.overflow).toEqual([]);
    expect(s.bag.filter((c) => c !== null).map((c) => c.id)).toEqual(expect.arrayContaining(held));
    expect(store.leaveMap()).toBe(true);
    now.t += 2_000_000;
    store.pump();
    expect(s.deepest).toBeGreaterThan(before.deepest);
  });

  it('importing it does the same', () => {
    const { store } = make();
    store.load();
    expect(store.importSave(fixture5.trim()).ok).toBe(true);
    expect(store.state.overflow).toEqual([]);
  });
});

describe('maps', () => {
  it('a click in a map is a hit, never a dig, and still capped', () => {
    const { store } = make(); store.load();
    const map = stashMap(store.state, 1, 2);
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
    store.startMap(stashMap(store.state, 1, 2).id);
    expect(store.leaveMap()).toBe(true);
    expect(store.state.lastRun).toMatchObject({ outcome: 'left', seen: false });
    store.dismissRun();
    expect(store.state.lastRun?.seen).toBe(true);
  });

  it('auto strikes reach the feedback', () => {
    const { store, now } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
    now.t = 3000; store.pump();
    const fb = store.drainFeedback();
    expect(fb.strikes.length).toBeGreaterThan(0);
  });

  /** The same run on a plain core game, pumped at the same moments, with every event it produced. */
  function runEvents(seconds: number): TickEvent[] {
    const reference = freshWorld(() => 7, 0);
    startMap(reference, stashMap(reference, 1, 2).id);
    const events: TickEvent[] = [];
    for (let t = 250; t <= seconds * 1000; t += 250) advance(reference, t, deriveStats(reference), events);
    expect(reference.activity.kind).toBe('map');
    return events;
  }

  function pumpedRun(seconds: number) {
    const { store, now } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
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
    store.startMap(stashMap(store.state, 1, 2).id);
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
    store.startMap(stashMap(store.state, 1, 2).id);
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
    store.startMap(stashMap(store.state, 1, 2).id);
    store.leaveMap();
    store.dismissRun();
    v = store.version;
    store.dismissRun();
    expect(store.version).toBe(v);
  });

  it('a dismissed run stays dismissed across a save and load', () => {
    const { store, storage, now } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
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
    store.state.bag[0] = gear(store.state, 'weapon');
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.battle.damageMin).toBeGreaterThan(before);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
  });

  it('follow a level gained inside a pump', () => {
    const { store, now } = make(); store.load();
    const before = store.battle.maxLife;
    store.state.xp = xpToNext(store.state.level) - 1;
    store.startMap(stashMap(store.state, 1, 2).id);
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

describe('pausing', () => {
  const dug = (s: { deepest: number; progress: number }) => [s.deepest, s.progress];

  it('offline catch-up digs unless the player pressed Pause', () => {
    const storage = new MemoryStorage();
    const paused = newGame(1, 0);
    paused.paused = true;
    storage.setItem(SAVE_KEY, encodeSave(paused, 0));
    const away = make({ t: 600_000 }, storage).store;
    // the view the game was left on doesn't matter offline
    away.setViewPaused(true);
    away.load();
    expect(dug(away.state)).toEqual([0, 0]);
    expect(away.state.tickCount).toBe(600);
    expect(away.offlineSummary?.paused).toBe(true);
    expect(away.offlineSummary?.metres).toBe(0);

    storage.setItem(SAVE_KEY, encodeSave(newGame(1, 0), 0));
    const digging = make({ t: 600_000 }, storage).store;
    digging.setViewPaused(true);
    digging.load();
    expect(digging.state.deepest).toBeGreaterThan(0);
    expect(digging.offlineSummary?.paused).toBe(false);
  });

  it('the view pause gates live ticks only, and a hidden tab digs', () => {
    const { store, now } = make(); store.load();
    store.setViewPaused(true);
    expect(store.digPaused).toBe(true);
    now.t = 10_000; store.pump();
    expect(dug(store.state)).toEqual([0, 0]);
    expect(store.state.tickCount).toBe(10);

    store.setHidden(true);
    expect(store.digPaused).toBe(false);
    now.t = 20_000; store.pump();
    const hidden = dug(store.state);
    expect(hidden).not.toEqual([0, 0]);

    store.setHidden(false);
    store.setViewPaused(false);
    expect(store.digPaused).toBe(false);
    now.t = 30_000; store.pump();
    expect(dug(store.state)).not.toEqual(hidden);

    // the player's Pause holds even while hidden
    store.setPaused(true);
    store.setHidden(true);
    expect(store.digPaused).toBe(true);
  });

  it('setPaused writes the save flag and bumps the version; the view pause and hidden do not', () => {
    const { store } = make(); store.load();
    const v = store.version;
    store.setPaused(true);
    expect(store.state.paused).toBe(true);
    expect(store.version).toBe(v + 1);
    store.setViewPaused(true);
    store.setHidden(true);
    expect(store.version).toBe(v + 1);
    expect(store.state.paused).toBe(true);
    store.setPaused(false);
    expect(store.state.paused).toBe(false);
  });

  it('the player\'s Pause survives a save and a load', () => {
    const { store, storage, now } = make(); store.load();
    store.setPaused(true);
    store.save();
    now.t = 600_000;
    const again = make(now, storage).store; again.load();
    expect(again.state.paused).toBe(true);
    expect(dug(again.state)).toEqual(dug(store.state));
  });
});
