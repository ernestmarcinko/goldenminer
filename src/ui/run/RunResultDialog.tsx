import { useRef, type RefObject } from 'react';
import type { GameStore } from '../../store/gameStore';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';
import { gainsLine, runMapLine, runTitle } from './runView';

/**
 * The result of a run that has ended, until the player dismisses it. It shows on any view, since a run ends anywhere;
 * `onDismiss` runs as it closes, or `onShowDeath` with the death's id when a death's link to the Log closes it.
 */
export function RunResultDialog({ store, fallbackFocus, onDismiss, onShowDeath }: {
  store: GameStore; fallbackFocus: RefObject<HTMLElement | null>; onDismiss: () => void; onShowDeath: (deathId: number) => void;
}) {
  const { state } = useGame(store);
  const last = state.lastRun;
  if (last === null || last.seen) return null;
  const death = last.outcome === 'died' ? state.deaths[state.deaths.length - 1] : undefined;
  return (
    <ResultBody
      title={runTitle(last)}
      dungeon={runMapLine(state.seed, last.map)}
      gains={gainsLine(last.gained, last.items)}
      outcome={last.outcome}
      fallbackFocus={fallbackFocus}
      onClose={() => { store.dismissRun(); onDismiss(); }}
      onShowDeath={death === undefined ? undefined : () => { store.dismissRun(); onShowDeath(death.id); }}
    />
  );
}

/** `fallbackFocus` takes focus on close when the screen the dialog was opened from is gone (the run screen ends with the run). */
function ResultBody({ title, dungeon, gains, outcome, fallbackFocus, onClose, onShowDeath }: {
  title: string; dungeon: string; gains: string; outcome: string; fallbackFocus: RefObject<HTMLElement | null>; onClose: () => void;
  onShowDeath?: () => void;
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
          {onShowDeath !== undefined && <button type="button" className="gm-btn" onClick={onShowDeath}>See it in the Log</button>}
          <button type="button" ref={okRef} className="gm-btn gm-btn--primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
