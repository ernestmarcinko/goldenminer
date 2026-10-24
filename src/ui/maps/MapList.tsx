import type { GameStore } from '../../store/gameStore';
import { formatNumber, plural } from '../format';
import { useGame } from '../useGame';
import { mapGroups } from './mapsView';
import './maps.css';

/** The stash's maps by dungeon and tier. `onRun` fires after a run has started. */
export function MapList({ store, compact = false, onRun }: { store: GameStore; compact?: boolean; onRun?: () => void }) {
  const { state } = useGame(store);
  const groups = mapGroups(state.seed, state.stash.maps);
  const running = state.activity.kind === 'map';
  if (groups.length === 0) {
    return <p className="gm-maps__empty gm-muted">No maps yet. Dungeon entrances you dig into become maps.</p>;
  }
  return (
    <div className="gm-maps" data-compact={compact || undefined}>
      {groups.map((g) => (
        <section key={g.key} className="gm-maps__group" aria-label={`${g.name}, tier ${g.tier}`}>
          <h3 className="gm-maps__head">
            <span className="gm-badge">T{formatNumber(g.tier)}</span>
            <span className="gm-maps__name">{g.name}</span>
            <span className="gm-muted gm-maps__count">×{formatNumber(g.maps.length)}</span>
          </h3>
          <ul className="gm-maps__rows">
            {g.maps.map((m) => (
              <li key={m.id} className="gm-maps__row">
                <span className="gm-maps__found">
                  found at {formatNumber(m.metre)} m · {plural(m.rooms, 'room', 'rooms')}
                </span>
                <button
                  type="button"
                  className="gm-btn gm-maps__run"
                  disabled={running}
                  aria-label={`Run ${g.name}, found at ${formatNumber(m.metre)} m`}
                  onClick={() => { if (store.startMap(m.id) === 'ok') onRun?.(); }}
                >
                  Run
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
