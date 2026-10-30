import { useEffect, useLayoutEffect, useRef } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { itemAt } from '../../core/cells';
import { isGear } from '../../core/items';
import type { GearItem } from '../../core/items';
import { itemName } from '../../core/itemData';
import { stockPrice } from '../../core/trader';
import type { GameState } from '../../core/types';
import { formatNumber } from '../format';
import { IS_MAC } from '../platform';
import { hoverLines, hoverNotes, itemActions, menuNote } from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import {
  anchorCraft, cardHead, cardMaxHeight, cardScroll, cardWindow, compareLines, craftAnchor, craftSlots, fittedCardTop,
  itemKindLine, itemLines, keptHeight, rarityOf, userScrolled, wornToCompare,
} from './itemView';
import type { CardFit, CraftAnchor, CraftGrid, ViewLine } from './itemView';
import { targetedKey } from './craftView';
import { screenView } from './useItemPopover';

export interface CardMenu {
  onAction: (action: ActionSpec) => void;
  onClose: () => void;
  /** Keyboard focus moved out of the card, so it closes without taking focus back. */
  onLeave: () => void;
  /** The card has no part left on the screen: it closes, as Enter must not craft on a card no one can see. */
  onLost: () => void;
  /** Set while this card's item is lifted by a touch tap. */
  onPutBack?: () => void;
}

/** Each line's text, and a modifier's tier at the right edge. */
function Lines({ lines }: { lines: ViewLine[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className="gm-card__line" data-tone={l.tone}>
          <span className="gm-card__text">{l.text}</span>
          {l.tier !== undefined && <span className="gm-card__tier">T{formatNumber(l.tier)}</span>}
        </div>
      ))}
    </>
  );
}

/** The worn item's name, kind line and lines under an "Equipped" label. */
function EquippedContent({ worn, level }: { worn: GearItem; level: number }) {
  return (
    <>
      <div className="gm-card__label">Equipped</div>
      <div className="gm-card__name">{itemName(worn)}</div>
      <div className="gm-card__kind">{itemKindLine(worn)}</div>
      <div className="gm-card__lines"><Lines lines={itemLines(worn, level)} /></div>
    </>
  );
}

/** The Soul upgrade's slot, kept and anchored with the craft slots below it, by its action id. */
const UPGRADE: ActionSpec['id'] = 'soulUpgrade';

/** `card`'s craft slots, measured down the card, or null when it has none. The Soul upgrade is the grid's first slot. */
function craftGrid(card: HTMLElement): CraftGrid | null {
  const grid = card.querySelector('.gm-card__crafts');
  if (grid === null) return null;
  const top = card.getBoundingClientRect().top;
  const slots = [...grid.children] as HTMLElement[];
  return {
    top: grid.getBoundingClientRect().top - top,
    kinds: slots.map((b) => b.dataset.craft ?? b.dataset.upgrade ?? ''),
    tops: slots.map((b) => b.getBoundingClientRect().top - top),
  };
}

/**
 * The hover card, the `pinned` card (a plain click; the hover card that stays), or with `menu` the action card: same
 * content, plus one button per action. A placed card is fixed on the screen at `left`, its top set here from `fit`;
 * `follow` is how far an action card's item has moved on the screen since it opened, as the page scrolled.
 * An `inline` card (opened by a touch tap) sits in the page flow and scrolls just into view, `smooth` only when motion
 * is allowed. Gear that is not worn also shows the worn item's card: beside this one when `pair` (a hover or pinned
 * card on a wide screen, placed by the caller as one pair), otherwise as a block inside it.
 */
export function ItemCard({
  state, target, left, fit, menu, inline = false, smooth = false, pair = false, pinned = false, follow = 0,
}: {
  state: GameState; target: ItemTarget; left: number; fit?: CardFit; menu?: CardMenu;
  inline?: boolean; smooth?: boolean; pair?: boolean; pinned?: boolean; follow?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** The pair's box, when the worn item's card shows beside this one: the pair is placed as one. */
  const pairRef = useRef<HTMLDivElement>(null);
  const isMenu = menu !== undefined;
  // With `fit`, the card moves to where it fits once its height is known: before it paints, and before focus goes
  // into it. Only when it opens: after a craft it moves just enough to keep the clicked button under the pointer
  // (`anchor`), its crafts keep their slots (`slotOrder`), and neither it nor its craft grid gets shorter, so the
  // pointer stays on it. That place (`at`, with its content scrolled `inner` inside) may be past the screen's edge; the
  // card is fixed on the screen, so an action card shows only its part on the screen and scrolls inside to the rest,
  // its content left where it is (`cardWindow`). A scroll inside by the player is where they aim now: it is kept, and
  // the last craft's anchor is dropped, so no later render pulls it back. When its item scrolls with the page, the
  // card moves with it (`follow`). Its place is kept here, not read back from the page, and set after every render.
  const fitted = useRef<CardFit | undefined>(undefined);
  const at = useRef(0);
  const inner = useRef(0);
  /** Where the card shows and its scroll there, as last set here. */
  const shown = useRef({ top: 0, scroll: 0 });
  /** An action card taller than the screen opens at most this tall (`cardMaxHeight`). */
  const cap = useRef<number | undefined>(undefined);
  const followed = useRef(0);
  const lost = useRef(false);
  const anchor = useRef<CraftAnchor | null>(null);
  const tallest = useRef({ card: 0, crafts: 0 });
  const slotOrder = useRef<string[]>([]);
  useLayoutEffect(() => {
    const card = ref.current;
    const box = pairRef.current ?? card;
    if (card === null || box === null || fit === undefined) return;
    // exact heights throughout, as offsetHeight rounds: a rounded-up least height would beat a card's max-height
    if (isMenu && fit !== fitted.current) {
      card.style.maxHeight = '';
      card.style.minHeight = '';
      cap.current = cardMaxHeight(fit.anchor, fit.view, card.getBoundingClientRect().height);
      card.style.maxHeight = cap.current === undefined ? '' : `${cap.current}px`;
    }
    const placed = fittedCardTop(fitted.current, fit, box.getBoundingClientRect().height);
    fitted.current = fit;
    // the clicked button's place on the screen, when a craft moved things around it
    let aim: number | null = null;
    if (placed !== undefined) {
      at.current = placed;
      inner.current = 0;
      anchor.current = null;
      followed.current = follow;
    } else if (isMenu) {
      const scroll = card.scrollTop;
      if (userScrolled(shown.current.scroll, scroll, card.scrollHeight - card.clientHeight)) {
        inner.current += scroll - shown.current.scroll;
        anchor.current = null;
      }
      // its item scrolled with the page: the card moves with it, and that is a new aim, as a scroll inside is
      if (follow !== followed.current) {
        anchor.current = null;
        at.current += follow - followed.current;
        followed.current = follow;
      }
      const grid = craftGrid(card);
      if (anchor.current !== null && grid !== null) {
        const next = anchorCraft(card.getBoundingClientRect().top, anchor.current, grid);
        // where its content must be on the screen; a capped card scrolls it inside rather than move its box
        const origin = next.top - scroll;
        const extent = card.scrollHeight + card.offsetHeight - card.clientHeight;
        const room = cap.current === undefined ? 0 : Math.max(0, extent - cap.current);
        inner.current = cardScroll(at.current, origin + inner.current, inner.current, room);
        at.current = origin + inner.current;
        anchor.current = next.anchor;
        aim = next.top + next.anchor.top;
      }
    }
    if (isMenu) {
      card.style.maxHeight = cap.current === undefined ? '' : `${cap.current}px`;
      card.style.minHeight = `${tallest.current.card}px`;
      const height = card.getBoundingClientRect().height;
      tallest.current.card = keptHeight(tallest.current.card, height);
      const origin = at.current - inner.current;
      // the content runs the card's full scroll height, between its borders (which scrollHeight leaves out)
      const extent = card.scrollHeight + card.offsetHeight - card.clientHeight;
      const w = cardWindow(at.current, height, { top: origin, bottom: origin + extent }, screenView());
      if (w.bottom - w.top < 1) {
        if (!lost.current) menu.onLost();
        lost.current = true;
        return;
      }
      if (w.bottom - w.top < height - 0.5) {
        card.style.maxHeight = `${w.bottom - w.top}px`;
        card.style.minHeight = `${Math.min(tallest.current.card, w.bottom - w.top)}px`;
      }
      card.scrollTop = w.top - origin;
      // read back, as the browser may round it: the box goes where its content stays put
      shown.current = { top: origin + card.scrollTop, scroll: card.scrollTop };
    } else {
      shown.current = { top: at.current, scroll: 0 };
    }
    box.style.top = `${shown.current.top}px`;
    if (aim !== null && anchor.current !== null) anchor.current = { ...anchor.current, top: aim - shown.current.top };
    const gridEl = card.querySelector<HTMLElement>('.gm-card__crafts');
    if (gridEl !== null) {
      tallest.current.crafts = keptHeight(tallest.current.crafts, gridEl.getBoundingClientRect().height);
      gridEl.style.minHeight = `${tallest.current.crafts}px`;
    }
  });
  // the upgrade and craft slots keep their order while a placed card is open; the order is kept once the render commits
  const actions = isMenu ? itemActions(state, target) : [];
  const upgrade = actions.find((a) => a.id === UPGRADE);
  const crafts = actions.filter((a) => a.id === 'craft' || a.id === 'targetedCraft');
  const craftKeyOf = (a: ActionSpec): string =>
    a.id === 'craft' && a.kind !== undefined ? a.kind
      : a.id === 'targetedCraft' && a.targeted !== undefined ? targetedKey(a.targeted)
        : '';
  const craftKinds = crafts.map(craftKeyOf).filter((k) => k !== '');
  const kinds = upgrade === undefined ? craftKinds : [UPGRADE, ...craftKinds];
  const slots = fit === undefined ? kinds : craftSlots(slotOrder.current, kinds);
  useLayoutEffect(() => { slotOrder.current = slots; });
  const anchorOn = (kind: string): void => {
    const card = ref.current;
    const grid = card === null ? null : craftGrid(card);
    if (card === null || fit === undefined || grid === null) return;
    // a scroll inside since the last render is the player's aim: taken in now, so the craft's render keeps its anchor
    const scroll = card.scrollTop;
    if (userScrolled(shown.current.scroll, scroll, card.scrollHeight - card.clientHeight)) {
      inner.current += scroll - shown.current.scroll;
    }
    shown.current = { ...shown.current, scroll };
    anchor.current = craftAnchor(grid, kind);
  };
  useEffect(() => {
    if (!isMenu) return;
    // 'nearest' scrolls only as far as needed; the card sits below the grid, so nothing above it moves in the page. A
    // placed card is on the screen already, and focus must not scroll the page under it.
    if (inline) ref.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [isMenu, inline]);   // when the card opens, not when `smooth` changes
  // a craft can take its own button away (Copper makes the item magic): focus stays in the card, on the next craft,
  // or on Close once a temper has sealed it, never on an action like "Run this map" that a second Enter would take
  const crafted = useRef(false);
  useEffect(() => {
    if (!crafted.current) return;
    crafted.current = false;
    const card = ref.current;
    if (card === null || card.contains(document.activeElement)) return;
    const next = card.querySelector<HTMLElement>('[data-craft]') ?? card.querySelector<HTMLElement>('[data-close]');
    next?.focus({ preventScroll: true });
  });

  const item = itemAt(state, target);
  if (item === undefined) return null;
  const { name, kind } = cardHead(state.seed, item);
  // A stock slot's price leads the card, so a buy is read before the item's own lines.
  const stockPriceLine = target.where === 'stock' && (item.type === 'gear' || item.type === 'map')
    ? `${formatNumber(stockPrice(item))} Gold`
    : null;
  const worn = wornToCompare(state, item, target.where === 'worn');
  const compare = isGear(item) && target.where !== 'worn' ? compareLines(item, worn) : null;
  const beside = pair && worn !== undefined;
  const note = isMenu ? menuNote(item) : null;
  const others = actions.filter((a) => a.id !== 'craft' && a.id !== UPGRADE);
  const lines = isMenu ? itemLines(item, state.level, state.seed) : [...itemLines(item, state.level, state.seed), ...hoverLines(item)];
  const wornBlock = worn !== undefined && !beside && (
    <div className="gm-card__equipped" data-rarity={rarityOf(worn)}><EquippedContent worn={worn} level={state.level} /></div>
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
      data-pinned={pinned ? '' : undefined}
      role={isMenu ? 'dialog' : 'tooltip'}
      aria-label={isMenu ? name : undefined}
      style={inline || beside ? undefined : { left }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      {stockPriceLine !== null && <div className="gm-card__price">{stockPriceLine}</div>}
      <div className="gm-card__name">{name}</div>
      <div className="gm-card__kind">{kind}</div>
      <div className="gm-card__lines"><Lines lines={lines} /></div>
      {note !== null && <div className="gm-card__note">{note}</div>}
      {!isMenu && compare !== null && compare.lines.length > 0 && !beside && (
        <div className="gm-card__compare">
          <div className="gm-card__kind">{compare.title}</div>
          <Lines lines={compare.lines} />
        </div>
      )}
      {/* the equipped info is hover/pinned-only inside; on the action card it sits in the side pair (wide) or is dropped */}
      {!inline && !isMenu && wornBlock}
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
          {/* the Soul upgrade and every craft share the one header; a sealed item keeps its slot empty so nothing moves up */}
          {slots.length > 0 && (
            <>
              <div className="gm-card__label gm-card__craft">{item.type === 'map' ? 'Enchant' : 'Craft'}</div>
              <div className="gm-card__crafts">
                {slots.map((k) => {
                  if (k === UPGRADE) {
                    return upgrade === undefined ? (
                      <div key={UPGRADE} className="gm-card__slot" data-upgrade="" aria-hidden="true" onMouseDown={(e) => e.preventDefault()} />
                    ) : (
                      <button
                        key={UPGRADE}
                        type="button"
                        className="gm-card__btn"
                        data-upgrade={UPGRADE}
                        aria-disabled={upgrade.disabled || undefined}
                        onClick={() => { anchorOn(UPGRADE); menu.onAction(upgrade); }}
                      >
                        {upgrade.label}
                      </button>
                    );
                  }
                  const a = crafts.find((c) => craftKeyOf(c) === k);
                  // a click on an empty slot keeps focus where it is, in the card
                  if (a === undefined) {
                    return (
                      <div key={`craft-${k}`} className="gm-card__slot" aria-hidden="true" onMouseDown={(e) => e.preventDefault()} />
                    );
                  }
                  return (
                    <button
                      key={`craft-${k}`}
                      type="button"
                      className="gm-card__btn"
                      data-craft={k}
                      aria-disabled={a.disabled || undefined}
                      onClick={() => { crafted.current = true; anchorOn(k); menu.onAction(a); }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {menu.onPutBack !== undefined && (
            <button type="button" className="gm-card__btn" onClick={menu.onPutBack}>Put back</button>
          )}
          <button type="button" className="gm-card__btn gm-card__btn--quiet" data-close="" onClick={menu.onClose}>Close</button>
        </div>
      ) : (
        <div className="gm-card__notes">
          {hoverNotes(state, target, item, IS_MAC).map((t) => <div key={t} className="gm-card__line" data-tone="muted">{t}</div>)}
        </div>
      )}
    </div>
  );
  if (!beside) return card;
  return (
    // a pinned pair is one card to a click, the worn item's half too
    <div
      ref={pairRef} className="gm-cardpair" data-item-card={pinned ? '' : undefined} data-pinned={pinned ? '' : undefined}
      style={{ left }}
    >
      {card}
      <div className="gm-cardpair__side">
        <div className="gm-card gm-card--equipped" data-rarity={rarityOf(worn)}><EquippedContent worn={worn} level={state.level} /></div>
        {compare !== null && compare.lines.length > 0 && (
          <div className="gm-card gm-card--compare">
            <div className="gm-card__kind">{compare.title}</div>
            <Lines lines={compare.lines} />
          </div>
        )}
      </div>
    </div>
  );
}
