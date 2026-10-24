import { useEffect, useLayoutEffect, useRef } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { itemAt } from '../../core/cells';
import { isGear } from '../../core/items';
import type { GearItem } from '../../core/items';
import { itemName } from '../../core/itemData';
import type { GameState } from '../../core/types';
import { hoverNote, itemActions } from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import { cardHead, compareLines, itemKindLine, itemLines, placeCardTop, rarityOf, wornToCompare } from './itemView';
import type { ViewLine } from './itemView';
import type { CardFit } from './useItemPopover';

export interface CardMenu {
  onAction: (action: ActionSpec) => void;
  onClose: () => void;
  /** Keyboard focus moved out of the card, so it closes without taking focus back. */
  onLeave: () => void;
  /** Set while this card's item is lifted by a touch tap. */
  onPutBack?: () => void;
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

/** The worn item's name, kind line and lines under an "Equipped" label. */
function EquippedContent({ worn }: { worn: GearItem }) {
  return (
    <>
      <div className="gm-card__label">Equipped</div>
      <div className="gm-card__name">{itemName(worn)}</div>
      <div className="gm-card__kind">{itemKindLine(worn)}</div>
      <div className="gm-card__lines"><Lines lines={itemLines(worn)} /></div>
    </>
  );
}

/**
 * The hover tooltip, or with `menu` the action card: same content, plus one button per action. An `inline` card
 * (opened by a touch tap) sits in the page flow and scrolls just into view, `smooth` only when motion is allowed.
 * Gear that is not worn also shows the worn item's card: beside this one when `pair` (a hover card on a wide
 * screen, placed by the caller as one pair), otherwise as a block inside it.
 */
export function ItemCard({ state, target, left, top, fit, menu, inline = false, smooth = false, pair = false }: {
  state: GameState; target: ItemTarget; left: number; top: number; fit?: CardFit; menu?: CardMenu;
  inline?: boolean; smooth?: boolean; pair?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isMenu = menu !== undefined;
  // With `fit`, the card moves to where it fits once its height is known: before it paints, and before focus goes
  // into it, so that focus never scrolls the page. After every render, as a craft can change its height.
  useLayoutEffect(() => {
    const card = ref.current;
    if (fit !== undefined && card !== null) card.style.top = `${placeCardTop(fit.anchor, card.offsetHeight, fit.view)}px`;
  });
  useEffect(() => {
    if (!isMenu) return;
    // 'nearest' scrolls only as far as needed; the card sits below the grid, so nothing above it moves in the page
    if (inline) ref.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    ref.current?.querySelector('button')?.focus({ preventScroll: inline });
  }, [isMenu, inline]);   // when the card opens, not when `smooth` changes
  // a craft can take its own button away (Copper makes the item magic): focus stays in the card, on the next craft
  const crafted = useRef(false);
  useEffect(() => {
    if (!crafted.current) return;
    crafted.current = false;
    const card = ref.current;
    if (card === null || card.contains(document.activeElement)) return;
    (card.querySelector<HTMLElement>('[data-craft]') ?? card.querySelector('button'))?.focus({ preventScroll: true });
  });

  const item = itemAt(state, target);
  if (item === undefined) return null;
  const { name, kind } = cardHead(state.seed, item);
  const worn = wornToCompare(state, item, target.where === 'worn');
  const compare = isGear(item) && target.where !== 'worn' ? compareLines(item, worn) : null;
  const beside = pair && !isMenu && worn !== undefined;
  const actions = isMenu ? itemActions(state, target) : [];
  const others = actions.filter((a) => a.id !== 'craft');
  const crafts = actions.filter((a) => a.id === 'craft');
  const wornBlock = worn !== undefined && !beside && (
    <div className="gm-card__equipped" data-rarity={rarityOf(worn)}><EquippedContent worn={worn} /></div>
  );
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
  const card = (
    <div
      ref={ref}
      className={inline ? 'gm-card gm-card--inline' : 'gm-card'}
      data-rarity={rarityOf(item)}
      data-item-card=""
      role={isMenu ? 'dialog' : 'tooltip'}
      aria-label={isMenu ? name : undefined}
      style={inline || beside ? undefined : { left, top }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <div className="gm-card__name">{name}</div>
      <div className="gm-card__kind">{kind}</div>
      <div className="gm-card__lines"><Lines lines={itemLines(item)} /></div>
      {compare !== null && compare.lines.length > 0 && (
        <div className="gm-card__compare">
          <div className="gm-card__kind">{compare.title}</div>
          <Lines lines={compare.lines} />
        </div>
      )}
      {!inline && wornBlock}
      {menu?.onPutBack !== undefined && (
        <div className="gm-card__note">Picked up: tap a cell, a slot or a tab to put it there.</div>
      )}
      {menu ? (
        <div className="gm-card__actions">
          {others.map((a, i) => (
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
          {crafts.length > 0 && (
            <>
              <div className="gm-card__label gm-card__craft">Craft</div>
              <div className="gm-card__crafts">
                {crafts.map((a) => (
                  <button
                    key={`craft-${a.kind}`}
                    type="button"
                    className="gm-card__btn"
                    data-craft={a.kind}
                    aria-disabled={a.disabled || undefined}
                    onClick={() => { crafted.current = true; menu.onAction(a); }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {menu.onPutBack !== undefined && (
            <button type="button" className="gm-card__btn" onClick={menu.onPutBack}>Put back</button>
          )}
          <button type="button" className="gm-card__btn gm-card__btn--quiet" onClick={menu.onClose}>Close</button>
        </div>
      ) : (
        <div className="gm-card__note">{hoverNote(target, item)}</div>
      )}
      {inline && wornBlock}
    </div>
  );
  if (!beside) return card;
  return (
    <div className="gm-cardpair" style={{ left, top }}>
      <div className="gm-card gm-card--equipped" data-rarity={rarityOf(worn)}><EquippedContent worn={worn} /></div>
      {card}
    </div>
  );
}
