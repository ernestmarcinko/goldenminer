import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ItemTarget } from './itemActions';
import { CARD_PAIR_GAP, cardPairLayout, placeTooltip, TOOLTIP_WIDTH } from './itemView';
import type { Span } from './itemView';

/** Where an action card's item is and which rows show, so the card can be fitted once its height is known. */
export interface CardFit { anchor: Span; view: Span }

/**
 * `inline`: a card opened by a touch tap, shown in the page flow below the grid instead of placed near the item.
 * `pair`: a hover card placed with the worn item's card beside it, so `left` is the pair's left edge.
 * `fit`: set on a placed action card, whose `top` is only where it starts.
 */
export interface Placed { target: ItemTarget; left: number; top: number; inline?: true; pair?: true; fit?: CardFit }

/** How far inside the screen's edges a placed card stays. */
const SCREEN_MARGIN = 8;

/**
 * The rows of `c`, in its own coordinates, that show on screen: the viewport, cut by every ancestor (or `c`) that
 * clips, such as a scrolling dialog.
 */
function visibleRows(c: HTMLElement): Span {
  let top = 0;
  let bottom = window.innerHeight;
  for (let el: HTMLElement | null = c; el !== null && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).overflowY === 'visible') continue;
    const r = el.getBoundingClientRect();
    top = Math.max(top, r.top + el.clientTop);
    bottom = Math.min(bottom, r.top + el.clientTop + el.clientHeight);
  }
  const origin = c.getBoundingClientRect().top + c.clientTop - c.scrollTop;
  return { top: top + SCREEN_MARGIN - origin, bottom: bottom - SCREEN_MARGIN - origin };
}

/**
 * Hover tooltip and action-card state; positions are relative to the container, which must be `position: relative`.
 * `hasWornCard` says whether an item's hover card shows the worn item's card too.
 */
export function useItemPopover(containerRef: RefObject<HTMLElement | null>, hasWornCard: (target: ItemTarget) => boolean) {
  const [hover, setHover] = useState<Placed | null>(null);
  const [menu, setMenu] = useState<Placed | null>(null);
  const menuNow = useRef<Placed | null>(null);
  menuNow.current = menu;
  const opener = useRef<HTMLElement | null>(null);
  const hasWornCardNow = useRef(hasWornCard);
  hasWornCardNow.current = hasWornCard;

  const place = useCallback((target: ItemTarget, el: HTMLElement, pair = false, menu = false): Placed | null => {
    const c = containerRef.current;
    if (c === null) return null;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const anchor = {
      left: er.left - cr.left - c.clientLeft + c.scrollLeft, top: er.top - cr.top - c.clientTop + c.scrollTop,
      width: er.width, height: er.height,
    };
    if (menu) {
      const fit = { anchor: { top: anchor.top, bottom: anchor.top + anchor.height }, view: visibleRows(c) };
      return { target, ...placeTooltip(anchor, c.clientWidth), fit };
    }
    if (!pair) return { target, ...placeTooltip(anchor, c.clientWidth) };
    // the pair may reach left of the container, but stays 8 px inside the viewport
    const minLeft = 8 - (cr.left + c.clientLeft - c.scrollLeft);
    return { target, pair: true, ...placeTooltip(anchor, c.clientWidth, 2 * TOOLTIP_WIDTH + CARD_PAIR_GAP, minLeft) };
  }, [containerRef]);

  const inspect = useCallback((target: ItemTarget, el: HTMLElement) => {
    if (menuNow.current !== null) return;
    const pair = cardPairLayout(window.innerWidth, false) === 'row' && hasWornCardNow.current(target);
    setHover(place(target, el, pair));
  }, [place]);

  const clear = useCallback(() => setHover(null), []);

  const openMenu = useCallback((target: ItemTarget, el: HTMLElement, inline = false) => {
    opener.current = el;
    setHover(null);
    setMenu(inline ? { target, left: 0, top: 0, inline: true } : place(target, el, false, true));
  }, [place]);

  /** With `restoreFocus`, focus goes back to the opener, or to `fallback` when the opener is gone. */
  const closeMenu = useCallback((restoreFocus = false, fallback?: HTMLElement | null) => {
    setMenu(null);
    if (!restoreFocus) return;
    const el = opener.current;
    // after the re-render, so an opener that the action removed is seen as gone
    setTimeout(() => { if (el?.isConnected) el.focus(); else fallback?.focus(); }, 0);
  }, []);

  /**
   * Focus left the card. It closes once the current click is over: closing it can scroll the page, and the click
   * that moved focus would then land on whatever moved under the pointer. A card opened meanwhile stays.
   */
  const leaveMenu = useCallback(() => {
    const leaving = menuNow.current;
    setTimeout(() => setMenu((m) => (m === leaving ? null : m)), 0);
  }, []);

  const isOpen = menu !== null;
  useEffect(() => {
    if (!isOpen) return undefined;
    // on click (or right-click), not pointerdown, for the same reason as leaveMenu
    const onOutside = (e: MouseEvent): void => {
      if (e.target instanceof Element && e.target.closest('[data-item-card]') !== null) return;
      setMenu(null);
    };
    document.addEventListener('click', onOutside, true);
    document.addEventListener('contextmenu', onOutside, true);
    return () => {
      document.removeEventListener('click', onOutside, true);
      document.removeEventListener('contextmenu', onOutside, true);
    };
  }, [isOpen]);

  return { hover, menu, inspect, clear, openMenu, closeMenu, leaveMenu };
}
