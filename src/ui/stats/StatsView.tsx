import type { GameStore } from '../../store/gameStore';
import { useGame } from '../useGame';
import { statsVMs } from './statsView';
import './stats.css';

/** The stats tab: the whole lifetime ledger, grouped into the catalogue's categories. Read-only. */
export function StatsView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const groups = statsVMs(state);
  return (
    <div className="gm-stats">
      <div className="gm-stats__head">
        <h2 className="gm-stats__title">Statistics</h2>
      </div>
      {groups.map((group) => (
        <section key={group.id} className="gm-stats__group" aria-label={group.label}>
          <h3 className="gm-stats__group-label">{group.label}</h3>
          <ul className="gm-stats__list">
            {group.rows.map((row) => (
              <li key={row.label} className="gm-stats__row">
                <span className="gm-stats__label">{row.label}</span>
                <span className="gm-stats__value">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
