import { checkAchievements } from './achievements';
import { GAMBLE_GOLD } from './balance';
import { metreTier } from './bands';
import { firstEmpty } from './cells';
import { logDrop } from './dropLog';
import { rollGear, rollRarity } from './itemGen';
import { setOfSlot, type GearItem, type Slot } from './items';
import type { GameState } from './types';

export type GambleResult = 'ok' | 'noGold' | 'bagFull';

/** The tier a gamble rolls at: that of the deepest metre dug, tier 1 at the surface. */
export function gambleTier(state: GameState): number {
  return metreTier(Math.max(1, state.deepest));
}

export function gamblePrice(state: GameState): number {
  const t = gambleTier(state);
  return GAMBLE_GOLD * t * t;
}

/**
 * Buys a random item of `slot` at the deepest tier into the first empty bag cell. Bought gear skips the loot filter:
 * the player chose it. Both checks come before any draw, so a refusal leaves the state, rng and ids included, as it was.
 */
export function gamble(state: GameState, slot: Slot): { result: GambleResult; item?: GearItem } {
  const cell = firstEmpty(state.bag);
  if (cell < 0) return { result: 'bagFull' };
  const price = gamblePrice(state);
  if (state.gold < price) return { result: 'noGold' };
  const item = rollGear(state, gambleTier(state), setOfSlot(slot), rollRarity(state), slot);
  state.bag[cell] = item;
  state.gold -= price;
  state.stats.goldSpent += price;
  if (item.rarity === 'legendary') {
    state.stats.legendaries += 1;
    checkAchievements(state, 'legendaries');
  }
  state.stats.itemsBought += 1;
  checkAchievements(state, 'merchant');
  logDrop(state, item, { kind: 'merchant' }, { event: 'bag' });
  return { result: 'ok', item };
}
