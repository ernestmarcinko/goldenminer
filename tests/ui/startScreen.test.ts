import { describe, expect, it } from 'vitest';
import { MAX_CHARACTER_NAME, isValidCharacterName } from '../../src/core/names';
import { MAX_SEED_TEXT, isValidSeedText, seedFromText } from '../../src/core/seed';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { canStart, nameProblem, seedProblem } from '../../src/ui/start/startModel';

describe('start screen', () => {
  it('a valid name and seed pass, and an invalid one shows a problem and blocks Start', () => {
    expect(nameProblem('Gorvash')).toBeNull();
    expect(nameProblem('')).not.toBeNull();
    expect(nameProblem('   ')).not.toBeNull();
    expect(nameProblem('x'.repeat(MAX_CHARACTER_NAME + 1))).not.toBeNull();

    expect(seedProblem('amber-fox-427')).toBeNull();
    expect(seedProblem('')).not.toBeNull();
    expect(seedProblem('x'.repeat(MAX_SEED_TEXT + 1))).not.toBeNull();

    expect(canStart('Gorvash', 'amber-fox-427')).toBe(true);
    expect(canStart('', 'amber-fox-427')).toBe(false);
    expect(canStart('Gorvash', '')).toBe(false);
  });

  it('the prefills are random but valid, and a Start feeds the exact trimmed name and seed text', () => {
    const store = new GameStore({
      storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7,
    });
    store.load();
    const name = store.randomName();
    const seed = store.randomSeedText();
    expect(isValidCharacterName(name)).toBe(true);
    expect(isValidSeedText(seed)).toBe(true);
    expect(store.newWorld(`  ${name}  `, seed)).toBe(true);
    expect(store.state.characterName).toBe(name.trim());
    expect(store.state.worldSeed).toBe(seed);
    expect(store.state.seed).toBe(seedFromText(seed));
  });
});
