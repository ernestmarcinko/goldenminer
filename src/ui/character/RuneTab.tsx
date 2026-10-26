import { itemAt } from '../../core/cells';
import type { GameState } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import { dropAttr } from './dragDrop';
import type { ItemHandlers } from './ItemGrid';
import { ItemButton } from './ItemGrid';
import { runeTabCells } from './stashView';

/** The Runes tab: one cell per kind, in catalogue order. A cell with runes is a stack to click; an empty one is dimmed. */
export function RuneTab({ state, handlers }: { state: GameState; handlers: ItemHandlers }) {
  return (
    <div className="gm-mattab">
      {runeTabCells(state).map((cell) => {
        const target = { where: 'runes', rune: cell.rune } as const;
        const item = itemAt(state, target);
        // The wrapper stays mounted as the count crosses 0 and 1, so it carries the drop target.
        return (
          <div key={cell.rune} className="gm-mattab__slot">
            <div className="gm-mattab__cell" data-rune={cell.rune} data-drop={dropAttr(target)}>
              {item === undefined ? (
                <div
                  className="gm-cell gm-item gm-item--dim"
                  data-rarity="rune"
                  aria-hidden="true"
                  onClick={() => handlers.drag.onTap(target, false)}
                >
                  <Sprite name={cell.rune} scale={3} />
                </div>
              ) : (
                <ItemButton
                  item={item}
                  target={target}
                  handlers={handlers}
                  scale={3}
                  className="gm-cell gm-item"
                  label={cell.label}
                />
              )}
            </div>
            <span className="gm-mattab__name" data-rune={cell.rune}>{cell.label}</span>
          </div>
        );
      })}
    </div>
  );
}
