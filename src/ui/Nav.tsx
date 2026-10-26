import type { RefObject } from 'react';
import type { GameStore } from '../store/gameStore';
import { navTabs, type View } from './navView';
import { useGame } from './useGame';

export type { View } from './navView';

/** `mineRef` is the Mine tab, where focus lands when the run result is dismissed; `runRef` the Run tab, while a run goes on. */
export function Nav({ store, view, onView, mineRef, runRef }: {
  store: GameStore; view: View; onView: (view: View) => void;
  mineRef?: RefObject<HTMLButtonElement | null>; runRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { state } = useGame(store);
  return (
    <nav aria-label="Game sections" className="gm-nav">
      {navTabs(state.activity.kind === 'map').map((tab) => (
        <button
          key={tab.view}
          type="button"
          ref={tab.view === 'mine' ? mineRef : tab.view === 'run' ? runRef : undefined}
          className={tab.view === 'run' ? 'gm-nav__tab gm-nav__tab--run' : 'gm-nav__tab'}
          aria-pressed={view === tab.view}
          onClick={() => onView(tab.view)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
