import { BATTLE_SLOTS, MINING_SLOTS, setOfSlot } from '../../core/items';
import type { GearSet, Slot } from '../../core/items';
import { itemName } from '../../core/itemData';
import type { GameState } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import { ItemButton } from './ItemGrid';
import type { ItemHandlers } from './ItemGrid';
import { SLOT_LABELS } from './itemView';

const LAYOUT: Record<GearSet, { left: readonly Slot[]; right: readonly Slot[] }> = {
  mining: { left: [MINING_SLOTS[0], MINING_SLOTS[2]], right: [MINING_SLOTS[1], MINING_SLOTS[3]] },
  battle: { left: [BATTLE_SLOTS[0], BATTLE_SLOTS[1]], right: [BATTLE_SLOTS[2], BATTLE_SLOTS[3], BATTLE_SLOTS[4]] },
};

function SlotView({ state, slot, handlers }: { state: GameState; slot: Slot; handlers: ItemHandlers }) {
  const item = state.equipped[setOfSlot(slot)][slot];
  return (
    <div className="gm-slot">
      {item === undefined ? (
        <div className="gm-slot__box gm-slot__box--empty" role="img" aria-label={`${SLOT_LABELS[slot]}: empty`} />
      ) : (
        <ItemButton
          item={item}
          target={{ where: 'worn', slot }}
          handlers={handlers}
          scale={4}
          className="gm-slot__box gm-item"
          label={`${SLOT_LABELS[slot]}: ${itemName(item)}`}
        />
      )}
      <span className="gm-slot__label">{SLOT_LABELS[slot]}</span>
    </div>
  );
}

export function PaperDoll({ state, set, handlers }: { state: GameState; set: GearSet; handlers: ItemHandlers }) {
  const { left, right } = LAYOUT[set];
  return (
    <div className="gm-doll">
      <div className="gm-doll__col gm-doll__col--left">
        {left.map((s) => <SlotView key={s} state={state} slot={s} handlers={handlers} />)}
      </div>
      <div className="gm-doll__figure"><Sprite name="miner" scale={6} /></div>
      <div className="gm-doll__col">
        {right.map((s) => <SlotView key={s} state={state} slot={s} handlers={handlers} />)}
      </div>
    </div>
  );
}
