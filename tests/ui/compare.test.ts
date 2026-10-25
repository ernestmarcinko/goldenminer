import { expect, test } from 'vitest';
import { cardPairLayout, placeCardLeft } from '../../src/ui/character/itemView';

test('a card pair starts at its item, and keeps 8 px inside the screen', () => {
  expect(placeCardLeft(100, 548, 1280)).toBe(100);
  expect(placeCardLeft(900, 548, 1280)).toBe(724);
  expect(placeCardLeft(900, 548, 1280, 40)).toBe(724);
  expect(placeCardLeft(10, 548, 1280, 40)).toBe(40);
});

test('a single card keeps to the screen', () => {
  expect(placeCardLeft(100, 270, 388)).toBe(100);
  expect(placeCardLeft(300, 270, 388)).toBe(110);
});

test('the equipped card sits beside the compared one only for a hover card on a wide screen', () => {
  expect(cardPairLayout(1440, false)).toBe('row');
  expect(cardPairLayout(900, false)).toBe('row');
  expect(cardPairLayout(1440, true)).toBe('column');
  expect(cardPairLayout(390, false)).toBe('column');
  expect(cardPairLayout(899, false)).toBe('column');
});
