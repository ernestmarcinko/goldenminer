import { describe, expect, it } from 'vitest';
import { formatCompact, formatDuration, formatEta, formatNumber, formatRate, plural } from '../../src/ui/format';

describe('formatNumber', () => {
  it('uses en-US separators and never exponents', () => {
    expect(formatNumber(2480)).toBe('2,480');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1e12)).toBe('1,000,000,000,000');
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

describe('formatRate', () => {
  it('keeps at most one decimal', () => {
    expect(formatRate(1.1)).toBe('1.1');
    expect(formatRate(1)).toBe('1');
    expect(formatRate(2.369)).toBe('2.4');
    expect(formatRate(1234.56)).toBe('1,234.6');
  });
});

describe('plural', () => {
  it('picks the word for the count', () => {
    expect(plural(1, 'chest', 'chests')).toBe('1 chest');
    expect(plural(0, 'chest', 'chests')).toBe('0 chests');
    expect(plural(1500, 'tick', 'ticks')).toBe('1,500 ticks');
  });
});

describe('formatCompact', () => {
  it('shortens thousands and millions to one decimal', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(1240)).toBe('1.2K');
    expect(formatCompact(1_000_000)).toBe('1M');
  });
});

it('formatEta', () => {
  expect([formatEta(42), formatEta(0.4), formatEta(125), formatEta(3725)]).toEqual(['42 s', '1 s', '2 min 5 s', '1 h 2 min']);
});
