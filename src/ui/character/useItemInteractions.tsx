import { useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { GearSet } from '../../core/items';
import type { GameState } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { ItemCard } from './ItemCard';
import type { ItemHandlers } from './ItemGrid';
import { actionForIntent, itemActions, resultText, runAction } from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import { useItemPopover } from './useItemPopover';

const targetKey = (t: ItemTarget): string =>
  t.where === 'worn' ? `worn-${t.slot}` : t.where === 'bag' ? `bag-${t.set}-${t.index}` : `stash-${t.index}`;

/**
 * Everything a container of items needs besides its grid: click and menu handlers, the refusal message, and the
 * hover tooltip and action card (`cards`, to render inside `containerRef`, which must be `position: relative`).
 * `fallbackRef` takes focus when the item that opened a card has left the container.
 */
export function useItemInteractions({ store, state, shownSet, containerRef, fallbackRef }: {
  store: GameStore;
  state: GameState;
  shownSet: GearSet;
  containerRef: RefObject<HTMLElement | null>;
  fallbackRef: RefObject<HTMLElement | null>;
}): { handlers: ItemHandlers; message: string | null; cards: ReactNode; reset: () => void } {
  const [message, setMessage] = useState<string | null>(null);
  const popover = useItemPopover(containerRef);
  const { inspect, clear, openMenu, closeMenu } = popover;

  const perform = (target: ItemTarget, action: ActionSpec, fromCard = false): void => {
    setMessage(resultText(runAction(store, target, action, shownSet)));
    clear();
    closeMenu(fromCard, fallbackRef.current);
  };

  const handlers: ItemHandlers = {
    onInspect: inspect,
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
            onLeave: () => closeMenu(),
          }}
        />
      )}
    </>
  );

  return { handlers, message, cards, reset: () => { setMessage(null); clear(); closeMenu(); } };
}
