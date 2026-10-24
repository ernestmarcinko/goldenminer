import { expect, it } from 'vitest';
import { hazardText, speedText } from '../../src/ui/mine/mineView';

it('speedText and hazardText', () => {
  expect(speedText({ metresPerMinute: 1.3, secondsToNext: 42 })).toBe('1.3 m/min · next metre in 42 s');
  expect(speedText({ metresPerMinute: 0.05, secondsToNext: 1300 })).toBe('20 min per metre · next metre in 21 min 40 s');
  expect(speedText(null)).toBe('Digging paused');
  expect(hazardText('gas', 0)).toBe('Gas pocket: digging here takes 2× as long');
  expect(hazardText('unstable', 30)).toBe('Unstable rock: digging here takes 1.4× as long (hazard ward 30 %)');
  expect(hazardText(null, 30)).toBeNull();
});
