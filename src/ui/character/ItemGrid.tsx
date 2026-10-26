import { useEffect, useRef } from 'react';
import { sameLoc } from '../../core/cells';
import { isGear, isStack } from '../../core/items';
import type { Cell, Item } from '../../core/items';
import type { DropTarget } from '../../core/types';
import { itemName } from '../../core/itemData';
import { Sprite } from '../../sprites/Sprite';
import { formatCompact, formatNumber } from '../format';
import { IS_MAC, lastPointerType, recheckHover } from '../platform';
import { clickRoute, dropAttr } from './dragDrop';
import type { ItemTarget } from './itemActions';
import { itemSprite, rarityOf } from './itemView';
import type { ClickIntent } from './itemView';
import type { ItemDrag } from './useItemDrag';

export interface ItemHandlers {
  drag: ItemDrag;
  onPick: (target: ItemTarget, intent: ClickIntent, el: HTMLElement) => void;
  onInspect: (target: ItemTarget, el: HTMLElement) => void;
  onClear: () => void;
  onMenu: (target: ItemTarget, el: HTMLElement) => void;
  /** A touch tap lifted the item: its card opens below the grid. */
  onLift: (target: ItemTarget, el: HTMLElement) => void;
}

const MAX_DOTS = 3;

function SocketDots({ item }: { item: Item }) {
  if (!isGear(item) || item.sockets === 0) return null;
  const dots = [];
  for (let i = 0; i < Math.min(MAX_DOTS, item.sockets); i++) {
    dots.push(<span key={i} className="gm-item__dot" data-gem={item.gems[i]?.gem} />);
  }
  return <span className="gm-item__dots" aria-hidden="true">{dots}</span>;
}

/** The count on a stack; hidden from assistive tech because the button's label carries the exact number. */
function StackCount({ item }: { item: Item }) {
  if (!isStack(item) || item.count <= 1) return null;
  return <span className="gm-item__count" aria-hidden="true">{formatCompact(item.count)}</span>;
}

/** A map's tier; hidden from assistive tech because the button's label names it. */
function MapTier({ item }: { item: Item }) {
  if (item.type !== 'map') return null;
  return <span className="gm-item__tier" aria-hidden="true">T{formatNumber(item.tier)}</span>;
}

export function ItemButton({ item, target, handlers, scale, className, label }: {
  item: Item; target: ItemTarget; handlers: ItemHandlers; scale: number; className: string; label: string;
}) {
  const pointerType = useRef('mouse');
  const ref = useRef<HTMLButtonElement>(null);
  const shown = useRef<number | null>(null);
  const recheck = useRef<(() => void) | null>(null);
  const { drag } = handlers;
  // An item came into this cell under a still pointer: a shortcut's sale let a held find in, a map tier moved up, or a
  // find landed in an empty cell (a new button, so this runs on its mount). A browser need send no mouseenter for it,
  // so its card is shown here, or the next shortcut would act on an item unseen. By id, since a stash tab's stack is a
  // new object each render (id 0, as its cell never changes item). The page's last pointer, as a new button has seen
  // none of its own. A browser sets :hover on a node inserted under a still pointer at the next frame at the soonest,
  // so a miss looks again then and a moment later; a new item or the unmount cancels those looks.
  useEffect(() => () => recheck.current?.(), []);
  useEffect(() => {
    if (shown.current === item.id) return;
    const id = item.id;
    shown.current = id;
    recheck.current?.();
    recheck.current = null;
    const el = ref.current;
    if (el === null || lastPointerType() === 'touch') return;
    if (el.matches(':hover')) { handlers.onInspect(target, el); return; }
    recheck.current = recheckHover(() => {
      const hovered = ref.current === el && shown.current === id && lastPointerType() !== 'touch' && el.matches(':hover');
      if (hovered) handlers.onInspect(target, el);
      return hovered;
    });
  });
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      data-rarity={rarityOf(item)}
      data-drop={dropAttr(target)}
      data-held={drag.held !== null && sameLoc(drag.held, target) ? '' : undefined}
      aria-label={!isStack(item) || item.count <= 1 ? label : `${label}, ${formatNumber(item.count)}`}
      onPointerDown={(e) => { pointerType.current = e.pointerType; drag.onPointerDown(target, e); }}
      onClick={(e) => {
        if (drag.consumeClick()) return;
        const route = clickRoute({
          altKey: e.altKey, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, detail: e.detail,
          pointerType: pointerType.current,
        }, drag.held !== null, IS_MAC);
        if (route.kind === 'pick') {
          handlers.onPick(target, route.intent, e.currentTarget);
          return;
        }
        // a stock slot is bought from its card, never picked up
        if (route.kind === 'hold' && target.where === 'stock') {
          handlers.onPick(target, 'card', e.currentTarget);
          return;
        }
        if (drag.onTap(target, true) && route.kind === 'lift') handlers.onLift(target, e.currentTarget);
      }}
      onContextMenu={(e) => { e.preventDefault(); handlers.onMenu(target, e.currentTarget); }}
      onMouseEnter={(e) => { if (pointerType.current !== 'touch') handlers.onInspect(target, e.currentTarget); }}
      onMouseLeave={handlers.onClear}
      // after a touch, focus coming back from the card shows no tooltip: it would cover cells and shift the page
      onFocus={(e) => { if (pointerType.current !== 'touch') handlers.onInspect(target, e.currentTarget); }}
      onBlur={handlers.onClear}
    >
      <Sprite name={itemSprite(item)} scale={scale} />
      <SocketDots item={item} />
      <StackCount item={item} />
      <MapTier item={item} />
    </button>
  );
}

/** An empty cell or slot: a drop target that a touch tap can place the lifted item on. Not in the tab order. */
export function EmptyTarget({ target, drag, className, label }: {
  target: DropTarget; drag: ItemDrag; className: string; label?: string;
}) {
  return (
    <div
      className={className}
      data-drop={dropAttr(target)}
      role={label !== undefined ? 'img' : undefined}
      aria-label={label}
      onClick={() => drag.onTap(target, false)}
    />
  );
}

/**
 * A fixed-size grid of item cells, ten to a row; `targetOf` says where cell `i` lives so any container can use it, and
 * `emptyTarget`, when given, is where a drop on any empty cell goes instead. Its box shrinks the cells to fit a narrow
 * screen, then scrolls sideways on its own.
 */
export function ItemGrid({ items, capacity, targetOf, handlers, emptyTarget }: {
  items: readonly Cell[]; capacity: number; targetOf: (index: number) => ItemTarget; handlers: ItemHandlers;
  emptyTarget?: DropTarget;
}) {
  const cells = [];
  for (let i = 0; i < capacity; i++) {
    const item = items[i];
    cells.push(item === undefined || item === null ? (
      <EmptyTarget key={i} target={emptyTarget ?? targetOf(i)} drag={handlers.drag} className="gm-cell gm-cell--empty" />
    ) : (
      <ItemButton
        key={i}
        item={item}
        target={targetOf(i)}
        handlers={handlers}
        scale={3}
        className="gm-cell gm-item"
        label={itemName(item)}
      />
    ));
  }
  return <div className="gm-gridbox"><div className="gm-grid">{cells}</div></div>;
}
