import { describe, expect, it } from 'vitest';
import {
  creatureName, defaultCharacterName, isValidCharacterName, MAX_CHARACTER_NAME, randomCharacterName, SALT_CHARACTER_NAME,
} from '../../src/core/names';
import { hash2 } from '../../src/core/rng';

describe('character names', () => {
  it('validates a character name', () => {
    expect(isValidCharacterName('Gorvash')).toBe(true);
    expect(isValidCharacterName('  Gorvash  ')).toBe(true);
    expect(isValidCharacterName('a')).toBe(true);
    expect(isValidCharacterName('x'.repeat(MAX_CHARACTER_NAME))).toBe(true);
    expect(isValidCharacterName('')).toBe(false);
    expect(isValidCharacterName('   ')).toBe(false);
    expect(isValidCharacterName('x'.repeat(MAX_CHARACTER_NAME + 1))).toBe(false);
    expect(isValidCharacterName('Gor\u0000vash')).toBe(false);
    expect(isValidCharacterName('Gor\nvash')).toBe(false);
  });

  it('draws a random name from the generator', () => {
    expect(randomCharacterName(() => 0x12345678)).toBe(creatureName(0x12345678));
    expect(randomCharacterName(() => 7)).toBe(creatureName(7));
  });

  it('derives a deterministic, pronounceable default name from the seed', () => {
    expect(defaultCharacterName(12345)).toBe(creatureName(hash2(12345, SALT_CHARACTER_NAME)));
    expect(defaultCharacterName(12345)).toBe(defaultCharacterName(12345));
    expect(defaultCharacterName(1)).not.toBe('');
    expect(defaultCharacterName(12345).length).toBeGreaterThan(0);
    expect(defaultCharacterName(12345).length).toBeLessThanOrEqual(MAX_CHARACTER_NAME);
  });
});
