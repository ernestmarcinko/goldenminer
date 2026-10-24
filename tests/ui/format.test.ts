import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from '../../src/ui/format';

describe('formatNumber', () => {
  it('uses en-US separators and never exponents', () => {
    expect(formatNumber(2480)).toBe('2,480');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1e21)).toBe('1,000,000,000,000,000,000,000');
    expect(formatNumber(12.7)).toBe('13');
  });
});

describe('formatDuration', () => {
  it('shows hours and minutes', () => {
    expect(formatDuration(8 * 3600_000)).toBe('8h 0m');
    expect(formatDuration(5 * 60_000 + 59_000)).toBe('5m');
    expect(formatDuration(30_000)).toBe('less than a minute');
  });
});
