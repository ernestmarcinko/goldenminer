import { expect, it } from 'vitest';
import { runReference } from '../../src/core/sim';

it('the reference week reaches the pacing targets', () => {
  const report = runReference({ seed: 12345, days: 8 });
  console.log(JSON.stringify(report, null, 2));

  expect(report.firstMapSec).toBeGreaterThan(0);
  expect(report.firstMapSec).toBeLessThanOrEqual(60);
  expect(report.autoMapLevel).toBeGreaterThanOrEqual(28);
  expect(report.autoMapLevel).toBeLessThanOrEqual(32);
  expect(report.autoMapDay).toBeGreaterThanOrEqual(3);
  expect(report.autoMapDay).toBeLessThanOrEqual(4.5);
  expect(report.capDay).toBeGreaterThanOrEqual(4);
  expect(report.capDay).toBeLessThanOrEqual(8);
  expect(report.frontierTierAfterDay).toBeGreaterThanOrEqual(report.frontierTierAtCap);
  expect(report.ascensionPointsAtCap).toBeGreaterThanOrEqual(1);

  const again = runReference({ seed: 12345, days: 8 });
  expect(again).toEqual(report);
}, 600_000);
