import { AUTOSAVE_INTERVAL_MS, TAB_HEARTBEAT_MS } from '../core/balance';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';

const PUMP_MS = 250;

export interface GameLoop {
  stop: () => void;
  /** Runs an action that changes the game, then saves it; does nothing and blocks this tab if the lock was lost. */
  runAsOwner: (action: () => void) => boolean;
}

export interface LoopEnv {
  doc: EventTarget & { visibilityState: string };
  win: EventTarget;
}

const realEnv = (): LoopEnv => ({ doc: document, win: window });

/** Runs the pump, autosave and heartbeat. */
export function startGame(
  store: GameStore,
  lock: TabLock,
  onBlocked: () => void,
  env: LoopEnv = realEnv(),
): GameLoop {
  let stopped = false;
  let parked = false;
  const timers: ReturnType<typeof setInterval>[] = [];

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const t of timers) clearInterval(t);
    env.doc.removeEventListener('visibilitychange', onVisibility);
    env.win.removeEventListener('pagehide', onPageHide);
    env.win.removeEventListener('pageshow', onPageShow);
  };

  /** True while this tab still owns the lock; otherwise stops without saving and shows the blocked screen. */
  const owns = (): boolean => {
    if (stopped || parked) return false;
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

  // A hidden tab counts as idle, so it digs even from another view. Coming back, the hidden stretch is dug first,
  // and only then does the view pause hold again.
  function onVisibility(): void {
    if (env.doc.visibilityState === 'hidden') {
      store.setHidden(true);
      guardedSave();
    } else {
      if (owns()) store.pump();
      store.setHidden(false);
    }
  }

  function onPageHide(): void {
    if (guardedSave()) {
      lock.release();
      parked = true;
    }
  }

  function onPageShow(event: Event): void {
    if (!(event as PageTransitionEvent).persisted || stopped) return;
    parked = false;
    if (lock.tryAcquire()) {
      store.load();
    } else {
      stop();
      onBlocked();
    }
  }

  timers.push(setInterval(() => store.pump(), PUMP_MS));
  timers.push(setInterval(guardedSave, AUTOSAVE_INTERVAL_MS));
  timers.push(setInterval(owns, TAB_HEARTBEAT_MS));
  env.doc.addEventListener('visibilitychange', onVisibility);
  env.win.addEventListener('pagehide', onPageHide);
  env.win.addEventListener('pageshow', onPageShow);
  return { stop, runAsOwner };
}
