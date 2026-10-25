import type { RefObject } from 'react';
import type { GameStore } from '../store/gameStore';
import { navTabs, type View } from './navView';
import { useGame } from './useGame';

export type { View } from './navView';

/** `mineRef` is the Mine tab, where focus lands when the run result is dismissed. */
export function Nav({ store, view, onView, mineRef }: {
  store: GameStore; view: View; onView: (view: View) => void; mineRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { state } = useGame(store);
  return (
    <nav aria-label="Game sections" className="gm-nav">
      {navTabs(state.activity.kind === 'map').map((tab) => (
        <button
          key={tab.view}
          type="button"
          ref={tab.view === 'mine' ? mineRef : undefined}
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
