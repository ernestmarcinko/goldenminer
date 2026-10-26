import { RESET_WEB_DIAMONDS, RESPEC_GOLD_BASE, STASH_PAGE_SIZE } from './balance';
import {
  PASSIVE_NODE_BY_ID, START_NODE_ID, canAllocate, freeStashPages, isConnectedWeb, pointsToSpend, type PassiveNode,
} from './passives';
import { refundFreePages } from './stashPages';
import type { GameState } from './types';

/** A refund's Gold price, per node: it rises with the miner's level. */
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

/**
 * Allocates a whole sequence of nodes for their points, validating it first: each node must adjoin the start, an
 * allocated node, or an earlier node of the sequence. Nothing changes unless every node fits.
 */
export function allocateMany(state: GameState, ids: readonly string[]): 'ok' | 'noPoints' | 'notAdjacent' | 'allocated' | 'invalid' {
  if (ids.length === 0) return 'ok';
  if (new Set(ids).size !== ids.length) return 'invalid';
  const available = new Set(state.passives.allocated);
  available.add(START_NODE_ID);
  for (const id of ids) {
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node === undefined) return 'invalid';
    if (state.passives.allocated.includes(id)) return 'allocated';
    if (!node.links.some((link) => available.has(link))) return 'notAdjacent';
    available.add(id);
  }
  if (pointsToSpend(state) < ids.length) return 'noPoints';
  for (const id of ids) allocate(state, id);
  return 'ok';
}

/**
 * Refunds a set of nodes for Gold, one price each. The set must leave every remaining node connected to the start, so
 * a parent can be refunded only together with everything that depends on it. Free stash pages the set granted must be
 * empty. Nothing changes on a refusal.
 */
export function refundMany(
  state: GameState, ids: readonly string[],
): 'ok' | 'notAllocated' | 'notLeaf' | 'noGold' | 'occupied' | 'invalid' {
  if (ids.length === 0) return 'ok';
  if (new Set(ids).size !== ids.length) return 'invalid';
  let pages = 0;
  for (const id of ids) {
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node === undefined) return 'invalid';
    if (!state.passives.allocated.includes(id)) return 'notAllocated';
    pages += stashPagesOf(node);
  }
  const refunded = new Set(ids);
  const remaining = state.passives.allocated.filter((id) => !refunded.has(id));
  if (!isConnectedWeb(remaining)) return 'notLeaf';
  const price = refundPrice(state.level) * ids.length;
  if (state.gold < price) return 'noGold';
  if (pages > 0 && refundFreePages(state, pages) === 'occupied') return 'occupied';
  state.gold -= price;
  state.stats.goldSpent += price;
  state.passives.allocated = remaining;
  return 'ok';
}

/** Refunds one leaf node for Gold; the single-node case of `refundMany`. */
export function refund(state: GameState, id: string): 'ok' | 'notAllocated' | 'notLeaf' | 'noGold' | 'occupied' | 'invalid' {
  return refundMany(state, [id]);
}

/** A full reset for Diamonds: empties the web and removes its free stash pages (which must be empty). */
export function resetWeb(state: GameState): 'ok' | 'noDiamonds' | 'occupied' {
  if (state.diamonds < RESET_WEB_DIAMONDS) return 'noDiamonds';
  const free = freeStashPages(state);
  if (free > 0 && refundFreePages(state, free) === 'occupied') return 'occupied';
  state.diamonds -= RESET_WEB_DIAMONDS;
  state.stats.diamondsSpent += RESET_WEB_DIAMONDS;
  state.passives.allocated = [];
  return 'ok';
}
