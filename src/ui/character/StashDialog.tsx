import { useRef } from 'react';
import { STASH_SIZE } from '../../core/balance';
import { filledCount } from '../../core/cells';
import type { GearSet } from '../../core/items';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';
import { ItemGrid } from './ItemGrid';
import { useItemInteractions } from './useItemInteractions';

/** The stash: every item in it, with the same tooltips, clicks and action card as the bags. */
export function StashDialog({ store, set, onClose }: { store: GameStore; set: GearSet; onClose: () => void }) {
  const { state } = useGame(store);
  const closeRef = useDialog<HTMLButtonElement>(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { handlers, message, cards } = useItemInteractions({
    store, state, shownSet: set, containerRef: dialogRef, fallbackRef: titleRef,
  });
  return (
    <div className="gm-overlay">
      <div
        ref={dialogRef}
        className="gm-dialog gm-dialog--wide gm-stash"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-stash-title"
      >
        <div className="gm-dialog__head">
          <h2 id="gm-stash-title" ref={titleRef} tabIndex={-1} className="gm-dialog__title">
            Stash {formatNumber(filledCount(state.stash.general))} / {formatNumber(STASH_SIZE)}
          </h2>
          <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <ItemGrid
          className="gm-grid--stash"
          items={state.stash.general}
          capacity={STASH_SIZE}
          targetOf={(index) => ({ where: 'stash', index })}
          handlers={handlers}
        />
        <div className="gm-char__status gm-small" role="status">{message}</div>
        {cards}
      </div>
    </div>
  );
}
