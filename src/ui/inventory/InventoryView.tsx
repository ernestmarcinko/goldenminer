import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { BAG_SIZE, MAX_STASH_PAGES, STASH_PAGE_SIZE } from '../../core/balance';
import { pageCount } from '../../core/cells';
import { setOfSlot, type Cell, type GearSet } from '../../core/items';
import type { GameState } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { dropAttr } from '../character/dragDrop';
import { CharacterSheet } from '../character/CharacterSheet';
import { OrbTab } from '../character/OrbTab';
import { GemTab } from '../character/GemTab';
import { ItemGrid } from '../character/ItemGrid';
import type { ItemHandlers } from '../character/ItemGrid';
import { LootFilterDialog } from '../character/LootFilterDialog';
import { MaterialTab } from '../character/MaterialTab';
import { PaperDoll } from '../character/PaperDoll';
import { RuneTab } from '../character/RuneTab';
import {
  bagHeading, buyLabel, gridCapacity, mapTierCaption, mapTierCells, mapTiers, pageCells, pickTier, STASH_TABS, tabLabel,
} from '../character/stashView';
import type { StashTab } from '../character/stashView';
import { useItemDrag } from '../character/useItemDrag';
import { useItemInteractions } from '../character/useItemInteractions';
import { formatNumber } from '../format';
import { useRecentEquip } from '../Toast';
import { useGame } from '../useGame';
import '../character/character.css';
import './inventory.css';

// The toggle switches the paper doll and its stat line; the one bag holds both sets.
const SETS: readonly { set: GearSet; toggle: string }[] = [
  { set: 'mining', toggle: 'Mining set' },
  { set: 'battle', toggle: 'Battle set' },
];

const tabId = (tab: StashTab): string => `gm-stash-tab-${tab}`;

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

/** The Maps tab: a chip per tier it holds, then the shown tier's maps. An empty cell takes a map into its own tier. */
function MapsTab({ state, handlers, tier, onTier }: {
  state: GameState; handlers: ItemHandlers; tier: number | null; onTier: (tier: number) => void;
}) {
  const tiers = mapTiers(state);
  const cells = tier === null ? [] : mapTierCells(state, tier);
  return (
    <div className="gm-stash__paged">
      {tiers.length > 0 && (
        <div className="gm-stash__pages" role="group" aria-label="Map tiers">
          {tiers.map((t) => (
            <button
              key={t.tier}
              type="button"
              className="gm-stash__page"
              aria-pressed={t.tier === tier}
              onClick={() => onTier(t.tier)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ItemGrid
        items={cells.map((c) => c.item)}
        capacity={gridCapacity(cells.length)}
        targetOf={(index) => cells[index]?.loc ?? { where: 'maps', tier: tier ?? 1, index }}
        handlers={handlers}
        emptyTarget={{ where: 'stashTab', tab: 'maps' }}
      />
      <div className="gm-muted gm-small">
        {tier === null ? 'No maps in the stash. A map moved here joins its own tier.' : mapTierCaption(tier, cells.length)}
      </div>
    </div>
  );
}

/**
 * The doll, the bag and the stash side by side (stacked on a phone). They share one drag controller, one status line
 * and one set of cards, placed on the screen. The General tab shows one page at a time and the Maps tab one
 * tier, each remembered while the view is open.
 */
export function InventoryView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const recentEquip = useRecentEquip(store);
  const flashSlot = recentEquip?.slot ?? null;
  const running = state.activity.kind === 'map';
  const [set, setSet] = useState<GearSet>(running ? 'battle' : 'mining');
  const [sheetHalf, setSheetHalf] = useState<'mining' | 'battle'>(running ? 'battle' : 'mining');
  const [filterOpen, setFilterOpen] = useState(false);
  const [tab, setTab] = useState<StashTab>('general');
  const [page, setPage] = useState(0);
  const [wantedTier, setWantedTier] = useState<number | null>(null);
  const bagHeadingRef = useRef<HTMLHeadingElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<StashTab, HTMLButtonElement | null>>>({});
  const drag = useItemDrag({ store, onResult: (text) => say(text) });
  const { handlers, message, say, cards, tapCard, tapWhere, reset } = useItemInteractions({
    store, state, fallbackRef: bagHeadingRef, drag,
  });

  // a run starting shows the Battle set and its ending the Mining set; an equip shows the set it went into, so its glow is seen
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running === wasRunning.current) return;
    wasRunning.current = running;
    setSet(running ? 'battle' : 'mining');
    reset();
  }, [running, reset]);
  const shownEquip = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (recentEquip === null || recentEquip.id === shownEquip.current) return;
    shownEquip.current = recentEquip.id;
    setSet(setOfSlot(recentEquip.slot));
    reset();
  }, [recentEquip, reset]);

  const closeFilter = (): void => {
    setFilterOpen(false);
    setTimeout(() => filterButtonRef.current?.focus(), 0);
  };

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
  const shownTier = pickTier(mapTiers(state).map((t) => t.tier), wantedTier);
  const showTier = (next: number): void => {
    setWantedTier(next);
    reset();
  };

  const offset = shownPage * STASH_PAGE_SIZE;
  const bag = state.bag;
  const heading = bagHeading(state);
  // a tap card sits under the grid its item is in, so the page never scrolls away from that item
  const tapSpot = tapWhere === 'worn' ? 'doll' : tapWhere === 'bag' ? 'bag' : tapWhere === null ? null : 'stash';
  return (
    <div className="gm-inv">
      <h2 className="gm-visually-hidden">Inventory</h2>
      <section aria-label="Gear" className="gm-inv__col gm-inv__col--doll">
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
        <PaperDoll state={state} set={set} handlers={handlers} flashSlot={flashSlot} />
        {tapSpot === 'doll' && tapCard}
        <div className="gm-char__stats">
          <div role="group" aria-label="Character stats" className="gm-char__toggle gm-sheet__toggle">
            <button
              type="button"
              className="gm-char__tab"
              aria-pressed={sheetHalf === 'mining'}
              onClick={() => setSheetHalf('mining')}
            >
              Mining
            </button>
            <button
              type="button"
              className="gm-char__tab"
              aria-pressed={sheetHalf === 'battle'}
              onClick={() => setSheetHalf('battle')}
            >
              Battle
            </button>
          </div>
          <CharacterSheet state={state} half={sheetHalf} />
        </div>
      </section>

      <section aria-label="Bag" className="gm-inv__col">
        <div className="gm-char__baghead">
          <h3 ref={bagHeadingRef} tabIndex={-1} className="gm-char__bag">
            Bag <span className="gm-muted">{heading.filled}</span>
            {heading.held !== null && <>{' '}<span className="gm-muted">{heading.held}</span></>}
          </h3>
          <button type="button" ref={filterButtonRef} className="gm-btn" onClick={() => setFilterOpen(true)}>
            Loot filter
          </button>
        </div>
        <ItemGrid
          items={bag}
          capacity={BAG_SIZE}
          targetOf={(index) => ({ where: 'bag', index })}
          handlers={handlers}
        />
        {tapSpot === 'bag' && tapCard}
        <div className="gm-char__status gm-small" role="status">{message}</div>
        <p className="gm-char__hint gm-muted gm-small">
          Hover an item to inspect it, click for its card, right-click for actions. Ctrl+click sells, Alt+click salvages,
          Shift+click moves between bag and stash (⌘ instead of Ctrl on a Mac). Drag items to cells, slots and tabs;
          drag a gem onto gear to socket it, a material onto gear or a map to craft. On a touch screen, tap an item to
          pick it up, then tap where it goes.
        </p>
      </section>

      <section aria-label="Stash" className="gm-inv__col gm-inv__col--stash">
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
        <div role="tabpanel" id="gm-stash-panel" aria-labelledby={tabId(tab)} className="gm-stash__panel">
          {tab === 'general' && (
            <div className="gm-stash__paged">
              <PageRow state={state} shown={shownPage} onShow={showPage} onBuy={buyPage} />
              <ItemGrid
                items={pageCells<Cell>(state.stash.general, shownPage)}
                capacity={STASH_PAGE_SIZE}
                targetOf={(index) => ({ where: 'stash', index: offset + index })}
                handlers={handlers}
              />
            </div>
          )}
          {tab === 'gems' && <GemTab state={state} handlers={handlers} />}
          {tab === 'runes' && <RuneTab state={state} handlers={handlers} />}
          {tab === 'maps' && <MapsTab state={state} handlers={handlers} tier={shownTier} onTier={showTier} />}
          {tab === 'materials' && <MaterialTab state={state} handlers={handlers} />}
          {tab === 'orbs' && <OrbTab state={state} handlers={handlers} />}
          {tapSpot === 'stash' && tapCard}
        </div>
      </section>

      {cards}
      {filterOpen && <LootFilterDialog store={store} onClose={closeFilter} />}
    </div>
  );
}
