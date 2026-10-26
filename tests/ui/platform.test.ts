import { expect, it } from 'vitest';
import { cardClickTracker } from '../../src/ui/platform';

it('remembers a click inside a card until the pointer moves off its point', () => {
  const t = cardClickTracker();
  expect(t.through(100, 200)).toBe(false);
  t.click(100, 200, false);
  expect(t.through(100, 200)).toBe(false);
  t.click(100, 200, true);
  expect(t.through(100, 200)).toBe(true);
  expect(t.through(101, 200)).toBe(false);
  // a click outside a card at the same point (what the closed card uncovered) keeps it, so a third is refused too
  t.click(100, 200, false);
  expect(t.through(100, 200)).toBe(true);
  t.move(100, 200);
  expect(t.through(100, 200)).toBe(true);
  t.move(100, 201);
  expect(t.through(100, 200)).toBe(false);
  t.move(100, 200);
  expect(t.through(100, 200)).toBe(false);
});
