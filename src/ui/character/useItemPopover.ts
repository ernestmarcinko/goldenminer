import { useCallback, useEffect, useRef, useState } from 'react';
import { sameLoc } from '../../core/cells';
import type { ItemTarget } from './itemActions';
import { CARD_PAIR_GAP, cardPairLayout, placeCardLeft, TOOLTIP_WIDTH } from './itemView';
import type { CardFit, Span } from './itemView';

/**
 * A card's place on the screen, in viewport coordinates (the cards are `position: fixed`, outside every scrolling
 * container). `inline`: a card opened by a touch tap, shown in the page flow below the grid instead of placed near the
 * item. `pair`: a hover or pinned card placed with the worn item's card beside it, so `left` is the pair's left edge.
 * `fit`: the item and the screen, so the card sets its own top once its height is known.
 */
export interface Placed { target: ItemTarget; left: number; inline?: true; pair?: true; fit?: CardFit }

/** How far inside the screen's top and bottom a card stays. */
const SCREEN_MARGIN = 8;

/** The rows of the screen a placed card stays inside. */
export function screenView(): Span {
  return { top: SCREEN_MARGIN, bottom: window.innerHeight - SCREEN_MARGIN };
}

/**
 * How far everything that scrolls around `el` has scrolled, down the page: the page itself and any scrolling box it
 * sits in. A change in it moves `el` on the screen by as much, the other way; a reflow (after a craft) does not.
 */
function scrolledAround(el: HTMLElement): number {
  let sum = 0;
  for (let p = el.parentElement; p !== null; p = p.parentElement) sum += p.scrollTop;
  return sum;
}

/**
 * The hover card, the pinned card (a plain click) and the action card (a right-click). `hasWornCard` says whether an
 * item's hover card shows the worn item's card too.
 */
export function useItemPopover(hasWornCard: (target: ItemTarget) => boolean) {
  const [hover, setHover] = useState<Placed | null>(null);
  const [pinned, setPinned] = useState<Placed | null>(null);
  const [menu, setMenu] = useState<Placed | null>(null);
  /**
   * How far the page's scrolling has moved the action card's item on the screen since the card opened (`by`), and the
   * card's left edge after a resize (`left`, null until one).
   */
  const [follow, setFollow] = useState<{ by: number; left: number | null }>({ by: 0, left: null });
  /** `scrolledAround` the action card's item, when it was last read. */
  const scrolledAt = useRef(0);
  const menuNow = useRef<Placed | null>(null);
  menuNow.current = menu;
  const pinnedNow = useRef<Placed | null>(null);
  pinnedNow.current = pinned;
  const opener = useRef<HTMLElement | null>(null);
  const pinOpener = useRef<HTMLElement | null>(null);
  const hasWornCardNow = useRef(hasWornCard);
  hasWornCardNow.current = hasWornCard;

  /**
   * Where a card opens for `el`; only the screen bounds it, so no container can cut it off. With `canPair`, a wide
   * screen shows the worn item's card beside it.
   */
  const place = useCallback((target: ItemTarget, el: HTMLElement, canPair: boolean): Placed => {
    const pair = canPair && cardPairLayout(window.innerWidth, false) === 'row' && hasWornCardNow.current(target);
    const r = el.getBoundingClientRect();
    const fit: CardFit = { anchor: { top: r.top, bottom: r.bottom }, view: screenView() };
    const width = pair ? 2 * TOOLTIP_WIDTH + CARD_PAIR_GAP : TOOLTIP_WIDTH;
    const left = placeCardLeft(r.left, width, document.documentElement.clientWidth);
    return pair ? { target, left, pair: true, fit } : { target, left, fit };
  }, []);

  /** A pinned card stays as it is until it closes, so hovering other items shows nothing meanwhile. */
  const inspect = useCallback((target: ItemTarget, el: HTMLElement) => {
    if (menuNow.current !== null || pinnedNow.current !== null) return;
    setHover(place(target, el, true));
  }, [place]);

  const clear = useCallback(() => setHover(null), []);

  /** A plain click: pins the item's card, or closes it when it is that item's card already. */
  const pin = useCallback((target: ItemTarget, el: HTMLElement) => {
    pinOpener.current = el;
    setHover(null);
    const was = pinnedNow.current;
    setPinned(was !== null && sameLoc(was.target, target) ? null : place(target, el, true));
  }, [place]);

  const unpin = useCallback(() => setPinned(null), []);

  const openMenu = useCallback((target: ItemTarget, el: HTMLElement, inline = false) => {
    opener.current = el;
    setHover(null);
    setPinned(null);
    setFollow({ by: 0, left: null });
    scrolledAt.current = scrolledAround(el);
    setMenu(inline ? { target, left: 0, inline: true } : place(target, el, false));
  }, [place]);

  /** With `restoreFocus`, focus goes back to the opener, or to `fallback` when the opener is gone. */
  const closeMenu = useCallback((restoreFocus = false, fallback?: HTMLElement | null) => {
    setMenu(null);
    if (!restoreFocus) return;
    const el = opener.current;
    // after the re-render, so an opener that the action removed is seen as gone. The fallback may be off the screen
    // (a heading above a scrolled grid): scrolling to it would move the page under a pointer that has not moved
    setTimeout(() => { if (el?.isConnected) el.focus(); else fallback?.focus({ preventScroll: true }); }, 0);
  }, []);

  /**
   * Focus left the card. It closes once the current click is over: closing it can scroll the page, and the click
   * that moved focus would then land on whatever moved under the pointer. A card opened meanwhile stays.
   */
  const leaveMenu = useCallback(() => {
    const leaving = menuNow.current;
    setTimeout(() => setMenu((m) => (m === leaving ? null : m)), 0);
  }, []);

  const isOpen = menu !== null || pinned !== null;
  useEffect(() => {
    if (!isOpen) return undefined;
    // on click (or right-click), not pointerdown, for the same reason as leaveMenu. A click on the pinned card closes
    // it too (it has no controls, and it may cover its own item). A click on the pinned card's own item is left to that
    // item, whose click closes it (or acts on it): closed here first, the item would pin it again.
    const onOutside = (e: MouseEvent): void => {
      if (!(e.target instanceof Node)) return;
      const inCard = e.target instanceof Element ? e.target.closest('[data-item-card]') : null;
      if (inCard !== null && !inCard.hasAttribute('data-pinned')) return;
      // a right-click on the pinned card only closes it, without the browser's menu
      if (inCard !== null && e.type === 'contextmenu') e.preventDefault();
      setMenu(null);
      if (e.type === 'click' && pinOpener.current?.contains(e.target) === true) return;
      setPinned(null);
    };
    // the action card closes itself on Escape, from inside; the pinned card never takes focus
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setPinned(null); };
    document.addEventListener('click', onOutside, true);
    document.addEventListener('contextmenu', onOutside, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onOutside, true);
      document.removeEventListener('contextmenu', onOutside, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // While an action card is open the page never scrolls by itself to keep what shows still (scroll anchoring): content
  // growing above the screen, such as a status line that wraps after a craft, would scroll the page, and the card would
  // follow an item that did not move. The page scroller is the root element; the grids only scroll sideways.
  const menuOpen = menu !== null;
  useEffect(() => {
    if (!menuOpen) return undefined;
    const root = document.documentElement;
    root.style.overflowAnchor = 'none';
    return () => { root.style.overflowAnchor = ''; };
  }, [menuOpen]);

  /** An open action card has no part left on the screen (its item still partly is): it closes, focus back on its item. */
  const loseMenu = useCallback(() => {
    setMenu(null);
    const el = opener.current;
    setTimeout(() => { if (el?.isConnected) el.focus({ preventScroll: true }); }, 0);
  }, []);

  // The page scrolls, or the window resizes, under a placed card. A hover card goes. A pinned card closes: it would sit
  // beside another item, and a Ctrl+click or Alt+click there would sell or salvage what the card doesn't show. An action
  // card follows its item by as far as the scrolling moved it (a reflow, after a craft, never moves the card), keeps
  // inside the screen's width after a resize, and closes once its item has left the screen. A card's own scroll inside
  // doesn't count.
  const placedOpen = hover !== null || pinned !== null || (menu !== null && menu.inline !== true);
  const menuPlaced = menu !== null && menu.inline !== true;
  useEffect(() => {
    if (!placedOpen) return undefined;
    const onMove = (e: Event): void => {
      if (e.target instanceof Element && e.target.closest('[data-item-card]') !== null) return;
      setHover(null);
      setPinned(null);
      const el = opener.current;
      if (!menuPlaced || el === null || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) {
        setMenu(null);
        return;
      }
      const now = scrolledAround(el);
      const by = scrolledAt.current - now;
      scrolledAt.current = now;
      const left = e.type === 'resize' ? placeCardLeft(r.left, TOOLTIP_WIDTH, document.documentElement.clientWidth) : null;
      setFollow((f) => ({ by: f.by + by, left: left ?? f.left }));
    };
    document.addEventListener('scroll', onMove, { capture: true, passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
  }, [placedOpen, menuPlaced]);

  return {
    hover, pinned, menu, follow: follow.by, menuLeft: follow.left ?? menu?.left ?? 0,
    inspect, clear, pin, unpin, openMenu, closeMenu, leaveMenu, loseMenu,
  };
}
