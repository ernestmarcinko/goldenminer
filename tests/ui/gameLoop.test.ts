import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startGame } from '../../src/ui/gameLoop';
import type { GameStore } from '../../src/store/gameStore';
import type { TabLock } from '../../src/store/tabLock';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function setup() {
  const store = { load: vi.fn(), pump: vi.fn(), save: vi.fn() };
  let held = true;
  const lock = {
    heartbeat: vi.fn(() => held),
    release: vi.fn(() => { held = false; }),
    tryAcquire: vi.fn(() => true),
  };
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  const onBlocked = vi.fn();
  const loop = startGame(store as unknown as GameStore, lock as unknown as TabLock, onBlocked, { doc, win });
  return { store, lock, doc, win, onBlocked, loop };
}

it('does not block itself on the visibilitychange that follows pagehide, and reloads on a bfcache restore', () => {
  const { store, lock, doc, win, onBlocked, loop } = setup();
  win.dispatchEvent(new Event('pagehide'));
  expect(store.save).toHaveBeenCalledTimes(1);
  expect(lock.release).toHaveBeenCalledTimes(1);

  doc.visibilityState = 'hidden';
  doc.dispatchEvent(new Event('visibilitychange'));
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(60_000);
  expect(onBlocked).not.toHaveBeenCalled();
  expect(store.save).toHaveBeenCalledTimes(1);
  expect(lock.release).toHaveBeenCalledTimes(1);

  store.load.mockClear();
  win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  expect(lock.tryAcquire).toHaveBeenCalledTimes(1);
  expect(store.load).toHaveBeenCalledTimes(1);
  expect(onBlocked).not.toHaveBeenCalled();
  loop.stop();
});

it('blocks when the lock was lost, without saving', () => {
  const { store, lock, onBlocked, loop } = setup();
  lock.heartbeat.mockReturnValue(false);
  expect(loop.runAsOwner(() => undefined)).toBe(false);
  expect(onBlocked).toHaveBeenCalledTimes(1);
  expect(store.save).not.toHaveBeenCalled();
});
