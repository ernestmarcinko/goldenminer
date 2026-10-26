import { MAX_STASH_PAGES, STASH_PAGE_SIZE, stashPagePrice } from './balance';
import { pageCount } from './cells';
import type { GameState } from './types';

/** Adds an empty page to the General tab for Gold; the price rises with each page bought. */
export function buyStashPage(state: GameState): 'ok' | 'noGold' | 'full' {
  const cells = state.stash.general;
  if (pageCount(cells) >= MAX_STASH_PAGES) return 'full';
  const price = stashPagePrice(state.stash.bought.general + 1);
  if (state.gold < price) return 'noGold';
  state.gold -= price;
  state.stash.bought.general += 1;
  for (let i = 0; i < STASH_PAGE_SIZE; i++) cells.push(null);
  return 'ok';
}

/** Removes `n` empty trailing pages (a refund of the web's free pages); refuses while one holds an item. */
export function refundFreePages(state: GameState, n: number): 'ok' | 'occupied' {
  if (n <= 0) return 'ok';
  const cells = state.stash.general;
  const start = cells.length - n * STASH_PAGE_SIZE;
  if (start < 0) return 'occupied';
  for (let i = start; i < cells.length; i++) {
    if (cells[i] !== null) return 'occupied';
  }
  cells.splice(start, n * STASH_PAGE_SIZE);
  return 'ok';
}
