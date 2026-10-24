import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { BAG_SIZE, MAX_STASH_PAGES, STASH_PAGE_SIZE } from '../../core/balance';
import { filledCount, pageCount } from '../../core/cells';
import type { Cell } from '../../core/items';
import type { GameState } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';
import { dropAttr } from './dragDrop';
import { GemTab } from './GemTab';
import { ItemGrid } from './ItemGrid';
import { MaterialTab } from './MaterialTab';
import { buyLabel, pageCells, STASH_TABS, tabLabel } from './stashView';
import type { StashTab } from './stashView';
import type { ItemDrag } from './useItemDrag';
import { useItemInteractions } from './useItemInteractions';

const tabId = (tab: StashTab): string => `gm-stash-tab-${tab}`;
type PagedTab = 'general' | 'maps';

/** One button per page, the shown one pressed, then the button that buys the next page (gone at the page cap). */
function PageRow({ state, tab, shown, onShow, onBuy }: {
  state: GameState; tab: PagedTab; shown: number; onShow: (page: number) => void; onBuy: () => void;
}) {
  const pages = pageCount(state.stash[tab]);
  const buy = buyLabel(state, tab);
  return (
    <div className="gm-stash__pages" role="group" aria-label="Pages">
      {Array.from({ length: pages }, (_, page) => (
        <button
          key={page}
          type="button"
          className="gm-stash__page"
          aria-pressed={page === shown}
          onClick={() => onShow(page)}
        >
          Page {formatNumber(page + 1)}
        </button>
      ))}
      {pages < MAX_STASH_PAGES && (
        <button
          type="button"
          className="gm-stash__page gm-stash__page--buy"
          aria-disabled={!buy.affordable || undefined}
          onClick={onBuy}
        >
          {buy.text}
        </button>
      )}
    </div>
  );
}

/**
 * The stash in tabs, with the bag beside it; both share the same tooltips, clicks and action card. While it is open,
 * `sayRef` points at its status line, so drop results show here rather than in the panel underneath. The General and
 * Maps tabs show one page at a time, and remember it while the dialog is open. A map run from here closes the dialog.
 */
export function StashDialog({ store, onClose, drag, sayRef }: {
  store: GameStore; onClose: () => void; drag: ItemDrag;
  sayRef: RefObject<((text: string | null) => void) | null>;
}) {
  const { state } = useGame(store);
  const [tab, setTab] = useState<StashTab>('general');
  const [pages, setPages] = useState<Record<PagedTab, number>>({ general: 0, maps: 0 });
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
  // the App shows the Maps view by itself when a run starts; the dialog only has to get out of the way
  const running = state.activity.kind === 'map';
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running && !wasRunning.current) onClose();
    wasRunning.current = running;
  }, [running, onClose]);

  const openTab = (next: StashTab, focus = false): void => {
    setTab(next);
    reset();
    if (focus) tabRefs.current[next]?.focus();
  };
  /** The shown page of a paged tab, kept inside the pages it has. */
  const shownPage = (t: PagedTab): number => Math.min(pages[t], pageCount(state.stash[t]) - 1);
  const showPage = (t: PagedTab, page: number): void => {
    setPages((p) => ({ ...p, [t]: page }));
    reset();
  };
  const buyPage = (t: PagedTab): void => {
    if (!buyLabel(state, t).affordable) {
      say('Not enough Gold.');
      return;
    }
    const result = store.buyStashPage(t);
    if (result === 'noGold') say('Not enough Gold.');
    else if (result === 'ok') showPage(t, pageCount(store.state.stash[t]) - 1);
  };
  const pagedGrid = (t: PagedTab) => {
    const page = shownPage(t);
    const offset = page * STASH_PAGE_SIZE;
    return (
      <div className="gm-stash__paged">
        <PageRow state={state} tab={t} shown={page} onShow={(p) => showPage(t, p)} onBuy={() => buyPage(t)} />
        <ItemGrid
          items={pageCells<Cell>(state.stash[t], page)}
          capacity={STASH_PAGE_SIZE}
          targetOf={(index) => ({ where: t === 'general' ? 'stash' : 'maps', index: offset + index })}
          handlers={handlers}
        />
      </div>
    );
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
            >
              {tab === 'general' && pagedGrid('general')}
              {tab === 'gems' && <GemTab state={state} handlers={handlers} />}
              {tab === 'maps' && pagedGrid('maps')}
              {tab === 'materials' && <MaterialTab state={state} handlers={handlers} />}
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
