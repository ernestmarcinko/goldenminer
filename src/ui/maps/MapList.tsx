import { useId } from 'react';
import type { GameStore } from '../../store/gameStore';
import { formatNumber, plural } from '../format';
import { useGame } from '../useGame';
import type { MapRow } from './mapsView';
import './maps.css';

const BUSY = 'Leave the current map first';

const whereText = (r: MapRow): string => (r.where === 'bag' ? 'in your bag' : `Maps tab, page ${formatNumber(r.page)}`);

/** One row per map. `rows` come from `mapRows`, which the parent memoises on the store's version. */
export function MapList({ store, rows }: { store: GameStore; rows: readonly MapRow[] }) {
  const { state } = useGame(store);
  const running = state.activity.kind === 'map';
  const busyId = useId();
  if (rows.length === 0) {
    return <p className="gm-maps__empty gm-muted">No maps yet. Dungeon entrances you dig into become maps.</p>;
  }
  return (
    <div className="gm-maps">
      {running && <p id={busyId} className="gm-visually-hidden">{BUSY}</p>}
      <ul className="gm-maps__rows">
        {rows.map((r) => (
          <li key={r.id} className="gm-maps__row">
            <span className="gm-badge">T{formatNumber(r.tier)}</span>
            <span className="gm-maps__info">
              <span className="gm-maps__name">{r.name}</span>
              <span className="gm-maps__found">
                found at {formatNumber(r.metre)} m · {plural(r.rooms, 'room', 'rooms')} · {whereText(r)}
              </span>
            </span>
            <button
              type="button"
              className="gm-btn gm-maps__run"
              disabled={running}
              title={running ? BUSY : undefined}
              aria-describedby={running ? busyId : undefined}
              aria-label={`Run ${r.name}, found at ${formatNumber(r.metre)} m`}
              onClick={() => { store.startMap(r.id); }}
            >
              Run
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
