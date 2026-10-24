import { itemAt } from '../../core/cells';
import type { GameState } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import { dropAttr } from './dragDrop';
import type { ItemHandlers } from './ItemGrid';
import { ItemButton } from './ItemGrid';
import { baseSprite } from './itemView';
import { materialTabCells } from './stashView';

/** The Materials tab: one cell per material, in a row. A cell with materials is a stack to click; an empty one is dimmed. */
export function MaterialTab({ state, handlers }: { state: GameState; handlers: ItemHandlers }) {
  return (
    <div className="gm-mattab">
      {materialTabCells(state).map((cell) => {
        const target = { where: 'materials', material: cell.material } as const;
        const item = itemAt(state, target);
        // The wrapper stays mounted as the count crosses 0 and 1, so it carries the drop target.
        return (
          <div key={cell.material} className="gm-mattab__slot">
            <div className="gm-mattab__cell" data-material={cell.material} data-drop={dropAttr(target)}>
              {item === undefined ? (
                <div
                  className="gm-cell gm-item gm-item--dim"
                  data-rarity="material"
                  aria-hidden="true"
                  onClick={() => handlers.drag.onTap(target, false)}
                >
                  <Sprite name={baseSprite(cell.material)} scale={3} />
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
            <span className="gm-mattab__name">{cell.label}</span>
          </div>
        );
      })}
    </div>
  );
}
