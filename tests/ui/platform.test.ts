import { expect, it } from 'vitest';
import { cardClickTracker } from '../../src/ui/platform';

it('remembers a click inside a card until the pointer moves more than 3 px from its point', () => {
  const t = cardClickTracker();
  expect(t.through(100, 200)).toBe(false);
  t.click(100, 200, false);
  expect(t.through(100, 200)).toBe(false);
  t.click(100, 200, true);
  expect(t.through(100, 200)).toBe(true);
  expect(t.through(103, 200)).toBe(true);
  expect(t.through(103, 201)).toBe(false);
  // a click outside a card at the same point (what the closed card uncovered) keeps it, so a third is refused too
  t.click(100, 200, false);
  expect(t.through(100, 200)).toBe(true);
  // a hand on a mouse jitters: a move of up to 3 px keeps it, and a click there still counts as aimed at the card
  t.move(100, 200);
  t.move(103, 200);
  t.move(102, 202);
  expect(t.through(101, 202)).toBe(true);
  expect(t.through(104, 200)).toBe(false);
  t.move(104, 200);
  expect(t.through(100, 200)).toBe(false);
  t.move(100, 200);
  expect(t.through(100, 200)).toBe(false);
});
