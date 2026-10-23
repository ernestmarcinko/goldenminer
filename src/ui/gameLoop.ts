import { AUTOSAVE_INTERVAL_MS, TAB_HEARTBEAT_MS } from '../core/balance';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';

const PUMP_MS = 250;

/** Loads the game and runs the pump, autosave and heartbeat. Returns a function that stops everything. */
export function startGame(store: GameStore, lock: TabLock, onBlocked: () => void): () => void {
  let stopped = false;
  const timers: number[] = [];

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const t of timers) window.clearInterval(t);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  };

  /** Saves only while this tab still owns the lock; otherwise stops without saving. */
  const guardedSave = (): boolean => {
    if (stopped) return false;
    if (!lock.heartbeat()) {
      stop();
      onBlocked();
      return false;
    }
    store.save();
    return true;
  };

  function onVisibility(): void {
    if (document.visibilityState === 'hidden') guardedSave();
  }

  function onPageHide(): void {
    if (guardedSave()) lock.release();
  }

  store.load();
  timers.push(window.setInterval(() => store.pump(), PUMP_MS));
  timers.push(window.setInterval(guardedSave, AUTOSAVE_INTERVAL_MS));
  timers.push(
    window.setInterval(() => {
      if (!lock.heartbeat()) {
        stop();
        onBlocked();
      }
    }, TAB_HEARTBEAT_MS),
  );
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  return stop;
}
