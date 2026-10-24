import { useEffect, useRef } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { itemAt } from '../../core/cells';
import { isGear, setOfSlot } from '../../core/items';
import type { GearSet } from '../../core/items';
import { itemName } from '../../core/itemData';
import type { GameState } from '../../core/types';
import { hoverNote, itemActions } from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import { compareLines, itemKindLine, itemLines, rarityOf } from './itemView';
import type { ViewLine } from './itemView';

export interface CardMenu {
  onAction: (action: ActionSpec) => void;
  onClose: () => void;
  /** Keyboard focus moved out of the card, so it closes without taking focus back. */
  onLeave: () => void;
}

function Lines({ lines }: { lines: ViewLine[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className="gm-card__line" data-tone={l.tone}>{l.text}</div>
      ))}
    </>
  );
}

/** The hover tooltip, or with `menu` the action card: same content, plus one button per action. */
export function ItemCard({ state, target, shownSet, left, top, menu }: {
  state: GameState; target: ItemTarget; shownSet: GearSet; left: number; top: number; menu?: CardMenu;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isMenu = menu !== undefined;
  useEffect(() => {
    if (isMenu) ref.current?.querySelector('button')?.focus();
  }, [isMenu]);

  const item = itemAt(state, target);
  if (item === undefined) return null;
  const name = itemName(item);
  const compare = isGear(item) && target.where !== 'worn'
    ? compareLines(item, state.equipped[setOfSlot(item.slot)][item.slot])
    : null;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && menu) {
      e.stopPropagation();
      menu.onClose();
    }
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>): void => {
    // a null relatedTarget is a click on the card's own padding or leaving the page; outside clicks have their own listener
    if (menu && e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) menu.onLeave();
  };
  return (
    <div
      ref={ref}
      className="gm-card"
      data-rarity={rarityOf(item)}
      data-item-card=""
      role={isMenu ? 'dialog' : 'tooltip'}
      aria-label={isMenu ? name : undefined}
      style={{ left, top }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <div className="gm-card__name">{name}</div>
      <div className="gm-card__kind">{itemKindLine(item)}</div>
      <div className="gm-card__lines"><Lines lines={itemLines(item)} /></div>
      {compare !== null && compare.lines.length > 0 && (
        <div className="gm-card__compare">
          <div className="gm-card__kind">{compare.title}</div>
          <Lines lines={compare.lines} />
        </div>
      )}
      {menu ? (
        <div className="gm-card__actions">
          {itemActions(state, target, shownSet).map((a, i) => (
            <button
              key={`${a.id}${i}`}
              type="button"
              className="gm-card__btn"
              aria-disabled={a.disabled || undefined}
              onClick={() => menu.onAction(a)}
            >
              {a.label}
            </button>
          ))}
          <button type="button" className="gm-card__btn gm-card__btn--quiet" onClick={menu.onClose}>Close</button>
        </div>
      ) : (
        <div className="gm-card__note">{hoverNote(target, item)}</div>
      )}
    </div>
  );
}
