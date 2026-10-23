import { expect, it } from 'vitest';
import { TabLock } from '../../src/store/tabLock';
import { MemoryStorage } from '../../src/store/storage';

it('only one tab plays; a stale lock can be taken; the loser finds out', () => {
  const storage = new MemoryStorage(); const clock = { t: 0 }; const now = () => clock.t;
  const a = new TabLock(storage, now, 'a'); const b = new TabLock(storage, now, 'b');
  expect(a.tryAcquire()).toBe(true);
  expect(b.tryAcquire()).toBe(false);
  clock.t = 5001;
  expect(b.tryAcquire()).toBe(true);
  expect(a.heartbeat()).toBe(false);
  a.takeOver();
  expect(b.heartbeat()).toBe(false);
  expect(a.heartbeat()).toBe(true);
});

it('stays playable when the lock record cannot be written', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const lock = new TabLock(storage, () => 0, 'a');
  expect(lock.tryAcquire()).toBe(true);
  expect(lock.heartbeat()).toBe(true);
  expect(() => lock.takeOver()).not.toThrow();
});

it('treats a missing record as a lost lock once this tab has written one', () => {
  const storage = new MemoryStorage(); const clock = { t: 0 }; const now = () => clock.t;
  const a = new TabLock(storage, now, 'a'); const b = new TabLock(storage, now, 'b');
  expect(a.tryAcquire()).toBe(true);
  clock.t = 5001;
  expect(b.tryAcquire()).toBe(true);
  b.release();
  expect(a.heartbeat()).toBe(false);
  expect(a.tryAcquire()).toBe(true);
  expect(a.heartbeat()).toBe(true);
});

it('keeps returning true when every write fails', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const lock = new TabLock(storage, () => 0, 'a');
  expect(lock.tryAcquire()).toBe(true);
  expect(lock.heartbeat()).toBe(true);
  expect(lock.heartbeat()).toBe(true);
});
