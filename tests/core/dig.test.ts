import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { applyTicks, moveTo } from '../../src/core/dig';
import type { TickEvent } from '../../src/core/types';
import { FINDS_LOG_LIMIT } from '../../src/core/balance';

const fresh = () => newGame(1, 0);
const stats = deriveStats(fresh());

it('one tick at the surface pays 1 Gold and digs a fraction of a metre', () => {
  const s = fresh();
  applyTicks(s, 1, stats);
  expect(s.gold).toBe(1);
  expect(s.progress).toBeCloseTo(10 / (10.13 * 25), 6);
});

it('the first map is found within 60 ticks', () => {
  const s = fresh();
  let ticks = 0;
  while (!s.finds.some((f) => f.kind === 'map') && ticks < 60) { applyTicks(s, 1, stats); ticks++; }
  expect(s.finds.find((f) => f.kind === 'map')).toMatchObject({ depth: 2 });
});

it('finishing a face metre consumes its roll and reveals the next', () => {
  const s = fresh();
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.ahead[1]).toBeUndefined();
  expect(Object.keys(s.ahead).map(Number).sort()).toEqual([2, 3]);
});

it('veins pay out and are logged', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, stats, events);
  expect(s.finds[0]).toMatchObject({ depth: 1, kind: 'goldVein', amount: 19 });
  expect(s.gold).toBe(19 + s.tickCount * 1);
  expect(events.filter((e) => e.kind === 'gold')).toHaveLength(s.tickCount);
  expect(events.some((e) => e.kind === 'metre' && e.depth === 1 && !e.gallery)).toBe(true);
});

it('hard rock takes 1.5× as long', () => {
  const ticksFor = (hard: boolean) => {
    const s = fresh();
    s.ahead[1] = { feature: null, amount: 0, hardRock: hard };
    let t = 0; while (s.deepest < 1) { applyTicks(s, 1, stats); t++; } return t;
  };
  expect(ticksFor(true) / ticksFor(false)).toBeGreaterThan(1.4);
  expect(ticksFor(true) / ticksFor(false)).toBeLessThan(1.6);
});

it('galleries dig without going deeper, and the face keeps its progress', () => {
  const s = fresh();
  while (s.deepest < 20) applyTicks(s, 1, stats);
  applyTicks(s, 3, stats);
  const faceProgress = s.progress;
  expect(moveTo(s, 5)).toBe(true);
  const before = s.finds.length;
  const events: TickEvent[] = [];
  applyTicks(s, 400, stats, events);
  expect(s.deepest).toBe(20);
  expect(s.depth).toBe(5);
  // 400 ticks × 10 / (hardness(6) = 10.78 × 25) = 14.84 → 14 gallery metres
  expect(events.filter((e) => e.kind === 'metre' && e.gallery)).toHaveLength(14);
  expect(s.finds.slice(before).every((f) => f.depth === 5)).toBe(true);
  expect(moveTo(s, 20)).toBe(true);
  expect(s.progress).toBe(faceProgress);
});

it('moveTo rejects depths that were never reached', () => {
  const s = fresh();
  while (s.deepest < 20) applyTicks(s, 1, stats);
  for (const bad of [21, -1, 3.5, Number.NaN]) expect(moveTo(s, bad)).toBe(false);
  expect(s.depth).toBe(20);
});

it('the finds log is capped', () => {
  const s = fresh();
  s.finds = Array.from({ length: FINDS_LOG_LIMIT }, (_, i) => ({ depth: 0, kind: 'chest' as const, amount: 0, tick: i }));
  s.ahead[1] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.finds).toHaveLength(FINDS_LOG_LIMIT);
  expect(s.finds.at(-1)).toMatchObject({ kind: 'gem', depth: 1 });
});
