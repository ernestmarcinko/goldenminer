import { itemAt } from '../../core/cells';
import type { GameState } from '../../core/types';
import { dropAttr } from './dragDrop';
import type { ItemHandlers } from './ItemGrid';
import { ItemButton } from './ItemGrid';
import { essenceTabCells } from './stashView';

/** The Essences tab: one cell per held essence or orb. Empty cells stay hidden, as the tab starts with none. */
export function EssenceTab({ state, handlers }: { state: GameState; handlers: ItemHandlers }) {
  const cells = essenceTabCells(state);
  if (cells.length === 0) {
    return <div className="gm-muted gm-small">No essences or orbs yet. Buy them from Ferrel the Refiner.</div>;
  }
  return (
    <div className="gm-mattab">
      {cells.map((cell) => {
        const target = { where: 'essences', key: cell.key } as const;
        const item = itemAt(state, target);
        return (
          <div key={cell.key} className="gm-mattab__slot">
            <div className="gm-mattab__cell" data-drop={dropAttr(target)}>
              {item === undefined ? null : (
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
