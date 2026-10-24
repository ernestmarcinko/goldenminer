import { expect, it } from 'vitest';
import { saveProblem } from '../../src/ui/saveText';

it('explains each save problem in plain words', () => {
  expect(saveProblem('corrupt')).toBe('it is damaged');
  expect(saveProblem('invalid')).toBe('it is not a valid Golden Miner save');
  expect(saveProblem('future')).toBe('it was made by a newer version of the game');
});
