import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { itemAt, sameLoc } from '../../core/cells';
import type { GameState } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { effectiveMotion, usePrefersReducedMotion } from '../settings/motion';
import { craftResultText, craftTargetAt } from './craftView';
import { ItemCard } from './ItemCard';
import type { ItemHandlers } from './ItemGrid';
import {
  actionForIntent, itemActions, noShortcutText, refusedMap, resultText, runAction, soulUpgradeResultText,
} from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import { wornToCompare } from './itemView';
import type { ItemDrag } from './useItemDrag';
import { useItemPopover } from './useItemPopover';

const targetKey = (t: ItemTarget): string => {
  switch (t.where) {
    case 'worn': return `worn-${t.slot}`;
    case 'bag': return `bag-${t.index}`;
    case 'stash': return `stash-${t.index}`;
    case 'maps': return `maps-${t.tier}-${t.index}`;
    case 'gems': return `gems-${t.gem}-${t.grade}`;
    case 'materials': return `materials-${t.material}`;
    case 'stock': return `stock-${t.index}`;
  }
};

/**
 * Everything a container of items needs besides its grid: click and menu handlers, the refusal message, and the
 * hover, pinned and action cards (`cards`, rendered into the page's body, so no scrolling container clips them).
 * A card opened by a touch tap comes back as `tapCard` instead, to render in the flow below the grid its item is in
 * (`tapWhere`), so it never covers the cells, slots and tabs the lifted item can be placed on.
 * `fallbackRef` takes focus when the item that opened a card has left the container. `drag` is shared by every
 * container; `say` shows a message on this container's status line. `reset` is for a change of view: it clears the
 * message and the popovers, and puts back a held item.
 */
export function useItemInteractions({ store, state, fallbackRef, drag }: {
  store: GameStore;
  state: GameState;
  fallbackRef: RefObject<HTMLElement | null>;
  drag: ItemDrag;
}): {
  handlers: ItemHandlers; message: string | null; say: (text: string | null) => void; cards: ReactNode;
  tapCard: ReactNode; tapWhere: ItemTarget['where'] | null; reset: () => void;
} {
  const [message, setMessage] = useState<string | null>(null);
  const popover = useItemPopover((target) => {
    const item = itemAt(state, target);
    return item !== undefined && wornToCompare(state, item, target.where === 'worn') !== undefined;
  });
  const { inspect, clear, pin, unpin, openMenu, closeMenu, leaveMenu } = popover;
  // the tap card scrolls into view smoothly unless the player turned scrolling motion off or the system reduces motion
  const smooth = effectiveMotion(state.settings.motion, usePrefersReducedMotion()).shaft !== 'off';

  // a drag hides the cards
  const { dragging, held, release } = drag;
  useEffect(() => {
    if (!dragging) return;
    clear();
    unpin();
    closeMenu();
  }, [dragging, clear, unpin, closeMenu]);

  const perform = (target: ItemTarget, action: ActionSpec, fromCard = false): void => {
    // a craft or a Soul upgrade keeps the card open on the same item, so they can chain
    if (action.id === 'craft' && action.kind !== undefined) {
      setMessage(craftResultText(store.craft(target, action.kind), craftTargetAt(store.state, target)));
      return;
    }
    if (action.id === 'soulUpgrade') {
      setMessage(soulUpgradeResultText(store.soulUpgrade(target)));
      return;
    }
    const refused = refusedMap(store.state, target);
    setMessage(resultText(runAction(store, target, action), refused));
    release();
    clear();
    unpin();
    closeMenu(fromCard, fallbackRef.current);
  };

  const handlers: ItemHandlers = {
    drag,
    onInspect: (target, el) => { if (!dragging) inspect(target, el); },
    onClear: clear,
    onMenu: (target, el) => openMenu(target, el),
    onLift: (target, el) => openMenu(target, el, true),
    onPick: (target, intent, el) => {
      const chosen = actionForIntent(itemActions(state, target), target, intent);
      if (chosen === 'card') pin(target, el);
      else if (chosen === 'menu') openMenu(target, el);
      else if (chosen !== undefined) perform(target, chosen);
      else {
        const why = noShortcutText(state, target, intent);
        if (why !== null) setMessage(why);
      }
    },
  };

  const { hover, pinned, menu } = popover;
  const menuCard = menu && (
    <ItemCard
      key={`menu-${targetKey(menu.target)}`}
      state={state} target={menu.target}
      left={popover.menuLeft} fit={menu.fit} follow={popover.follow} inline={menu.inline === true} smooth={smooth}
      menu={{
        onAction: (a) => perform(menu.target, a, true),
        onClose: () => closeMenu(true, fallbackRef.current),
        onLeave: leaveMenu,
        onLost: popover.loseMenu,
        onPutBack: held !== null && sameLoc(held, menu.target)
          ? () => { release(); closeMenu(true, fallbackRef.current); }
          : undefined,
      }}
    />
  );
  // each card is keyed by its item, so one never keeps another's least height
  const cards = createPortal(
    <>
      {hover && (
        <ItemCard
          key={`hover-${targetKey(hover.target)}`}
          state={state} target={hover.target} left={hover.left} fit={hover.fit} pair={hover.pair === true}
        />
      )}
      {pinned && (
        <ItemCard
          key={`pin-${targetKey(pinned.target)}`}
          state={state} target={pinned.target} left={pinned.left} fit={pinned.fit} pair={pinned.pair === true} pinned
        />
      )}
      {menu?.inline !== true && menuCard}
    </>,
    document.body,
  );
  const tapCard = menu?.inline === true ? menuCard : null;

  return {
    handlers, message, say: setMessage, cards, tapCard, tapWhere: menu?.inline === true ? menu.target.where : null,
    reset: () => { setMessage(null); clear(); unpin(); closeMenu(); release(); },
  };
}
