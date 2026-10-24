import { useRef, useState } from 'react';
import { BAG_SIZE } from '../../core/balance';
import type { GearSet } from '../../core/items';
import { gearTotals } from '../../core/stats';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { ItemCard } from './ItemCard';
import { ItemGrid } from './ItemGrid';
import type { ItemHandlers } from './ItemGrid';
import { actionForIntent, itemActions, resultText, runAction } from './itemActions';
import type { ActionSpec, ItemTarget } from './itemActions';
import { battleStatLine, miningStatLine } from './itemView';
import { PaperDoll } from './PaperDoll';
import { useItemPopover } from './useItemPopover';
import './character.css';

const SETS: readonly { set: GearSet; toggle: string; bag: string }[] = [
  { set: 'mining', toggle: 'Mining set', bag: 'Mining bag' },
  { set: 'battle', toggle: 'Battle set', bag: 'Battle bag' },
];

export function CharacterPanel({ store }: { store: GameStore }) {
  const { state, stats } = useGame(store);
  const [set, setSet] = useState<GearSet>('mining');
  const [message, setMessage] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const popover = useItemPopover(panelRef);
  const { inspect, clear, openMenu, closeMenu } = popover;

  const perform = (target: ItemTarget, action: ActionSpec): void => {
    setMessage(resultText(runAction(store, target, action, set)));
    clear();
    closeMenu();
  };

  const handlers: ItemHandlers = {
    onInspect: inspect,
    onClear: clear,
    onMenu: (target, el) => openMenu(target, el),
    onPick: (target, intent, el) => {
      const chosen = actionForIntent(itemActions(state, target, set), target, intent);
      if (chosen === 'menu') openMenu(target, el);
      else if (chosen !== undefined) perform(target, chosen);
    },
  };

  const current = SETS.find((s) => s.set === set) ?? SETS[0];
  const bag = state.bags[set];
  return (
    <section ref={panelRef} aria-label="Character" className="gm-char">
      <div className="gm-char__head">
        <h2 className="gm-char__title">Character</h2>
        <div role="group" aria-label="Gear set" className="gm-char__toggle">
          {SETS.map((s) => (
            <button
              key={s.set}
              type="button"
              className="gm-char__tab"
              aria-pressed={set === s.set}
              onClick={() => { setSet(s.set); setMessage(null); clear(); closeMenu(); }}
            >
              {s.toggle}
            </button>
          ))}
        </div>
      </div>

      <PaperDoll state={state} set={set} handlers={handlers} />

      <div className="gm-char__stats">
        {set === 'mining' ? miningStatLine(stats, state.deepest) : battleStatLine(gearTotals(state, 'battle'))}
      </div>

      <h3 className="gm-char__bag">
        {current?.bag} <span className="gm-muted">{formatNumber(bag.length)} / {BAG_SIZE}</span>
      </h3>
      <ItemGrid
        items={bag}
        capacity={BAG_SIZE}
        targetOf={(index) => ({ where: 'bag', set, index })}
        handlers={handlers}
      />
      <div className="gm-char__status gm-small" role="status">{message}</div>
      <p className="gm-char__hint gm-muted gm-small">
        Hover an item to inspect it, click to equip. Alt+click sells, Shift+click stashes, right-click shows
        everything. On a touch screen, tap an item.
      </p>

      {popover.hover && (
        <ItemCard
          state={state} target={popover.hover.target} shownSet={set}
          left={popover.hover.left} top={popover.hover.top}
        />
      )}
      {popover.menu && (
        <ItemCard
          state={state} target={popover.menu.target} shownSet={set}
          left={popover.menu.left} top={popover.menu.top}
          menu={{
            onAction: (a) => { if (popover.menu) perform(popover.menu.target, a); },
            onClose: () => closeMenu(true),
          }}
        />
      )}
    </section>
  );
}
