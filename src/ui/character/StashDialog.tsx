import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { BAG_SIZE, STASH_PAGE_SIZE } from '../../core/balance';
import { filledCount } from '../../core/cells';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { MapList } from '../maps/MapList';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';
import { dropAttr } from './dragDrop';
import { GemTab } from './GemTab';
import { ItemGrid } from './ItemGrid';
import { STASH_TABS, tabLabel } from './stashView';
import type { StashTab } from './stashView';
import type { ItemDrag } from './useItemDrag';
import { useItemInteractions } from './useItemInteractions';

const tabId = (tab: StashTab): string => `gm-stash-tab-${tab}`;

/**
 * The stash in tabs, with the bag beside it; both share the same tooltips, clicks and action card. While it is open,
 * `sayRef` points at its status line, so drop results show here rather than in the panel underneath. The General tab
 * shows its first page.
 */
export function StashDialog({ store, onClose, drag, sayRef }: {
  store: GameStore; onClose: () => void; drag: ItemDrag;
  sayRef: RefObject<((text: string | null) => void) | null>;
}) {
  const { state } = useGame(store);
  const [tab, setTab] = useState<StashTab>('general');
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusRef: closeRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Partial<Record<StashTab, HTMLButtonElement | null>>>({});
  const { handlers, message, say, cards, tapCard, reset } = useItemInteractions({
    store, state, containerRef: dialogRef, fallbackRef: titleRef, drag,
  });
  useEffect(() => {
    sayRef.current = say;
    return () => { sayRef.current = null; };
  }, [say, sayRef]);

  const openTab = (next: StashTab, focus = false): void => {
    setTab(next);
    reset();
    if (focus) tabRefs.current[next]?.focus();
  };
  const onTabKey = (e: KeyboardEvent): void => {
    const last = STASH_TABS.length - 1;
    const at = STASH_TABS.indexOf(tab);
    const index = e.key === 'ArrowRight' ? (at + 1) % STASH_TABS.length
      : e.key === 'ArrowLeft' ? (at + last) % STASH_TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (index < 0) return;
    e.preventDefault();
    const next = STASH_TABS[index];
    if (next !== undefined) openTab(next, true);
  };

  const bag = state.bag;
  return (
    <div className="gm-overlay gm-overlay--top" style={{ zIndex: 10 + depth }}>
      <div
        ref={dialogRef}
        className="gm-dialog gm-dialog--wide gm-stash"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-stash-title"
      >
        <div className="gm-dialog__head">
          <h2 id="gm-stash-title" ref={titleRef} tabIndex={-1} className="gm-dialog__title">Stash</h2>
          <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="gm-stash__body">
          <div className="gm-stash__main">
            <div role="tablist" aria-label="Stash tabs" className="gm-stash__tabs" onKeyDown={onTabKey}>
              {STASH_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={tabId(t)}
                  ref={(el) => { tabRefs.current[t] = el; }}
                  className="gm-stash__tab"
                  aria-selected={tab === t}
                  aria-controls="gm-stash-panel"
                  tabIndex={tab === t ? 0 : -1}
                  data-drop={dropAttr({ where: 'stashTab', tab: t })}
                  onClick={() => { if (!drag.onTap({ where: 'stashTab', tab: t }, false)) openTab(t); }}
                >
                  {tabLabel(state, t)}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id="gm-stash-panel"
              aria-labelledby={tabId(tab)}
              className="gm-stash__panel"
              tabIndex={tab === 'maps' ? 0 : undefined}
            >
              {tab === 'general' && (
                <ItemGrid
                  className="gm-grid--stash"
                  items={state.stash.general.slice(0, STASH_PAGE_SIZE)}
                  capacity={STASH_PAGE_SIZE}
                  targetOf={(index) => ({ where: 'stash', index })}
                  handlers={handlers}
                />
              )}
              {tab === 'gems' && <GemTab state={state} handlers={handlers} />}
              {tab === 'maps' && <MapList store={store} compact onRun={onClose} />}
            </div>
          </div>
          <div className="gm-stash__bag">
            <ItemGrid
              items={bag}
              capacity={BAG_SIZE}
              targetOf={(index) => ({ where: 'bag', index })}
              handlers={handlers}
            />
            <div className="gm-muted gm-small">
              Bag {formatNumber(filledCount(bag))} / {formatNumber(BAG_SIZE)}
            </div>
            {tapCard}
          </div>
        </div>
        <div className="gm-char__status gm-small" role="status">{message}</div>
        {cards}
      </div>
    </div>
  );
}
