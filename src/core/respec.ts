import { RESET_WEB_DIAMONDS, RESPEC_GOLD_BASE, STASH_PAGE_SIZE } from './balance';
import { PASSIVE_NODE_BY_ID, canAllocate, canRefund, freeStashPages, pointsToSpend, type PassiveNode } from './passives';
import { refundFreePages } from './stashPages';
import type { GameState } from './types';

/** A refund's Gold price: it rises with the miner's level. */
export function refundPrice(level: number): number {
  return RESPEC_GOLD_BASE * level;
}

/** The free General pages a node grants (only Deep Pockets does today). */
function stashPagesOf(node: PassiveNode): number {
  return node.effects.reduce((sum, e) => sum + (e.kind === 'stashPages' ? e.value : 0), 0);
}

/** Allocates a node for one point, appending any free stash pages it grants. */
export function allocate(state: GameState, id: string): 'ok' | 'noPoints' | 'notAdjacent' | 'allocated' | 'invalid' {
  const node = PASSIVE_NODE_BY_ID.get(id);
  if (node === undefined) return 'invalid';
  if (state.passives.allocated.includes(id)) return 'allocated';
  if (!canAllocate(state, id)) return 'notAdjacent';
  if (pointsToSpend(state) <= 0) return 'noPoints';
  state.passives.allocated.push(id);
  const pages = stashPagesOf(node);
  if (pages > 0) {
    for (let i = 0; i < pages * STASH_PAGE_SIZE; i++) state.stash.general.push(null);
  }
  return 'ok';
}

/** Refunds a leaf node for Gold, removing any free stash pages it granted (which must be empty). */
export function refund(state: GameState, id: string): 'ok' | 'notAllocated' | 'notLeaf' | 'noGold' | 'occupied' | 'invalid' {
  const node = PASSIVE_NODE_BY_ID.get(id);
  if (node === undefined) return 'invalid';
  if (!state.passives.allocated.includes(id)) return 'notAllocated';
  if (!canRefund(state, id)) return 'notLeaf';
  const price = refundPrice(state.level);
  if (state.gold < price) return 'noGold';
  const pages = stashPagesOf(node);
  if (pages > 0 && refundFreePages(state, pages) === 'occupied') return 'occupied';
  state.gold -= price;
  state.passives.allocated = state.passives.allocated.filter((n) => n !== id);
  return 'ok';
}

/** A full reset for Diamonds: empties the web and removes its free stash pages (which must be empty). */
export function resetWeb(state: GameState): 'ok' | 'noDiamonds' | 'occupied' {
  if (state.diamonds < RESET_WEB_DIAMONDS) return 'noDiamonds';
  const free = freeStashPages(state);
  if (free > 0 && refundFreePages(state, free) === 'occupied') return 'occupied';
  state.diamonds -= RESET_WEB_DIAMONDS;
  state.passives.allocated = [];
  return 'ok';
}
