import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { sameLoc } from '../../core/cells';
import type { GearSet } from '../../core/items';
import type { GameState } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { ItemCard } from './ItemCard';
import type { ItemHandlers } from './ItemGrid';
import { actionForIntent, itemActions, resultText, runAction } from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import type { ItemDrag } from './useItemDrag';
import { useItemPopover } from './useItemPopover';

const targetKey = (t: ItemTarget): string => {
  switch (t.where) {
    case 'worn': return `worn-${t.slot}`;
    case 'bag': return `bag-${t.set}-${t.index}`;
    case 'stash': return `stash-${t.index}`;
    case 'gems': return `gems-${t.gem}-${t.grade}`;
  }
};

/**
 * Everything a container of items needs besides its grid: click and menu handlers, the refusal message, and the
 * hover tooltip and action card (`cards`, to render inside `containerRef`, which must be `position: relative`).
 * `fallbackRef` takes focus when the item that opened a card has left the container. `drag` is shared by every
 * container; `say` shows a message on this container's status line. `reset` is for a change of view: it clears the
 * message and the popovers, and puts back a held item.
 */
export function useItemInteractions({ store, state, shownSet, containerRef, fallbackRef, drag }: {
  store: GameStore;
  state: GameState;
  shownSet: GearSet;
  containerRef: RefObject<HTMLElement | null>;
  fallbackRef: RefObject<HTMLElement | null>;
  drag: ItemDrag;
}): {
  handlers: ItemHandlers; message: string | null; say: (text: string | null) => void; cards: ReactNode; reset: () => void;
} {
  const [message, setMessage] = useState<string | null>(null);
  const popover = useItemPopover(containerRef);
  const { inspect, clear, openMenu, closeMenu, leaveMenu } = popover;

  // a drag hides the tooltip and closes the card
  const { dragging, held, release } = drag;
  useEffect(() => {
    if (!dragging) return;
    clear();
    closeMenu();
  }, [dragging, clear, closeMenu]);

  const perform = (target: ItemTarget, action: ActionSpec, fromCard = false): void => {
    setMessage(resultText(runAction(store, target, action, shownSet)));
    release();
    clear();
    closeMenu(fromCard, fallbackRef.current);
  };

  const handlers: ItemHandlers = {
    drag,
    onInspect: (target, el) => { if (!dragging) inspect(target, el); },
    onClear: clear,
    onMenu: (target, el) => openMenu(target, el),
    onPick: (target, intent, el) => {
      const chosen = actionForIntent(itemActions(state, target, shownSet), target, intent);
      if (chosen === 'menu') openMenu(target, el);
      else if (chosen !== undefined) perform(target, chosen);
    },
  };

  const { hover, menu } = popover;
  const cards = (
    <>
      {hover && (
        <ItemCard state={state} target={hover.target} shownSet={shownSet} left={hover.left} top={hover.top} />
      )}
      {menu && (
        <ItemCard
          key={targetKey(menu.target)}
          state={state} target={menu.target} shownSet={shownSet}
          left={menu.left} top={menu.top}
          menu={{
            onAction: (a) => perform(menu.target, a, true),
            onClose: () => closeMenu(true, fallbackRef.current),
            onLeave: leaveMenu,
            onPutBack: held !== null && sameLoc(held, menu.target)
              ? () => { release(); closeMenu(true, fallbackRef.current); }
              : undefined,
          }}
        />
      )}
    </>
  );

  return { handlers, message, say: setMessage, cards, reset: () => { setMessage(null); clear(); closeMenu(); release(); } };
}
