import type { RefObject } from 'react';
import type { GameStore } from '../../store/gameStore';
import { gainsLine, runMapLine, runTitle } from '../run/runView';
import { useGame } from '../useGame';
import '../run/run.css';
import './log.css';

/** `lastRunRef` is the Last run card's heading, which takes focus on request. */
export function LogView({ store, lastRunRef }: { store: GameStore; lastRunRef?: RefObject<HTMLHeadingElement | null> }) {
  const { state } = useGame(store);
  const last = state.lastRun;
  return (
    <div className="gm-logview">
      <h2 className="gm-logview__title">Log</h2>
      {last !== null && (
        <section className="gm-lastrun" aria-label="Last run">
          <h3 ref={lastRunRef} tabIndex={-1} className="gm-lastrun__label">Last run</h3>
          <div className="gm-lastrun__title" data-outcome={last.outcome}>{runTitle(last)}</div>
          <div className="gm-muted">{runMapLine(state.seed, last.map)}</div>
          <div className="gm-lastrun__gains">{gainsLine(last.gained, last.items)}</div>
        </section>
      )}
    </div>
  );
}
