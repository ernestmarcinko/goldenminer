import { expect, it } from 'vitest';
import { ASCENDANCY_START_ID, ascendancyPoints } from '../../src/core/ascendancy';
import { ASCEND_LEVEL } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';
import {
  ascendancyPointsLine, ascendancyVMs, ascendLine, pointsPreview,
} from '../../src/ui/ascend/ascensionView';

it('the view model marks the start allocated, and only offers nodes once there is a point', () => {
  const s = newGame(1, 0);
  const vms = ascendancyVMs(s);
  const start = vms.find((n) => n.id === ASCENDANCY_START_ID);
  expect(start?.allocated).toBe(true);
  expect(start?.allocatable).toBe(false);
  expect(start?.side).toBe('start');
  expect(vms.some((n) => n.allocatable)).toBe(false);   // no points yet
  s.ascendancy.points = 1;
  const ring = ascendancyVMs(s).find((n) => n.allocatable);
  expect(ring).toBeTruthy();
  expect(ring?.side).toBe('hybrid');
});

it('the points line says how many ascendancy points are left', () => {
  const s = newGame(1, 0);
  expect(ascendancyPointsLine(s)).toBe('No ascendancy points to spend');
  s.ascendancy.points = 3;
  expect(ascendancyPointsLine(s)).toBe('3 ascendancy points to spend');
  s.ascendancy.points = 1;
  expect(ascendancyPointsLine(s)).toBe('1 ascendancy point to spend');
});

it('the ascend line asks for the ascend level, then names the points', () => {
  const s = newGame(1, 0);
  s.level = ASCEND_LEVEL - 1;
  expect(ascendLine(s)).toBe('Reach level 60 to ascend');
  s.level = ASCEND_LEVEL;
  s.deepest = 2_500;
  expect(ascendLine(s)).toBe(`Ascend for ${ascendancyPoints(2_500, ASCEND_LEVEL, 0)} points`);
  expect(ascendLine(s)).toBe('Ascend for 3 points');
});

it('the points preview pairs the deepest depth with what it would pay', () => {
  const s = newGame(1, 0);
  s.level = ASCEND_LEVEL;
  s.deepest = 2_500;
  expect(pointsPreview(s)).toBe(`Deepest 2,500 m → ${ascendancyPoints(2_500, ASCEND_LEVEL, 0)} points`);
});

it('the points preview names the level once the level bonus is active', () => {
  const s = newGame(1, 0);
  s.lifetime.ascensions = 1;
  s.level = 100;
  s.deepest = 2_500;
  expect(pointsPreview(s)).toBe(`Deepest 2,500 m · level 100 → ${ascendancyPoints(2_500, 100, 1)} points`);
});

it('a node line names its effects in words, including the structural bonuses', () => {
  const s = newGame(1, 0);
  s.ascendancy.allocated = ['depthSmall1', 'insightSmall1', 'masterSurveyor', 'luckyBreak'];
  const vms = ascendancyVMs(s);
  const line = (id: string) => vms.find((n) => n.id === id)?.line;
  expect(vms.find((n) => n.id === 'depthSmall1')?.allocated).toBe(true);
  expect(line('depthSmall1')).toBe('+25 m starting depth');
  expect(line('insightSmall1')).toBe('+1 passive point');
  expect(line('masterSurveyor')).toBe('+2 auto-map tiers');
  expect(line('luckyBreak')).toBe('+10% chest find, +10% gem find, +10% map find');
});
