import { itemAt } from '../../core/cells';
import { itemName } from '../../core/itemData';
import { Sprite } from '../../sprites/Sprite';
import type { GameState } from '../../core/types';
import type { ItemHandlers } from './ItemGrid';
import { ItemButton } from './ItemGrid';
import { baseSprite } from './itemView';
import { GRADE_HEADERS, gemTabRows } from './stashView';
import type { GemRow } from './stashView';

/** The Gems tab: one cell per gem and grade. A cell with gems is a stack to click; an empty one is dimmed. */
export function GemTab({ state, handlers }: { state: GameState; handlers: ItemHandlers }) {
  const rows = gemTabRows(state);
  return (
    <div className="gm-gemtab">
      <span />
      {GRADE_HEADERS.map((grade) => (
        <span key={grade} className="gm-gemtab__head">{grade}</span>
      ))}
      {rows.map((row) => (
        <GemLine key={row.gem} row={row} state={state} handlers={handlers} />
      ))}
    </div>
  );
}

function GemLine({ row, state, handlers }: { row: GemRow; state: GameState; handlers: ItemHandlers }) {
  return (
    <>
      <span className="gm-gemtab__name" data-gem={row.gem}>{row.label}</span>
      {row.cells.map((cell) => {
        const target = { where: 'gems', gem: row.gem, grade: cell.grade } as const;
        const item = itemAt(state, target);
        return item === undefined ? (
          <div key={cell.grade} className="gm-cell gm-item gm-item--dim" data-rarity="gem" aria-hidden="true">
            <Sprite name={baseSprite(row.gem)} scale={3} />
          </div>
        ) : (
          <ItemButton
            key={cell.grade}
            item={item}
            target={target}
            handlers={handlers}
            scale={3}
            className="gm-cell gm-item"
            label={itemName(item)}
          />
        );
      })}
    </>
  );
}
