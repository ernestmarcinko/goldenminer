import { afterEach, expect, it, vi } from 'vitest';
import { runReference } from '../../src/core/sim';

// Test seams, both off by default: gate monsters made `gateMult` times stronger, and the miner's battle stats frozen
// from the first time they are read at `freezeAtLevel` or above, so a gate can be one the miner's score never outgrows.
const knobs = vi.hoisted(() => ({ gateMult: 1, freezeAtLevel: Infinity, frozen: undefined as unknown }));

vi.mock('../../src/core/monsters', async (importActual) => {
  const actual = await importActual<typeof import('../../src/core/monsters')>();
  return {
    ...actual,
    monsterState: (...args: Parameters<typeof actual.monsterState>) => {
      const m = actual.monsterState(...args);
      if (args[3] === undefined || knobs.gateMult === 1) return m;
      const k = knobs.gateMult;
      return { ...m, life: m.life * k, maxLife: m.maxLife * k, damage: m.damage * k };
    },
  };
});
vi.mock('../../src/core/battle', async (importActual) => {
  const actual = await importActual<typeof import('../../src/core/battle')>();
  type Stats = ReturnType<typeof actual.deriveBattleStats>;
  return {
    ...actual,
    deriveBattleStats: (...args: Parameters<typeof actual.deriveBattleStats>): Stats => {
      if (args[0].level < knobs.freezeAtLevel) return actual.deriveBattleStats(...args);
      knobs.frozen ??= actual.deriveBattleStats(...args);
      return knobs.frozen as Stats;
    },
  };
});

afterEach(() => {
  Object.assign(knobs, { gateMult: 1, freezeAtLevel: Infinity, frozen: undefined });
});

it('a hard gate is retried, farmed below, and cleared; its record runs reached → attempted → cleared', () => {
  // Plan 35's gate step makes the real gates hard enough; no seam needed.
  const report = runReference({ seed: 1, minutes: 2 * 1440 });
  const first = report.gates[0];
  expect(first?.tier).toBe(5);
  expect(first?.attempts).toBeGreaterThanOrEqual(2);
  const cleared = report.gates.filter((g) => g.clearedDay >= 0);
  expect(cleared.length).toBeGreaterThan(0);
  for (const g of cleared) {
    expect(g.attempts).toBeGreaterThanOrEqual(1);
    expect(g.reachedDay).toBeGreaterThanOrEqual(0);
    expect(g.reachedDay).toBeLessThanOrEqual(g.firstAttemptDay);
    expect(g.firstAttemptDay).toBeLessThanOrEqual(g.clearedDay);
  }
});

it('a raw-power miner whose score has plateaued still retries a gate once a day', () => {
  Object.assign(knobs, { gateMult: 1000, freezeAtLevel: 12 });
  const days = 5;
  const report = runReference({ seed: 1, minutes: days * 1440, policy: 'rawPower' });
  const gate = report.gates[0];
  expect(gate?.tier).toBe(5);
  expect(gate?.clearedDay).toBe(-1);
  // Reached on day 1 at the latest, then at least one attempt in each later day.
  expect(gate?.reachedDay ?? Infinity).toBeLessThan(1);
  expect(gate?.attempts).toBeGreaterThanOrEqual(days - 1);
});
