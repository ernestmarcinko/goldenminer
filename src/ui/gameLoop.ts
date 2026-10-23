import { AUTOSAVE_INTERVAL_MS, TAB_HEARTBEAT_MS } from '../core/balance';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';

const PUMP_MS = 250;

export interface GameLoop {
  stop: () => void;
  /** Runs an action that changes the game, then saves it; does nothing and blocks this tab if the lock was lost. */
  runAsOwner: (action: () => void) => boolean;
}

/** Loads the game and runs the pump, autosave and heartbeat. */
export function startGame(store: GameStore, lock: TabLock, onBlocked: () => void): GameLoop {
  let stopped = false;
  const timers: number[] = [];

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const t of timers) window.clearInterval(t);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };

  /** True while this tab still owns the lock; otherwise stops without saving and shows the blocked screen. */
  const owns = (): boolean => {
    if (stopped) return false;
    if (lock.heartbeat()) return true;
    stop();
    onBlocked();
    return false;
  };

  const guardedSave = (): boolean => {
    if (!owns()) return false;
    store.save();
    return true;
  };

  const runAsOwner = (action: () => void): boolean => {
    if (!owns()) return false;
    action();
    store.save();
    return true;
  };

  function onVisibility(): void {
    if (document.visibilityState === 'hidden') guardedSave();
    else owns();
  }

  function onPageHide(): void {
    if (guardedSave()) lock.release();
  }

  function onPageShow(e: PageTransitionEvent): void {
    if (!e.persisted || stopped) return;
    if (lock.tryAcquire()) {
      store.load();
    } else {
      stop();
      onBlocked();
    }
  }

  store.load();
  timers.push(window.setInterval(() => store.pump(), PUMP_MS));
  timers.push(window.setInterval(guardedSave, AUTOSAVE_INTERVAL_MS));
  timers.push(window.setInterval(owns, TAB_HEARTBEAT_MS));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  return { stop, runAsOwner };
}
