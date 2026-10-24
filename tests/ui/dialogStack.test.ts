import { beforeEach, expect, it } from 'vitest';
import { isTopDialog, nextDialogId, nextFocusIndex, popDialog, pushDialog } from '../../src/ui/dialogStack';

beforeEach(() => {
  // leave the module's stack empty between tests
  for (let id = 1; id <= 3; id++) popDialog(id);
});

it('only the last pushed dialog is on top, and the one below takes over when it pops', () => {
  pushDialog(1);
  pushDialog(2);
  expect(isTopDialog(2)).toBe(true);
  expect(isTopDialog(1)).toBe(false);
  popDialog(2);
  expect(isTopDialog(1)).toBe(true);
});

it('popping a dialog that is not on top removes only that one', () => {
  pushDialog(1);
  pushDialog(2);
  pushDialog(3);
  popDialog(2);
  expect(isTopDialog(3)).toBe(true);
  popDialog(3);
  expect(isTopDialog(1)).toBe(true);
  expect(isTopDialog(2)).toBe(false);
});

it('a later dialog is deeper, and depths come round again once the stack empties', () => {
  expect(pushDialog(1)).toBe(1);
  expect(pushDialog(2)).toBe(2);
  expect(pushDialog(3)).toBe(3);
  popDialog(3);
  expect(pushDialog(3)).toBe(3);
  popDialog(1);
  popDialog(2);
  popDialog(3);
  expect(pushDialog(1)).toBe(1);
});

it('a dialog opened after an out-of-order close is still deeper than every one left open', () => {
  pushDialog(1);
  pushDialog(2);
  popDialog(1);
  expect(pushDialog(3)).toBe(3);
});

it('hands out increasing ids', () => {
  const a = nextDialogId();
  expect(nextDialogId()).toBeGreaterThan(a);
});

it('focus cycles round in both directions', () => {
  expect(nextFocusIndex(3, 2, false)).toBe(0);
  expect(nextFocusIndex(3, 0, false)).toBe(1);
  expect(nextFocusIndex(3, 0, true)).toBe(2);
  expect(nextFocusIndex(3, 2, true)).toBe(1);
  expect(nextFocusIndex(3, -1, false)).toBe(0);
  expect(nextFocusIndex(3, -1, true)).toBe(2);
  expect(nextFocusIndex(0, -1, false)).toBe(-1);
});
