import { expect, it } from 'vitest';
import { earnedCount } from '../../src/core/achievements';
import { playReference } from '../../src/core/sim';

it('the first session earns a handful of achievements, not dozens', () => {
  // The night's capped offline digging, then the first 15-minute check-in.
  const state = playReference({ seed: 12345, minutes: 495 });
  expect(earnedCount(state)).toBeLessThanOrEqual(12);
}, 600_000);
