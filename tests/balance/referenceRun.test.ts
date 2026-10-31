import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../src/core/achievements';
import { EXPECTED_ACHIEVEMENTS_AT_LEVEL } from '../../src/core/balance';
import { runReference, type GateRecord, type SimReport } from '../../src/core/sim';

// The bands are the design (round 5a, spec §6): if the reference run misses one, the tuning changes, never the band.
const SEEDS = [12345, 777, 31337] as const;
const DAYS = 24;
const RUN_TIMEOUT = 1_800_000;

const reports = new Map<number, SimReport>();

/** The defence-aware reference run of `seed`, played once and shared by the checks below. */
function reportOf(seed: number): SimReport {
  const cached = reports.get(seed);
  if (cached !== undefined) return cached;
  const report = runReference({ seed, days: DAYS });
  reports.set(seed, report);
  return report;
}

/** The gates a run had passed by its first cap: every one below the frontier then. */
const gatesAtCap = (r: SimReport): GateRecord[] => r.gates.filter((g) => g.tier < r.frontierTierAtCap);

/** How long a gate held the run: from when the frontier reached it to its clear, waiting for a gate map included. */
const hold = (g: GateRecord): number => g.clearedDay - g.reachedDay;

const median = (xs: readonly number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

describe('the reference run (defence-aware)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: two weeks to the cap, a frontier near tier 50, and the achievements on schedule`, () => {
      const r = reportOf(seed);
      const total = ACHIEVEMENTS.length;
      const summary = JSON.stringify({
        capDay: r.capDay, frontier: r.frontierTierAtCap, day1: r.achievementsAtDay1, cap: r.achievementsAtCap,
        levels: [10, 30, 60, 100].map((l) => r.achievementsAtLevel[l]), secondCapDay: r.secondCapDay,
        gates: r.gates.map((g) => [g.tier, g.attempts, +hold(g).toFixed(2)]),
      });

      expect(r.capDay, summary).toBeGreaterThanOrEqual(12);
      // Interim band (owner decision 2026-10-31, spec §4.6): the cap day's top is 19; round 5b restores 16.
      expect(r.capDay, summary).toBeLessThanOrEqual(19);
      expect(r.achievementsAtDay1 / total, summary).toBeGreaterThanOrEqual(0.06);
      expect(r.achievementsAtDay1 / total, summary).toBeLessThanOrEqual(0.14);
      expect(r.achievementsAtCap / total, summary).toBeGreaterThanOrEqual(0.32);
      expect(r.achievementsAtCap / total, summary).toBeLessThanOrEqual(0.48);
      for (const level of [10, 30, 60, 100] as const) {
        const expected = EXPECTED_ACHIEVEMENTS_AT_LEVEL[level];
        const actual = r.achievementsAtLevel[level] ?? -1;
        expect(actual, `level ${level}: ${summary}`).toBeGreaterThanOrEqual(expected * 0.75);
        expect(actual, `level ${level}: ${summary}`).toBeLessThanOrEqual(expected * 1.25);
      }
      expect(r.frontierTierAtCap, summary).toBeGreaterThanOrEqual(45);
      expect(r.frontierTierAtCap, summary).toBeLessThanOrEqual(55);
      // every gate below the frontier was cleared: this holds by construction (the sim never runs past an uncleared
      // gate), so the real stall guard is the frontier band above
      for (const g of gatesAtCap(r)) expect(g.clearedDay, `gate ${g.tier}: ${summary}`).toBeGreaterThanOrEqual(0);
      // a later run is never slower
      expect(r.secondCapDay, summary).toBeGreaterThan(0);
      expect(r.secondCapDay, summary).toBeLessThanOrEqual(r.capDay);
    }, RUN_TIMEOUT);
  }

  it('gates are walls: most first attempts fail, and a typical gate holds about half a day', () => {
    const gates = SEEDS.flatMap((seed) => gatesAtCap(reportOf(seed)));
    const attempted = gates.filter((g) => g.attempts >= 1);
    const failedFirst = attempted.filter((g) => g.attempts > 1);
    const holds = gates.map(hold);
    const summary = JSON.stringify({ failedFirst: failedFirst.length, attempted: attempted.length, holds });
    expect(attempted.length, summary).toBeGreaterThan(0);
    // Interim band (owner decision 2026-10-31, spec §4.6): first attempts failing at ≥ 40 % of gates; round 5b restores 80 %.
    expect(failedFirst.length / attempted.length, summary).toBeGreaterThanOrEqual(0.4);
    expect(median(holds), summary).toBeGreaterThanOrEqual(0.3);
    expect(median(holds), summary).toBeLessThanOrEqual(0.8);
  }, RUN_TIMEOUT);

  it('is deterministic for a seed', () => {
    expect(runReference({ seed: SEEDS[0], days: DAYS })).toEqual(reportOf(SEEDS[0]));
  }, RUN_TIMEOUT);
});

describe('the raw-power reference run', () => {
  it('is never locked out of a gate, but holds at least 1.5× as long at them', () => {
    const aware = reportOf(SEEDS[0]);
    const raw = runReference({ seed: SEEDS[0], days: DAYS, policy: 'rawPower' });
    const summary = JSON.stringify({
      aware: aware.gates.map((g) => [g.tier, g.attempts, g.clearedDay >= 0 ? +hold(g).toFixed(2) : -1]),
      raw: raw.gates.map((g) => [g.tier, g.attempts, g.clearedDay >= 0 ? +hold(g).toFixed(2) : -1]),
      rawCap: raw.capDay,
    });
    // no hard lock: it reaches the cap, and every gate it reached before then is cleared by the end of its run
    expect(raw.capDay, summary).toBeGreaterThan(0);
    for (const g of raw.gates.filter((r) => r.reachedDay <= raw.capDay)) {
      expect(g.clearedDay, `gate ${g.tier}: ${summary}`).toBeGreaterThanOrEqual(0);
    }
    // the tilt, over the gates both runs cleared
    const both = aware.gates.filter((a) => a.clearedDay >= 0 && raw.gates.some((r) => r.tier === a.tier && r.clearedDay >= 0));
    const rawHold = both.reduce((n, a) => n + hold(raw.gates.find((r) => r.tier === a.tier) ?? a), 0);
    const awareHold = both.reduce((n, a) => n + hold(a), 0);
    expect(both.length, summary).toBeGreaterThan(0);
    expect(rawHold, summary).toBeGreaterThanOrEqual(1.5 * awareHold);
  }, RUN_TIMEOUT);
});
