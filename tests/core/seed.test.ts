import { expect, it } from 'vitest';
import { ANIMALS, ADJECTIVES, freshWorld, isValidSeedText, randomSeedText, seedFromText } from '../../src/core/seed';
import { newGame } from '../../src/core/newGame';

it('seed text maps to a 32-bit world seed', () => {
  expect(seedFromText('amber-fox-427')).toBe(3_552_404_222);
  expect(seedFromText('golden mole')).toBe(2_552_287_895);
  expect(seedFromText(' Golden Mole ')).toBe(2_552_287_895);
  expect(seedFromText('1234')).toBe(1234);
  expect(seedFromText('007')).toBe(7);
  expect(seedFromText('4294967295')).toBe(4_294_967_295);
  expect(seedFromText('4294967296')).toBe(2_782_066_575);
  expect(seedFromText('Grube 🪨 Stollen')).toBe(seedFromText('grube 🪨 stollen'));
  expect([isValidSeedText(''), isValidSeedText('   '), isValidSeedText('x'.repeat(64)), isValidSeedText('x'.repeat(65))]).toEqual([false, false, true, false]);
});

it('random seeds read as words', () => {
  expect([ADJECTIVES.length, ANIMALS.length]).toEqual([40, 40]);
  expect(randomSeedText(() => 7)).toBe(`${ADJECTIVES[7]}-${ANIMALS[7]}-8`);
  const calls: number[] = [];
  let n = 100;
  const w = freshWorld(() => { calls.push(n); return n++; }, 5);
  expect(calls).toHaveLength(4);
  expect(w.worldSeed).toBe(`${ADJECTIVES[100 % 40]}-${ANIMALS[101 % 40]}-${1 + (102 % 999)}`);
  expect(w.seed).toBe(seedFromText(w.worldSeed));
  expect(w.worldGen).toBe(2);
});

it('the same seed builds the same mine; the loot stream is separate', () => {
  const a = newGame(seedFromText('golden mole'), 0, { seedText: 'golden mole', lootSeed: 1 });
  const b = newGame(seedFromText('golden mole'), 0, { seedText: 'golden mole', lootSeed: 2 });
  expect(a.ahead).toEqual(b.ahead);
  expect(a.rng).not.toBe(b.rng);
  expect(newGame(5, 0).rng).toBe(newGame(5, 0, { lootSeed: 5 }).rng);
  expect(newGame(5, 0).worldSeed).toBe('5');
});
