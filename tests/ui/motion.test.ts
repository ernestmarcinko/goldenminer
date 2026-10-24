import { expect, it } from 'vitest';
import { DEFAULT_MOTION } from '../../src/core/types';
import { effectiveMotion } from '../../src/ui/settings/motion';

it('reduced motion turns everything off, otherwise settings rule', () => {
  expect(effectiveMotion(DEFAULT_MOTION, true)).toEqual({ floats: false, pops: false, lampFlicker: false, shaft: 'off' });
  const mine = { floats: false, pops: true, lampFlicker: false, shaft: 'smooth' as const };
  expect(effectiveMotion(mine, false)).toEqual(mine);
});
