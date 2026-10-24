import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ItemTarget } from './itemActions';
import { placeTooltip } from './itemView';

export interface Placed { target: ItemTarget; left: number; top: number }

/** Hover tooltip and action-card state; positions are relative to the container, which must be `position: relative`. */
export function useItemPopover(containerRef: RefObject<HTMLElement | null>) {
  const [hover, setHover] = useState<Placed | null>(null);
  const [menu, setMenu] = useState<Placed | null>(null);
  const menuNow = useRef<Placed | null>(null);
  menuNow.current = menu;
  const opener = useRef<HTMLElement | null>(null);

  const place = useCallback((target: ItemTarget, el: HTMLElement): Placed | null => {
    const c = containerRef.current;
    if (c === null) return null;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const at = placeTooltip(
      { left: er.left - cr.left - c.clientLeft + c.scrollLeft, top: er.top - cr.top - c.clientTop + c.scrollTop, width: er.width, height: er.height },
      c.clientWidth,
    );
    return { target, ...at };
  }, [containerRef]);

  const inspect = useCallback((target: ItemTarget, el: HTMLElement) => {
    if (menuNow.current !== null) return;
    setHover(place(target, el));
  }, [place]);

  const clear = useCallback(() => setHover(null), []);

  const openMenu = useCallback((target: ItemTarget, el: HTMLElement) => {
    opener.current = el;
    setHover(null);
    setMenu(place(target, el));
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
