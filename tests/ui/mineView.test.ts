import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { digSpeed } from '../../src/core/dig';
import { startMap } from '../../src/core/maps';
import { digStatus, hazardText, pauseLabel, speedText } from '../../src/ui/mine/mineView';
import { gear, stashMap } from '../helpers/items';

it('speedText and hazardText', () => {
  expect(speedText({ metresPerMinute: 1.3, secondsToNext: 42 })).toBe('1.3 m/min · next metre in 42 s');
  expect(speedText({ metresPerMinute: 0.05, secondsToNext: 1300 })).toBe('20 min per metre · next metre in 21 min 40 s');
  expect(speedText(null)).toBe('Digging paused');
  expect(hazardText('gas', 0)).toBe('Gas pocket: digging here takes 2× as long');
  expect(hazardText('unstable', 30)).toBe('Unstable rock: digging here takes 1.4× as long (hazard ward 30 %)');
  expect(hazardText(null, 30)).toBeNull();
});

it('digStatus: the run first, then the Pause, then a full bag, else the speed', () => {
  const s = newGame(1, 0);
  const stats = deriveStats(s);
  expect(digStatus(s, stats)).toEqual({ kind: 'digging', text: speedText(digSpeed(s, stats)) });
  s.overflow.push(gear(s, 'boots'));
  expect(digStatus(s, stats)).toEqual({ kind: 'bagFull', text: 'Your bag is full. Make room to dig on.' });
  s.paused = true;
  expect(digStatus(s, stats)).toEqual({ kind: 'paused', text: 'Paused. Press Continue digging to dig on.' });
  startMap(s, stashMap(s, 1, 2).id);
  expect(digStatus(s, stats)).toEqual({ kind: 'run', text: 'Paused while the map runs.' });
});

it('pauseLabel names what the button does', () => {
  expect(pauseLabel(false)).toBe('Pause digging');
  expect(pauseLabel(true)).toBe('Continue digging');
});
