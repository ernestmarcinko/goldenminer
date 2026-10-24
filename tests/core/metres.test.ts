import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { fillAhead, rollMetre } from '../../src/core/metres';

const stats = deriveStats(newGame(1, 0));

it('base stats', () => {
  expect(stats).toMatchObject({ digPower: 10, autoTicksPerSecond: 1, ticksPerClick: 1, lampSight: 2, offlineCapMs: 28_800_000 });
});

it('a metre roll is a pure function of seed and metre', () => {
  expect(rollMetre(42, 340, stats)).toEqual(rollMetre(42, 340, stats));
});

it('feature frequencies follow the base chances', () => {
  const n = 20_000;
  const count = { chest: 0, map: 0, none: 0, hard: 0 };
  for (let m = 1; m <= n; m++) {
    const r = rollMetre(7, m, stats);
    if (r.feature === 'chest') count.chest++;
    if (r.feature === 'map') count.map++;
    if (r.feature === null) count.none++;
    if (r.hardRock) count.hard++;
  }
  expect(count.chest / n).toBeGreaterThan(0.05); expect(count.chest / n).toBeLessThan(0.07);
  expect(count.map / n).toBeGreaterThan(0.03); expect(count.map / n).toBeLessThan(0.05);
  expect(count.none / n).toBeGreaterThan(0.70); expect(count.none / n).toBeLessThan(0.74);
  expect(count.hard / n).toBeGreaterThan(0.07); expect(count.hard / n).toBeLessThan(0.09);
});

it('vein amounts scale with tier', () => {
  for (let m = 301; m < 450; m++) {
    const r = rollMetre(3, m, stats);
    if (r.feature === 'goldVein') { expect(r.amount).toBeGreaterThanOrEqual(19); expect(r.amount).toBeLessThanOrEqual(29); }
    if (r.feature === 'diamondVein') expect(r.amount).toBe(3);
  }
});

describe('newGame', () => {
  it('starts at the surface with a guaranteed map at metre 2', () => {
    const s = newGame(1, 1000);
    expect(s).toMatchObject({ depth: 0, deepest: 0, gold: 0, diamonds: 0, lastTickAt: 1000, finds: [] });
    expect(Object.keys(s.ahead).map(Number).sort()).toEqual([1, 2]);
    expect(s.ahead[2]).toEqual({ feature: 'map', amount: 0, hardRock: false });
    expect(s.ahead[1]?.hardRock).toBe(false);
  });
});

it('fillAhead adds missing metres and never re-rolls', () => {
  const s = newGame(1, 0);
  s.deepest = 10; s.depth = 10; s.ahead = { 11: { feature: 'chest', amount: 0, hardRock: true } };
  fillAhead(s, stats);
  expect(s.ahead[11]).toEqual({ feature: 'chest', amount: 0, hardRock: true });
  expect(s.ahead[12]).toBeDefined();
  expect(s.ahead[13]).toBeUndefined();
});
