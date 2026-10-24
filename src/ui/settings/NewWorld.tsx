import { useEffect, useRef, useState } from 'react';
import { isValidSeedText, MAX_SEED_TEXT } from '../../core/seed';
import type { GameStore } from '../../store/gameStore';
import { useDialog } from '../useDialog';

interface Props {
  store: GameStore;
  runAsOwner: (action: () => void) => boolean;
  /** Back to the previous dialog. */
  onClose: () => void;
  /** The new world exists, so every dialog can go. */
  onDone: () => void;
}

export function NewWorld({ store, runAsOwner, onClose, onDone }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusRef: closeRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const [random, setRandom] = useState(true);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const confirmedOnce = useRef(false);

  // The button that was focused unmounts when the row swaps, so hand focus over; the first render keeps useDialog's focus.
  useEffect(() => {
    if (confirm) {
      confirmedOnce.current = true;
      noRef.current?.focus();
    } else if (confirmedOnce.current) {
      startRef.current?.focus();
    }
  }, [confirm]);

  const ask = (): void => {
    if (!random && !isValidSeedText(text)) {
      setProblem(true);
      return;
    }
    setProblem(false);
    setConfirm(true);
  };

  const erase = (): void => {
    runAsOwner(() => store.newWorld(random ? null : text));
    onDone();
  };

  return (
    <div className="gm-overlay" style={{ zIndex: 10 + depth }}>
      <div ref={dialogRef} className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-newworld-title">
        <div className="gm-dialog__head">
          <h2 id="gm-newworld-title" className="gm-dialog__title">Start a new world</h2>
          <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>
            Back
          </button>
        </div>

        <fieldset className="gm-newworld__choices" disabled={confirm}>
          <legend className="gm-visually-hidden">World</legend>
          <label className="gm-newworld__choice">
            <input type="radio" name="gm-world" checked={random} onChange={() => { setRandom(true); setProblem(false); }} />
            Random world
          </label>
          <label className="gm-newworld__choice">
            <input type="radio" name="gm-world" checked={!random} onChange={() => setRandom(false)} />
            Use this seed
          </label>
          <input
            type="text"
            className="gm-newworld__text"
            value={text}
            maxLength={MAX_SEED_TEXT}
            placeholder="amber-fox-427"
            aria-label="Seed"
            aria-invalid={problem || undefined}
            onFocus={() => setRandom(false)}
            onChange={(e) => { setText(e.target.value); setProblem(false); setRandom(false); }}
          />
        </fieldset>
        {problem && <div role="alert" className="gm-newworld__problem">Type a seed, or pick a random world.</div>}

        <p className="gm-muted gm-small">Your gold, gear and depth are erased. The same seed always builds the same mine.</p>

        {confirm ? (
          <div className="gm-dialog__actions">
            <span>Really erase this game?</span>
            <button type="button" className="gm-btn gm-btn--danger" onClick={erase}>
              Yes
            </button>
            <button type="button" ref={noRef} className="gm-btn" onClick={() => setConfirm(false)}>
              No
            </button>
          </div>
        ) : (
          <div className="gm-dialog__actions">
            <button type="button" ref={startRef} className="gm-btn gm-btn--danger" onClick={ask}>
              Start a new world
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
