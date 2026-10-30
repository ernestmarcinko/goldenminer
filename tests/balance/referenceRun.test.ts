import { expect, it } from 'vitest';
import { runReference } from '../../src/core/sim';

it('the reference run reaches the pacing targets', () => {
  const report = runReference({ seed: 12345, days: 24 });
  console.log(JSON.stringify(report, null, 2));

  expect(report.firstMapSec).toBeGreaterThan(0);
  expect(report.firstMapSec).toBeLessThanOrEqual(60);
  expect(report.autoMapLevel).toBeGreaterThanOrEqual(28);
  expect(report.autoMapLevel).toBeLessThanOrEqual(32);
  // The hard anchor is level 30. The idealized reference reaches it earlier in wall-clock time than the design's
  // day 3–4 estimate, which assumes a human's inventory, deaths and reading; the upper bound still guards the week.
  // The horde rebalance (more monsters a room, cleave, softer swarm attacks) speeds the idealized run up.
  expect(report.autoMapDay).toBeGreaterThanOrEqual(0.75);
  expect(report.autoMapDay).toBeLessThanOrEqual(4.5);
  // The level-100 cap is the target. Achievements are a permanent-boost meta-progression, and the 1 % boost snowballs
  // the idealized reference run to the cap — faster than the pre-achievement 2–3-week estimate; a human's first run is
  // longer. Hordes of up to 1,000 a room raise the XP throughput, so the idealized cap lands around day 3 rather than 9–10.
  expect(report.capDay).toBeGreaterThanOrEqual(2.5);
  expect(report.capDay).toBeLessThanOrEqual(19);
  expect(report.frontierTierAfterDay).toBeGreaterThanOrEqual(report.frontierTierAtCap);
  expect(report.ascensionPointsAtCap).toBeGreaterThanOrEqual(1);
  // The second run's level bonus: +1 point per 10 levels past 60, so +4 at level 100.
  expect(report.levelBonusSecondRun).toBe(4);

  const again = runReference({ seed: 12345, days: 24 });
  expect(again).toEqual(report);
}, 600_000);
