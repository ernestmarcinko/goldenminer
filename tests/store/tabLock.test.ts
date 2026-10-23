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
