import { useRef } from 'react';
import { isGear } from '../../core/items';
import type { Item } from '../../core/items';
import { itemName } from '../../core/itemData';
import { Sprite } from '../../sprites/Sprite';
import type { ItemTarget } from './itemActions';
import { clickIntent, itemSprite, rarityOf } from './itemView';
import type { ClickIntent } from './itemView';

export interface ItemHandlers {
  onPick: (target: ItemTarget, intent: ClickIntent, el: HTMLElement) => void;
  onInspect: (target: ItemTarget, el: HTMLElement) => void;
  onClear: () => void;
  onMenu: (target: ItemTarget, el: HTMLElement) => void;
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

export function ItemButton({ item, target, handlers, scale, className, label }: {
  item: Item; target: ItemTarget; handlers: ItemHandlers; scale: number; className: string; label: string;
}) {
  const pointerType = useRef('mouse');
  return (
    <button
      type="button"
      className={className}
      data-rarity={rarityOf(item)}
      aria-label={label}
      onPointerDown={(e) => { pointerType.current = e.pointerType; }}
      onClick={(e) => {
        const intent = clickIntent({
          altKey: e.altKey, shiftKey: e.shiftKey, detail: e.detail, pointerType: pointerType.current,
        });
        handlers.onPick(target, intent, e.currentTarget);
      }}
      onContextMenu={(e) => { e.preventDefault(); handlers.onMenu(target, e.currentTarget); }}
      onMouseEnter={(e) => handlers.onInspect(target, e.currentTarget)}
      onMouseLeave={handlers.onClear}
      onFocus={(e) => handlers.onInspect(target, e.currentTarget)}
      onBlur={handlers.onClear}
    >
      <Sprite name={itemSprite(item)} scale={scale} />
      <SocketDots item={item} />
    </button>
  );
}

/** A fixed-size grid of item cells; `targetOf` says where cell `i` lives so any container can use it. */
export function ItemGrid({ items, capacity, targetOf, handlers }: {
  items: readonly Item[]; capacity: number; targetOf: (index: number) => ItemTarget; handlers: ItemHandlers;
}) {
  const cells = [];
  for (let i = 0; i < capacity; i++) {
    const item = items[i];
    cells.push(item === undefined ? (
      <div key={i} className="gm-cell gm-cell--empty" />
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
  return <div className="gm-grid">{cells}</div>;
}
