import type { RefObject } from 'react';
import { MAP_STASH_SIZE } from '../../core/balance';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { MapList } from './MapList';
import { gainsLine, mapDungeon, runTitle } from './mapsView';
import './maps.css';

/** `lastRunRef` is the Last run card's heading, where focus lands when the run result is dismissed. */
export function MapsView({ store, lastRunRef }: { store: GameStore; lastRunRef?: RefObject<HTMLHeadingElement | null> }) {
  const { state } = useGame(store);
  const last = state.lastRun;
  return (
    <div className="gm-mapsview">
      <div className="gm-mapsview__head">
        <h2 className="gm-mapsview__title">Maps</h2>
        <span className="gm-muted">{formatNumber(state.stash.maps.length)} / {formatNumber(MAP_STASH_SIZE)} in your Maps tab</span>
      </div>
      {last !== null && (
        <section className="gm-lastrun" aria-label="Last run">
          <h3 ref={lastRunRef} tabIndex={-1} className="gm-lastrun__label">Last run</h3>
          <div className="gm-lastrun__title" data-outcome={last.outcome}>{runTitle(last)}</div>
          <div className="gm-muted">
            {mapDungeon(state.seed, last.map).type.name} · tier {formatNumber(last.map.tier)}
          </div>
          <div className="gm-lastrun__gains">{gainsLine(last.gained, last.items)}</div>
        </section>
      )}
      <MapList store={store} />
    </div>
  );
}
