import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY, BACKUP_PREFIX, safeStorage } from '../../src/store/storage';
import { decodeSave, encodeSave } from '../../src/core/save';
import { compressToBase64 } from 'lz-string';
import { newGame } from '../../src/core/newGame';
import { seedFromText } from '../../src/core/seed';
import { BAG_SIZE, MAX_LOOT_RULES, STASH_SIZE } from '../../src/core/balance';
import type { LootRule } from '../../src/core/types';
import { gem } from '../helpers/items';

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
    expect(store.drainFeedback()).toEqual({ gold: 0, diamonds: 0, finds: [] });
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
    for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
    for (let i = 0; i < STASH_SIZE; i++) s.stash.push(gem(s));
    const held = gem(s, 'emerald');
    s.overflow.push({ bag: 'mining', item: held });
    const v = store.version;
    expect(store.sell('mining', 0)).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(s.overflow).toEqual([]);
    expect(s.bags.mining.at(-1)).toBe(held);
  });

  it('a refused action changes nothing', () => {
    const { store } = make();
    store.load();
    const v = store.version;
    expect(store.unequip('pickaxe')).toBe('invalid');
    expect(store.version).toBe(v);
  });

  it('settings keep at most 20 rules, and switching to sellWorst drains held loot', () => {
    const { store } = make();
    store.load();
    const rule: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };
    store.setLootFilter(Array.from({ length: 25 }, () => rule));
    expect(store.state.settings.lootFilter).toHaveLength(MAX_LOOT_RULES);
    const s = store.state;
    s.settings.bagFull = 'stop';
    for (let i = 0; i < BAG_SIZE; i++) s.bags.mining.push(gem(s));
    for (let i = 0; i < STASH_SIZE; i++) s.stash.push(gem(s));
    s.overflow.push({ bag: 'mining', item: gem(s) });
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
});
