import { useRef, type RefObject } from 'react';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { gainsLine, mapDungeon, runTitle } from '../maps/mapsView';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';

/** The result of a run that has ended, until the player dismisses it. It shows on any view, since a run ends anywhere. */
export function RunResultDialog({ store, fallbackFocus }: { store: GameStore; fallbackFocus: RefObject<HTMLElement | null> }) {
  const { state } = useGame(store);
  const last = state.lastRun;
  if (last === null || last.seen) return null;
  return (
    <ResultBody
      title={runTitle(last)}
      dungeon={`${mapDungeon(state.seed, last.map).type.name} · tier ${formatNumber(last.map.tier)}`}
      gains={gainsLine(last.gained, last.items)}
      outcome={last.outcome}
      fallbackFocus={fallbackFocus}
      onClose={() => store.dismissRun()}
    />
  );
}

/** `fallbackFocus` takes focus on close when the screen the dialog was opened from is gone (the run screen ends with the run). */
function ResultBody({ title, dungeon, gains, outcome, fallbackFocus, onClose }: {
  title: string; dungeon: string; gains: string; outcome: string; fallbackFocus: RefObject<HTMLElement | null>; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusRef: okRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef, fallbackFocus);
  return (
    <div className="gm-overlay" style={{ zIndex: 10 + depth }}>
      <div ref={dialogRef} className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-run-result-title">
        <h2 id="gm-run-result-title" className="gm-dialog__title" data-outcome={outcome}>{title}</h2>
        <p className="gm-muted">{dungeon}</p>
        <p className="gm-runresult__gains">{gains}</p>
        <div className="gm-dialog__actions">
          <button type="button" ref={okRef} className="gm-btn gm-btn--primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
