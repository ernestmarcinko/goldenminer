import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { advance, ClickLimiter, clickTicks } from '../../src/core/clock';
import { summarize } from '../../src/core/summary';
import { applyTicks } from '../../src/core/dig';
import { addMap, startMap } from '../../src/core/maps';

const stats = deriveStats(newGame(1, 0));

it('applies whole elapsed seconds and keeps the remainder', () => {
  const s = newGame(1, 0);
  expect(advance(s, 2500, stats)).toBe(2);
  expect(s.lastTickAt).toBe(2000);
});

it('a clock that went backwards applies nothing and re-anchors', () => {
  const s = newGame(1, 10_000);
  expect(advance(s, 5000, stats)).toBe(0);
  expect(s.lastTickAt).toBe(5000);
  expect(s.tickCount).toBe(0);
});

it('a three-day gap is capped at 8 hours', () => {
  const s = newGame(1, 0);
  const now = 3 * 24 * 3_600_000;
  expect(advance(s, now, stats)).toBe(28_800);
  expect(s.lastTickAt).toBe(now);
});

it('an 8 hour catch-up stays fast', () => {
  const s = newGame(1, 0);
  const t0 = performance.now();
  advance(s, 8 * 3_600_000, stats);
  expect(performance.now() - t0).toBeLessThan(2000);
});

it('clicks beyond 10 per second are ignored', () => {
  const lim = new ClickLimiter();
  const accepted = Array.from({ length: 11 }, (_, i) => lim.tryClick(i)).filter(Boolean).length;
  expect(accepted).toBe(10);
  expect(lim.tryClick(1001)).toBe(true);
});

it('a click is one extra tick', () => {
  const s = newGame(1, 0);
  clickTicks(s, stats);
  expect(s.tickCount).toBe(1);
});

it('summarize reports what changed', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  advance(after, 600_000, stats);
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum).toMatchObject({ elapsedMs: 600_000, ticks: 600, gold: after.gold, metres: after.deepest, capMs: 28_800_000 });
  expect(sum.finds.map).toBeGreaterThanOrEqual(1);
  expect(Object.keys(sum.finds).sort()).toEqual(['chest', 'diamondVein', 'gem', 'goldVein', 'map', 'materialVein']);
});

it('a zero or non-finite tick rate applies nothing and keeps lastTickAt finite', () => {
  for (const rate of [0, NaN, Infinity, -1]) {
    const s = newGame(1, 0);
    expect(advance(s, 5000, { ...stats, autoTicksPerSecond: rate })).toBe(0);
    expect(s.lastTickAt).toBe(5000);
  }
});

it('paused dig ticks are dropped, not banked', () => {
  const s = newGame(1, 0);
  expect(advance(s, 60_000, stats, [], true)).toBe(60);
  expect([s.deepest, s.progress, s.tickCount, s.lastTickAt]).toEqual([0, 0, 60, 60_000]);
  expect(advance(s, 61_000, stats, [], false)).toBe(1);
  const oneTick = newGame(1, 0);
  applyTicks(oneTick, 1, stats);
  expect(oneTick.progress).toBeGreaterThan(0);
  expect(s.progress).toBe(oneTick.progress);
  expect(s.deepest).toBe(0);
});

it('a map run keeps fighting while digging is paused, and the ticks after it ends are not dug', () => {
  const s = newGame(1, 0);
  expect(startMap(s, addMap(s, 1, 2).id)).toBe('ok');
  const deepest = s.deepest;
  const progress = s.progress;
  expect(advance(s, 3_600_000, deriveStats(s), [], true)).toBe(3600);
  expect(s.activity.kind).toBe('dig');
  expect(s.lastRun).not.toBeNull();
  expect(s.deepest).toBe(deepest);
  expect(s.progress).toBe(progress);
});
