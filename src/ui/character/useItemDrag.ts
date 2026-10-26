import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { itemAt } from '../../core/cells';
import type { DropTarget, InvResult, ItemLoc } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { craftResultText, craftTargetAt } from './craftView';
import { DRAG_THRESHOLD_PX, heldLoc, parseDrop, tapAction } from './dragDrop';
import type { Hold } from './dragDrop';
import { refusedMap, resultText } from './itemActions';

export interface ItemDrag {
  /** A mouse or pen press on an item; past the threshold it becomes a drag. */
  onPointerDown: (loc: ItemLoc, e: ReactPointerEvent<HTMLElement>) => void;
  /** True once for the click that ends a drag, so that click does nothing. */
  consumeClick: () => boolean;
  /** A drag is in flight: tooltips and cards stay closed. */
  dragging: boolean;
  /** Where the item lifted by a touch tap is; null once that item has gone from there. */
  held: ItemLoc | null;
  /** A touch tap on a target; true when the tap lifted, put back or placed an item. */
  onTap: (tapped: DropTarget, tappedIsItem: boolean) => boolean;
  /** Picks an item up for click-to-place, with a ghost following the pointer from (`x`, `y`). */
  pickUp: (loc: ItemLoc, source: HTMLElement, x: number, y: number) => void;
  release: () => void;
}

/** The drop target under a point, or null when there is none there. */
function targetAt(x: number, y: number): { el: Element; to: DropTarget } | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-drop]') ?? null;
  const to = el === null ? null : parseDrop(el.getAttribute('data-drop'));
  return el !== null && to !== null ? { el, to } : null;
}

/** A copy of the item's look that follows the pointer; it never takes pointer events, so the target below is found. */
function makeGhost(source: HTMLElement): HTMLElement {
  const r = source.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'gm-item gm-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('data-rarity', source.getAttribute('data-rarity') ?? 'normal');
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  for (const child of Array.from(source.childNodes)) ghost.appendChild(child.cloneNode(true));
  document.body.appendChild(ghost);
  return ghost;
}

/**
 * Moving items by hand: mouse and pen drags, and on touch screens tap to lift then tap to place. Every drop runs
 * through `store.drop`, and `onResult` gets the refusal text (null when the drop worked).
 */
export function useItemDrag({ store, onResult }: {
  store: GameStore;
  onResult: (text: string | null) => void;
}): ItemDrag {
  const [dragging, setDragging] = useState(false);
  const [hold, setHoldState] = useState<Hold | null>(null);
  const holdRef = useRef<Hold | null>(null);
  // checked on every render (the panel re-renders on each game change), so a sold or replaced item is not shown held
  const held = heldLoc(store.state, hold);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const swallowClick = useRef(false);
  const stopPress = useRef<(() => void) | null>(null);

  const setHold = useCallback((next: Hold | null) => {
    holdRef.current = next;
    setHoldState(next);
  }, []);
  const release = useCallback(() => setHold(null), [setHold]);

  // A click-held item's ghost follows the pointer, exactly as a dragged item's does.
  const ghostRef = useRef<HTMLElement | null>(null);
  const ghostMove = useRef<((e: PointerEvent) => void) | null>(null);
  const ghostOver = useRef<Element | null>(null);
  const clearGhost = useCallback((): void => {
    ghostRef.current?.remove();
    ghostRef.current = null;
    if (ghostMove.current !== null) {
      window.removeEventListener('pointermove', ghostMove.current);
      ghostMove.current = null;
    }
    ghostOver.current?.removeAttribute('data-drop-over');
    ghostOver.current = null;
  }, []);

  const pickUp = useCallback((loc: ItemLoc, source: HTMLElement, x: number, y: number): void => {
    const item = itemAt(store.state, loc);
    if (item === undefined) return;
    clearGhost();
    setHold({ loc, id: item.id });
    const rect = source.getBoundingClientRect();
    const grab = { x: x - rect.left, y: y - rect.top };
    const ghost = makeGhost(source);
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghostRef.current = ghost;
    const move = (ev: PointerEvent): void => {
      ghost.style.left = `${ev.clientX - grab.x}px`;
      ghost.style.top = `${ev.clientY - grab.y}px`;
      const over = targetAt(ev.clientX, ev.clientY)?.el ?? null;
      if (over !== ghostOver.current) {
        ghostOver.current?.removeAttribute('data-drop-over');
        over?.setAttribute('data-drop-over', '');
        ghostOver.current = over;
      }
    };
    ghostMove.current = move;
    window.addEventListener('pointermove', move);
  }, [store, setHold, clearGhost]);

  // The ghost lives only while the clicked item is still held (placed, put back, sold or gone).
  useEffect(() => {
    if (held === null) clearGhost();
  }, [held, clearGhost]);

  const drop = useCallback((from: ItemLoc, to: DropTarget): void => {
    const before = store.lastCraft?.id;
    const refused = refusedMap(store.state, from, to);
    const r: InvResult = store.drop(from, to);
    // a material dropped on gear or a map crafts: its message is the craft's, refused or tempered
    const crafted = store.lastCraft;
    resultRef.current(crafted !== null && crafted.id !== before
      ? craftResultText(crafted, craftTargetAt(store.state, crafted.target)) ?? resultText(r)
      : resultText(r, refused));
    if (r === 'ok') setHold(null);
  }, [store, setHold]);

  const onPointerDown = useCallback((loc: ItemLoc, e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    // An item held by a click places on the next press; the press must not start a drag on the destination.
    if (holdRef.current !== null) return;
    stopPress.current?.();
    swallowClick.current = false;
    const source = e.currentTarget;
    const { pointerId } = e;
    const rect = source.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let ghost: HTMLElement | null = null;
    let cancelled = false;
    let over: Element | null = null;

    const mark = (next: Element | null): void => {
      if (next === over) return;
      over?.removeAttribute('data-drop-over');
      next?.setAttribute('data-drop-over', '');
      over = next;
    };
    const endDrag = (): void => {
      ghost?.remove();
      ghost = null;
      source.removeAttribute('data-drag-source');
      mark(null);
      setDragging(false);
    };
    const onMove = (ev: PointerEvent): void => {
      if (ev.pointerId !== pointerId) return;
      // no button down means the pointerup was lost (say, to an alt-tab); a source that left the page cannot be dragged
      if (ev.buttons === 0 || !source.isConnected) {
        stop();
        return;
      }
      if (cancelled) return;
      if (ghost === null) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        // a real drag takes over from a click-held item
        clearGhost();
        if (holdRef.current !== null) setHold(null);
        ghost = makeGhost(source);
        source.setAttribute('data-drag-source', '');
        setDragging(true);
      }
      ghost.style.left = `${ev.clientX - grab.x}px`;
      ghost.style.top = `${ev.clientY - grab.y}px`;
      mark(targetAt(ev.clientX, ev.clientY)?.el ?? null);
    };
    const onUp = (ev: PointerEvent): void => {
      if (ev.pointerId !== pointerId) return;
      const dragged = ghost !== null || cancelled;
      const target = ghost !== null ? targetAt(ev.clientX, ev.clientY) : null;
      stop();
      if (!dragged) return;
      // the click that follows this pointerup, if it lands on an item, must not run that item's shortcut
      swallowClick.current = true;
      setTimeout(() => { swallowClick.current = false; }, 0);
      if (target !== null) drop(loc, target.to);
    };
    const onCancel = (ev: PointerEvent): void => {
      if (ev.pointerId === pointerId) stop();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape' || ghost === null) return;
      // Escape only cancels the drag: it must not also close the dialog under it
      ev.preventDefault();
      ev.stopPropagation();
      cancelled = true;
      endDrag();
    };
    function stop(): void {
      endDrag();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      stopPress.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    stopPress.current = stop;
  }, [drop, clearGhost, setHold]);

  useEffect(() => () => stopPress.current?.(), []);
  useEffect(() => () => clearGhost(), [clearGhost]);

  const isHeld = held !== null;
  useEffect(() => {
    if (!isHeld) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setHold(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isHeld, setHold]);

  const onTap = useCallback((tapped: DropTarget, tappedIsItem: boolean): boolean => {
    // a hold whose item has gone is dropped, and the tap counts as one with nothing held
    const from = heldLoc(store.state, holdRef.current);
    if (from === null && holdRef.current !== null) setHold(null);
    const action = tapAction(from, tapped, tappedIsItem);
    switch (action.kind) {
      case 'hold': {
        // only a place with an item in it can be lifted
        const loc = tapped.where === 'stashTab' ? null : tapped;
        const item = loc === null ? undefined : itemAt(store.state, loc);
        if (loc === null || item === undefined) return false;
        setHold({ loc, id: item.id });
        return true;
      }
      case 'release':
        setHold(null);
        return true;
      case 'drop':
        if (from !== null) drop(from, action.to);
        return true;
      case 'none':
        return false;
    }
  }, [store, drop, setHold]);

  const consumeClick = useCallback((): boolean => {
    const swallow = swallowClick.current;
    swallowClick.current = false;
    return swallow;
  }, []);

  return { onPointerDown, consumeClick, dragging, held, onTap, pickUp, release };
}
