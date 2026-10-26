import { useEffect, useRef, useState } from 'react';
import { MAX_CHARACTER_NAME } from '../../core/names';
import { MAX_SEED_TEXT } from '../../core/seed';
import type { GameStore } from '../../store/gameStore';
import { useDialog } from '../useDialog';
import { nameProblem, seedProblem } from './startModel';
import './start.css';

interface Props {
  store: GameStore;
  /** 'first' covers the very first launch; 'newWorld' is Settings → "Start a new world…". */
  mode: 'first' | 'newWorld';
  /** Back to the previous surface; only 'newWorld' has one. */
  onBack?: () => void;
  /** The new world exists, so every surface can go. */
  onStart: () => void;
}

export function StartScreen({ store, mode, onBack, onStart }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape goes back only when there is somewhere to go back to; a first launch has none.
  const { focusRef, depth } = useDialog<HTMLInputElement>(
    () => { if (mode === 'newWorld') onBack?.(); },
    dialogRef,
  );
  const [name, setName] = useState(() => store.randomName());
  const [seed, setSeed] = useState(() => store.randomSeedText());
  const [confirm, setConfirm] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const confirmedOnce = useRef(false);

  // The confirm step replaces the form's Start button, so hand focus over; the first render keeps useDialog's focus.
  useEffect(() => {
    if (confirm) {
      confirmedOnce.current = true;
      noRef.current?.focus();
    } else if (confirmedOnce.current) {
      startRef.current?.focus();
    }
  }, [confirm]);

  const nameProblemText = nameProblem(name);
  const seedProblemText = seedProblem(seed);
  const ready = nameProblemText === null && seedProblemText === null;

  const start = (): void => {
    if (mode === 'newWorld') {
      setConfirm(true);
    } else {
      store.newWorld(name, seed);
      onStart();
    }
  };

  const confirmErase = (): void => {
    store.newWorld(name, seed);
    onStart();
  };

  const title = mode === 'newWorld' ? 'Start a new world' : 'Golden Miner';

  return (
    <div className="gm-start" style={{ zIndex: 10 + depth }}>
      <div
        ref={dialogRef}
        className="gm-start__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-start-title"
      >
        <div className="gm-start__head">
          <h1 id="gm-start-title" className="gm-start__title">{title}</h1>
          {mode === 'newWorld' && (
            <button type="button" className="gm-btn" onClick={onBack}>
              Back
            </button>
          )}
        </div>

        <p className="gm-start__lede">
          {mode === 'newWorld' ? 'Your gold, gear and depth are erased.' : 'Name your miner and choose a seed.'}
        </p>

        <fieldset className="gm-start__fields" disabled={confirm}>
          <legend className="gm-visually-hidden">New world</legend>

          <label className="gm-start__field">
            <span id="gm-start-name-label" className="gm-start__label">Miner&rsquo;s name</span>
            <span className="gm-start__row">
              <input
                ref={focusRef}
                type="text"
                className="gm-start__input"
                value={name}
                maxLength={MAX_CHARACTER_NAME}
                aria-labelledby="gm-start-name-label"
                aria-invalid={nameProblemText !== null || undefined}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                type="button"
                className="gm-btn gm-start__dice"
                aria-label="Random name"
                title="Random name"
                onClick={() => setName(store.randomName())}
              >
                ⚄
              </button>
            </span>
            {nameProblemText !== null && (
              <span role="alert" className="gm-start__problem">{nameProblemText}</span>
            )}
          </label>

          <label className="gm-start__field">
            <span id="gm-start-seed-label" className="gm-start__label">World seed</span>
            <span className="gm-start__row">
              <input
                type="text"
                className="gm-start__input"
                value={seed}
                maxLength={MAX_SEED_TEXT}
                aria-labelledby="gm-start-seed-label"
                aria-invalid={seedProblemText !== null || undefined}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setSeed(e.target.value)}
              />
              <button
                type="button"
                className="gm-btn gm-start__dice"
                aria-label="Random seed"
                title="Random seed"
                onClick={() => setSeed(store.randomSeedText())}
              >
                ⚄
              </button>
            </span>
            {seedProblemText !== null && (
              <span role="alert" className="gm-start__problem">{seedProblemText}</span>
            )}
          </label>

          <p className="gm-start__hint">
            Share it: the same seed builds the same mine for everyone. Loot is still your own luck.
          </p>
        </fieldset>

        {confirm ? (
          <div className="gm-dialog__actions">
            <span>Really erase this game?</span>
            <button type="button" className="gm-btn gm-btn--danger" onClick={confirmErase}>
              Yes
            </button>
            <button type="button" ref={noRef} className="gm-btn" onClick={() => setConfirm(false)}>
              No
            </button>
          </div>
        ) : (
          <div className="gm-dialog__actions">
            <button
              type="button"
              ref={startRef}
              className="gm-btn gm-btn--primary"
              disabled={!ready}
              onClick={start}
            >
              Start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
