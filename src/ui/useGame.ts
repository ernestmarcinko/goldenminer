import { useCallback, useSyncExternalStore } from 'react';
import type { GameStore } from '../store/gameStore';

export function useGame(store: GameStore): GameStore {
  const subscribe = useCallback((fn: () => void) => store.subscribe(fn), [store]);
  useSyncExternalStore(subscribe, () => store.version);
  return store;
}
