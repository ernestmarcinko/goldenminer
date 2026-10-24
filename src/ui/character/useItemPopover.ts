import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ItemTarget } from './itemActions';
import { placeTooltip } from './itemView';

export interface Placed { target: ItemTarget; left: number; top: number }

/** Hover tooltip and action-card state; positions are relative to the container, which must be `position: relative`. */
export function useItemPopover(containerRef: RefObject<HTMLElement | null>) {
  const [hover, setHover] = useState<Placed | null>(null);
  const [menu, setMenu] = useState<Placed | null>(null);
  const menuOpen = useRef(false);
  menuOpen.current = menu !== null;
  const opener = useRef<HTMLElement | null>(null);

  const place = useCallback((target: ItemTarget, el: HTMLElement): Placed | null => {
    const c = containerRef.current;
    if (c === null) return null;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const at = placeTooltip(
      { left: er.left - cr.left - c.clientLeft, top: er.top - cr.top - c.clientTop, width: er.width, height: er.height },
      cr.width,
    );
    return { target, ...at };
  }, [containerRef]);

  const inspect = useCallback((target: ItemTarget, el: HTMLElement) => {
    if (menuOpen.current) return;
    setHover(place(target, el));
  }, [place]);

  const clear = useCallback(() => setHover(null), []);

  const openMenu = useCallback((target: ItemTarget, el: HTMLElement) => {
    opener.current = el;
    setHover(null);
    setMenu(place(target, el));
  }, [place]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenu(null);
    if (restoreFocus && opener.current?.isConnected) opener.current.focus();
  }, []);

  const isOpen = menu !== null;
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e: PointerEvent): void => {
      if (e.target instanceof Element && e.target.closest('[data-item-card]') !== null) return;
      setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [isOpen]);

  return { hover, menu, inspect, clear, openMenu, closeMenu };
}
