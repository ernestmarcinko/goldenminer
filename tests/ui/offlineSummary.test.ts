import { expect, it } from 'vitest';
import { soulsLine } from '../../src/ui/OfflineSummary';

it('the Souls and levels line names only what changed', () => {
  expect(soulsLine(3, 0)).toBe('+3 Souls');
  expect(soulsLine(0, 1)).toBe('1 level gained');
  expect(soulsLine(1_250, 2)).toBe('+1,250 Souls · 2 levels gained');
  expect(soulsLine(0, 0)).toBe('');
});
