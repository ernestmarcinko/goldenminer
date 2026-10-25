import type { GameStore } from '../store/gameStore';
import { formatNumber } from './format';
import { mapCount } from './maps/mapsView';
import { useGame } from './useGame';

export type View = 'mine' | 'maps' | 'merchant';

export function Nav({ store, view, onView }: { store: GameStore; view: View; onView: (view: View) => void }) {
  const { state } = useGame(store);
  return (
    <nav aria-label="Game sections" className="gm-nav">
      <button type="button" className="gm-nav__tab" aria-pressed={view === 'mine'} onClick={() => onView('mine')}>
        Mine
      </button>
      <button
        type="button"
        className="gm-nav__tab gm-nav__tab--maps"
        aria-pressed={view === 'maps'}
        onClick={() => onView('maps')}
      >
        Maps ({formatNumber(mapCount(state))})
      </button>
      <button type="button" className="gm-nav__tab" aria-pressed={view === 'merchant'} onClick={() => onView('merchant')}>
        Merchant
      </button>
    </nav>
  );
}
