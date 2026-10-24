import { useRef, useState } from 'react';
import { BAG_SIZE, STASH_SIZE } from '../../core/balance';
import { filledCount } from '../../core/cells';
import type { GearSet } from '../../core/items';
import { gearTotals } from '../../core/stats';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { dropAttr } from './dragDrop';
import { ItemGrid } from './ItemGrid';
import { battleStatLine, miningStatLine } from './itemView';
import { LootFilterDialog } from './LootFilterDialog';
import { PaperDoll } from './PaperDoll';
import { StashDialog } from './StashDialog';
import { useItemDrag } from './useItemDrag';
import { useItemInteractions } from './useItemInteractions';
import './character.css';

const SETS: readonly { set: GearSet; toggle: string; bag: string }[] = [
  { set: 'mining', toggle: 'Mining set', bag: 'Mining bag' },
  { set: 'battle', toggle: 'Battle set', bag: 'Battle bag' },
];

type Dialog = 'stash' | 'filter' | null;

export function CharacterPanel({ store }: { store: GameStore }) {
  const { state, stats } = useGame(store);
  const [set, setSet] = useState<GearSet>('mining');
  const [dialog, setDialog] = useState<Dialog>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bagHeadingRef = useRef<HTMLHeadingElement>(null);
  const stashButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  // one drag controller for the panel and the stash; a drop result shows on the stash's status line while it is open
  const stashSay = useRef<((text: string | null) => void) | null>(null);
  const drag = useItemDrag({ store, onResult: (text) => (stashSay.current ?? say)(text) });
  const { handlers, message, say, cards, tapCard, reset } = useItemInteractions({
    store, state, shownSet: set, containerRef: panelRef, fallbackRef: bagHeadingRef, drag,
  });

  const closeDialog = (): void => {
    const back = dialog === 'stash' ? stashButtonRef : filterButtonRef;
    if (dialog === 'stash') drag.release();
    setDialog(null);
    setTimeout(() => back.current?.focus(), 0);
  };

  const current = SETS.find((s) => s.set === set) ?? SETS[0];
  const bag = state.bags[set];
  return (
    <section ref={panelRef} aria-label="Character" className="gm-char">
      <div className="gm-char__head">
        <h2 className="gm-char__title">Character</h2>
        <div role="group" aria-label="Gear set" className="gm-char__toggle">
          {SETS.map((s) => (
            <button
              key={s.set}
              type="button"
              className="gm-char__tab"
              aria-pressed={set === s.set}
              onClick={() => { setSet(s.set); reset(); }}
            >
              {s.toggle}
            </button>
          ))}
        </div>
      </div>

      <PaperDoll state={state} set={set} handlers={handlers} />

      <div className="gm-char__stats">
        {set === 'mining' ? miningStatLine(stats, state.deepest) : battleStatLine(gearTotals(state, 'battle'))}
      </div>

      <div className="gm-char__baghead">
        <h3 ref={bagHeadingRef} tabIndex={-1} className="gm-char__bag">
          {current?.bag} <span className="gm-muted">{formatNumber(filledCount(bag))} / {formatNumber(BAG_SIZE)}</span>
        </h3>
        <div className="gm-char__bagbtns">
          <button type="button" ref={filterButtonRef} className="gm-btn" onClick={() => setDialog('filter')}>
            Loot filter
          </button>
          <button
            type="button"
            ref={stashButtonRef}
            className="gm-btn"
            data-drop={dropAttr({ where: 'stashTab', tab: 'auto' })}
            onClick={() => { if (!drag.onTap({ where: 'stashTab', tab: 'auto' }, false)) setDialog('stash'); }}
          >
            Stash {formatNumber(filledCount(state.stash.general))} / {formatNumber(STASH_SIZE)}
          </button>
        </div>
      </div>
      <ItemGrid
        items={bag}
        capacity={BAG_SIZE}
        targetOf={(index) => ({ where: 'bag', set, index })}
        handlers={handlers}
      />
      {tapCard}
      <div className="gm-char__status gm-small" role="status">{message}</div>
      <p className="gm-char__hint gm-muted gm-small">
        Hover an item to inspect it, click to equip, or drag it to a cell, a slot or the Stash button. Alt+click sells,
        Shift+click stashes, right-click shows everything. On a touch screen, tap an item to pick it up, then tap where
        it goes.
      </p>

      {cards}
      {dialog === 'stash' && <StashDialog store={store} set={set} onClose={closeDialog} drag={drag} sayRef={stashSay} />}
      {dialog === 'filter' && <LootFilterDialog store={store} onClose={closeDialog} />}
    </section>
  );
}
