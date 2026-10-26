import { expect, it } from 'vitest';
import { MAX_STASH_PAGES, STASH_PAGE_SIZE, stashPagePrice } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';
import { buyStashPage } from '../../src/core/stashPages';

it('a page costs 5,000 Gold times the square of its number in that tab', () => {
  expect([1, 2, 3].map(stashPagePrice)).toEqual([5000, 20_000, 45_000]);
});

it('buying a General page adds 60 empty cells, charges the price and counts it', () => {
  const s = newGame(1, 0);
  s.gold = 5000;
  expect(buyStashPage(s)).toBe('ok');
  expect(s.stash.general).toHaveLength(180);
  expect(s.stash.general.slice(120).every((c) => c === null)).toBe(true);
  expect(s.gold).toBe(0);
  expect(s.stash.bought).toEqual({ general: 1 });
  expect(s.stash.maps).toEqual({});
});

it('the next page costs more, and without the Gold nothing changes', () => {
  const s = newGame(1, 0);
  s.gold = 5000;
  buyStashPage(s);
  s.gold = 19_999;
  expect(buyStashPage(s)).toBe('noGold');
  expect(s.stash.general).toHaveLength(180);
  expect(s.gold).toBe(19_999);
  expect(s.stash.bought.general).toBe(1);
  s.gold = 20_000;
  expect(buyStashPage(s)).toBe('ok');
  expect(s.stash.general).toHaveLength(240);
  expect(s.gold).toBe(0);
});

it('a tab at the page cap is full, before any Gold check', () => {
  const s = newGame(1, 0);
  s.stash.general = Array.from({ length: MAX_STASH_PAGES * STASH_PAGE_SIZE }, () => null);
  s.gold = 0;
  expect(buyStashPage(s)).toBe('full');
  s.gold = Number.MAX_SAFE_INTEGER;
  expect(buyStashPage(s)).toBe('full');
  expect(s.stash.general).toHaveLength(MAX_STASH_PAGES * STASH_PAGE_SIZE);
});
