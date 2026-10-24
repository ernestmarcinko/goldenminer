import { expect, test } from 'vitest';
import { cardPairLayout, placeTooltip } from '../../src/ui/character/itemView';

const anchor = { left: 100, top: 0, width: 52, height: 52 };

test('a card pair may reach left of its container, down to minLeft', () => {
  expect(placeTooltip(anchor, 388, 548, -900)).toEqual({ left: -160, top: 56 });
  expect(placeTooltip(anchor, 388, 548, -50)).toEqual({ left: -50, top: 56 });
});

test('a single card keeps to its container by default', () => {
  expect(placeTooltip(anchor, 388)).toEqual({ left: 100, top: 56 });
  expect(placeTooltip(anchor, 300)).toEqual({ left: 30, top: 56 });
});

test('the equipped card sits beside the compared one only for a hover card on a wide screen', () => {
  expect(cardPairLayout(1440, false)).toBe('row');
  expect(cardPairLayout(900, false)).toBe('row');
  expect(cardPairLayout(1440, true)).toBe('column');
  expect(cardPairLayout(390, false)).toBe('column');
  expect(cardPairLayout(899, false)).toBe('column');
});
