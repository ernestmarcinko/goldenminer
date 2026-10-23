import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY, BACKUP_PREFIX, safeStorage } from '../../src/store/storage';
import { decodeSave, encodeSave } from '../../src/core/save';
import { compressToBase64 } from 'lz-string';
import { newGame } from '../../src/core/newGame';

function make(now = { t: 0 }, storage = new MemoryStorage(), available = true) {
  const store = new GameStore({ storage, storageAvailable: available, now: () => now.t, newSeed: () => 7 });
  return { store, storage, now };
}

describe('GameStore', () => {
  it('starts a new game when there is no save', () => {
    const { store } = make();
    store.load();
    expect(store.state.seed).toBe(7);
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
    store.hardReset();
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
    store.hardReset();
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
    store.hardReset();
    expect(store.notice).toBeNull();
  });
});
