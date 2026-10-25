import { BATTLE_SLOTS, MINING_SLOTS, type GearItem, type GearSet, type Slot } from '../../core/items';
import { gamblePrice, type GambleResult } from '../../core/merchant';
import type { GameState } from '../../core/types';
import { SLOT_LABELS, gearKindBase } from '../character/itemView';

export interface GambleSlot { slot: Slot; label: string; price: number; affordable: boolean }
export interface GambleGroup { set: GearSet; slots: GambleSlot[] }

/** The slots the merchant gambles on, mining gear then battle gear, each at today's price. */
export function gambleSlots(state: GameState): GambleGroup[] {
  const price = gamblePrice(state);
  const row = (slot: Slot): GambleSlot => ({ slot, label: SLOT_LABELS[slot], price, affordable: state.gold >= price });
  return [
    { set: 'mining', slots: MINING_SLOTS.map(row) },
    { set: 'battle', slots: BATTLE_SLOTS.map(row) },
  ];
}

/** Why a gamble was refused; an 'ok' needs no words, the "You got" panel shows the item. */
export function gambleResultText(r: GambleResult): string | null {
  switch (r) {
    case 'ok': return null;
    case 'noGold': return 'Not enough Gold.';
    case 'bagFull': return 'Your bag is full.';
  }
}

/** The "You got" panel's line under the item's name, e.g. "Rare gloves · item level 7 · now in your bag". */
export function gambledLine(item: GearItem): string {
  return `${gearKindBase(item)} · now in your bag`;
}
