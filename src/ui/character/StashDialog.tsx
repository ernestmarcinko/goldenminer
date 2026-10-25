import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { BAG_SIZE, MAX_STASH_PAGES, STASH_PAGE_SIZE } from '../../core/balance';
import { filledCount, mapTiers, pageCount } from '../../core/cells';
import type { Cell } from '../../core/items';
import type { GameState, ItemLoc } from '../../core/types';
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

/** Every map in the Map stash, the lowest tier first; empty places after them take a drop, which joins its own tier. */
function mapCells(state: GameState): { items: Cell[]; locs: ItemLoc[] } {
  const items: Cell[] = [];
  const locs: ItemLoc[] = [];
  for (const tier of mapTiers(state)) {
    (state.stash.maps[tier] ?? []).forEach((m, index) => { items.push(m); locs.push({ where: 'maps', tier, index }); });
  }
  return { items, locs };
}

/** One button per page, the shown one pressed, then the button that buys the next page (gone at the page cap). */
function PageRow({ state, shown, onShow, onBuy }: {
  state: GameState; shown: number; onShow: (page: number) => void; onBuy: () => void;
}) {
  const pages = pageCount(state.stash.general);
  const buy = buyLabel(state);
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
 * `sayRef` points at its status line, so drop results show here rather than in the panel underneath. The General tab
 * shows one page at a time, and remembers it while the dialog is open; the Maps tab shows every map in one grid. A map
 * run from here closes the dialog.
 */
export function StashDialog({ store, onClose, drag, sayRef }: {
  store: GameStore; onClose: () => void; drag: ItemDrag;
  sayRef: RefObject<((text: string | null) => void) | null>;
}) {
  const { state } = useGame(store);
  const [tab, setTab] = useState<StashTab>('general');
  const [page, setPage] = useState(0);
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
  /** The shown General page, kept inside the pages it has. */
  const shownPage = Math.min(page, pageCount(state.stash.general) - 1);
  const showPage = (next: number): void => {
    setPage(next);
    reset();
  };
  const buyPage = (): void => {
    if (!buyLabel(state).affordable) {
      say('Not enough Gold.');
      return;
    }
    const result = store.buyStashPage();
    if (result === 'noGold') say('Not enough Gold.');
    else if (result === 'ok') showPage(pageCount(store.state.stash.general) - 1);
  };
  const generalGrid = () => {
    const offset = shownPage * STASH_PAGE_SIZE;
    return (
      <div className="gm-stash__paged">
        <PageRow state={state} shown={shownPage} onShow={showPage} onBuy={buyPage} />
        <ItemGrid
          items={pageCells<Cell>(state.stash.general, shownPage)}
          capacity={STASH_PAGE_SIZE}
          targetOf={(index) => ({ where: 'stash', index: offset + index })}
          handlers={handlers}
        />
      </div>
    );
  };
  const mapsGrid = () => {
    const { items, locs } = mapCells(state);
    // an empty place names a spot past the end of tier 1: a map dropped on it joins its own tier all the same
    const spare = state.stash.maps[1]?.length ?? 0;
    return (
      <ItemGrid
        items={items}
        capacity={Math.max(STASH_PAGE_SIZE, items.length)}
        targetOf={(index) => locs[index] ?? { where: 'maps', tier: 1, index: spare + index - items.length }}
        handlers={handlers}
      />
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
              {tab === 'general' && generalGrid()}
              {tab === 'gems' && <GemTab state={state} handlers={handlers} />}
              {tab === 'maps' && mapsGrid()}
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
