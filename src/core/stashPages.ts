import { MAX_STASH_PAGES, STASH_PAGE_SIZE, stashPagePrice } from './balance';
import { pageCount } from './cells';
import type { GameState } from './types';

/** Adds an empty page to the General or Maps tab for Gold; the price rises with each page that tab has bought. */
export function buyStashPage(state: GameState, tab: 'general' | 'maps'): 'ok' | 'noGold' | 'full' {
  const cells = state.stash[tab];
  if (pageCount(cells) >= MAX_STASH_PAGES) return 'full';
  const price = stashPagePrice(state.stash.bought[tab] + 1);
  if (state.gold < price) return 'noGold';
  state.gold -= price;
  state.stash.bought[tab] += 1;
  for (let i = 0; i < STASH_PAGE_SIZE; i++) cells.push(null);
  return 'ok';
}
