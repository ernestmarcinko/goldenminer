import { BATTLE_SLOTS, MINING_SLOTS, setOfSlot } from '../../core/items';
import type { GearSet, Slot } from '../../core/items';
import { itemName } from '../../core/itemData';
import type { GameState } from '../../core/types';
import { Sprite } from '../../sprites/Sprite';
import { EmptyTarget, ItemButton } from './ItemGrid';
import type { ItemHandlers } from './ItemGrid';
import { SLOT_LABELS } from './itemView';

const LAYOUT: Record<GearSet, { left: readonly Slot[]; right: readonly Slot[] }> = {
  mining: { left: [MINING_SLOTS[0], MINING_SLOTS[2]], right: [MINING_SLOTS[1], MINING_SLOTS[3]] },
  battle: { left: [BATTLE_SLOTS[0], BATTLE_SLOTS[1]], right: [BATTLE_SLOTS[2], BATTLE_SLOTS[3], BATTLE_SLOTS[4]] },
};

function SlotView({ state, slot, handlers, flash }: { state: GameState; slot: Slot; handlers: ItemHandlers; flash: boolean }) {
  const item = state.equipped[setOfSlot(slot)][slot];
  return (
    <div className="gm-slot" data-flash={flash || undefined}>
      {item === undefined ? (
        <EmptyTarget
          target={{ where: 'worn', slot }}
          drag={handlers.drag}
          className="gm-slot__box gm-slot__box--empty"
          label={`${SLOT_LABELS[slot]}: empty`}
        />
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

/** `flashSlot` is the slot an item just went into, which glows for a moment. */
export function PaperDoll({ state, set, handlers, flashSlot }: {
  state: GameState; set: GearSet; handlers: ItemHandlers; flashSlot: Slot | null;
}) {
  const { left, right } = LAYOUT[set];
  return (
    <div className="gm-doll">
      <div className="gm-doll__col gm-doll__col--left">
        {left.map((s) => <SlotView key={s} state={state} slot={s} handlers={handlers} flash={s === flashSlot} />)}
      </div>
      <div className="gm-doll__figure"><Sprite name="miner" scale={6} /></div>
      <div className="gm-doll__col">
        {right.map((s) => <SlotView key={s} state={state} slot={s} handlers={handlers} flash={s === flashSlot} />)}
      </div>
    </div>
  );
}
