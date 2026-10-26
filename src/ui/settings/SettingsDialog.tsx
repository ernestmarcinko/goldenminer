import { useEffect, useRef, useState } from 'react';
import { SHAFT_MOTIONS, type MotionSettings, type ShaftMotion } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { LootFilterDialog } from '../character/LootFilterDialog';
import { copyText } from '../copyText';
import { DONATE_URL } from '../links';
import { StartScreen } from '../start/StartScreen';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';
import { effectiveMotion, usePrefersReducedMotion } from './motion';
import { SaveDialog } from './SaveDialog';
import './settings.css';

type Sub = 'filter' | 'save' | 'world';

const SWITCHES: readonly { key: 'floats' | 'pops' | 'lampFlicker'; label: string; hint: string }[] = [
  { key: 'floats', label: 'Floating numbers', hint: '+Gold, +Diamonds and damage numbers rise and fade' },
  { key: 'pops', label: 'Find pop-ups', hint: '"Chest!", "Map!" bursts at the dig face' },
  { key: 'lampFlicker', label: 'Lamp flicker', hint: 'The lamp light gently flickers' },
];

const SHAFT_LABEL: Record<ShaftMotion, string> = { step: 'Step', smooth: 'Smooth', off: 'Off' };

interface Props {
  store: GameStore;
  runAsOwner: (action: () => void) => boolean;
  onClose: () => void;
}

export function SettingsDialog({ store, runAsOwner, onClose }: Props) {
  const [sub, setSub] = useState<Sub | null>(null);
  // The sub-dialog replaces Settings rather than stacking on it, so Escape and focus have one owner at a time.
  const [lastSub, setLastSub] = useState<Sub | null>(null);
  const open = (next: Sub): void => { setLastSub(next); setSub(next); };
  const back = (): void => setSub(null);

  if (sub === 'filter') return <LootFilterDialog store={store} onClose={back} />;
  if (sub === 'save') return <SaveDialog store={store} runAsOwner={runAsOwner} onClose={back} />;
  if (sub === 'world') return <StartScreen store={store} mode="newWorld" onBack={back} onStart={onClose} />;
  return <SettingsMain store={store} returnTo={lastSub} onOpen={open} onClose={onClose} />;
}

function SettingsMain({ store, returnTo, onOpen, onClose }: {
  store: GameStore; returnTo: Sub | null; onOpen: (sub: Sub) => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusRef: closeRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const { state } = useGame(store);
  const reduced = usePrefersReducedMotion();
  const shown = effectiveMotion(state.settings.motion, reduced);
  const [copied, setCopied] = useState<boolean | null>(null);

  // Coming back from a sub-dialog, focus the button that opened it instead of Close.
  useEffect(() => {
    if (returnTo) document.querySelector<HTMLElement>(`[data-sub="${returnTo}"]`)?.focus();
  }, [returnTo]);

  const set = (patch: Partial<MotionSettings>): void => store.setMotion(patch);

  return (
    <div className="gm-overlay" style={{ zIndex: 10 + depth }}>
      <div ref={dialogRef} className="gm-dialog gm-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="gm-settings-title">
        <div className="gm-dialog__head">
          <h2 id="gm-settings-title" className="gm-dialog__title">Settings</h2>
          <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="gm-dialog__section" aria-label="Motion">
          <h3>Motion</h3>
          {SWITCHES.map((sw) => (
            <div key={sw.key} className="gm-setting">
              <span className="gm-setting__text">
                <span id={`gm-set-${sw.key}`}>{sw.label}</span>
                <span id={`gm-set-${sw.key}-hint`} className="gm-setting__hint">{sw.hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={shown[sw.key]}
                aria-labelledby={`gm-set-${sw.key}`}
                aria-describedby={`gm-set-${sw.key}-hint`}
                disabled={reduced}
                className="gm-switch"
                onClick={() => set({ [sw.key]: !state.settings.motion[sw.key] })}
              >
                <span className="gm-switch__track"><span className="gm-switch__knob" /></span>
              </button>
            </div>
          ))}
          <div className="gm-setting">
            <span className="gm-setting__text">
              <span id="gm-set-shaft">Mine shaft</span>
              <span className="gm-setting__hint">How the shaft moves when a metre is dug</span>
            </span>
            <div role="group" aria-labelledby="gm-set-shaft" className="gm-segment">
              {SHAFT_MOTIONS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="gm-segment__btn"
                  aria-pressed={shown.shaft === mode}
                  disabled={reduced}
                  onClick={() => set({ shaft: mode })}
                >
                  {SHAFT_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>
          {reduced && <div className="gm-setting__hint">Your system asks for reduced motion, so these are off.</div>}
        </section>

        <section className="gm-dialog__section gm-dialog__section--ruled" aria-label="World">
          <h3>World</h3>
          <div className="gm-seedrow">
            <span id="gm-name-label" className="gm-visually-hidden">Miner&rsquo;s name</span>
            <span className="gm-seedrow__seed" aria-labelledby="gm-name-label">{state.characterName}</span>
          </div>
          <div className="gm-seedrow">
            <span id="gm-seed-label" className="gm-visually-hidden">World seed</span>
            {/* The label stays outside the seed so selecting the seed by hand copies only the seed. */}
            <span className="gm-seedrow__seed" role="group" aria-labelledby="gm-seed-label">{state.worldSeed}</span>
            <button
              type="button"
              className="gm-btn"
              onClick={() => { void copyText(state.worldSeed, null).then(setCopied); }}
            >
              {copied === true ? 'Copied' : 'Copy seed'}
            </button>
          </div>
          {copied === false && <div role="status" className="gm-setting__hint">Could not copy: select the seed and copy it by hand.</div>}
          <div className="gm-setting__hint">
            Share it: the same seed builds the same mine for everyone. Loot is still your own luck.
          </div>
        </section>

        <section className="gm-dialog__section gm-dialog__section--ruled" aria-label="Game">
          <h3>Game</h3>
          <div className="gm-settings__buttons">
            <button type="button" className="gm-btn" data-sub="filter" onClick={() => onOpen('filter')}>
              Loot filter…
            </button>
            <button type="button" className="gm-btn" data-sub="save" onClick={() => onOpen('save')}>
              Export / import save…
            </button>
            <button type="button" className="gm-btn gm-btn--danger" data-sub="world" onClick={() => onOpen('world')}>
              Start a new world…
            </button>
          </div>
          {DONATE_URL !== '' && (
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="gm-settings__donate">
              Support the game (donate)
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
