import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { applyTicks } from '../../src/core/dig';
import { validateState } from '../../src/core/save';
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
  expect(Object.keys(s.ahead).map(Number).sort()).toEqual([2, 3, 4]);
});

it('veins pay out and are logged', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, stats, events);
  expect(s.finds[0]).toMatchObject({ depth: 1, kind: 'goldVein', amount: 19 });
  expect(s.gold).toBe(19 + s.tickCount * 1);
  expect(events.filter((e) => e.kind === 'gold')).toHaveLength(s.tickCount);
  expect(events).toContainEqual({ kind: 'metre', depth: 1 });
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

it('digging only works the face', () => {
  const s = fresh();
  applyTicks(s, 400, stats);
  expect(s.deepest).toBeGreaterThan(10);
  expect('depth' in s).toBe(false);
  expect(validateState(s)).toBe(true);
});

it('the finds log is capped', () => {
  const s = fresh();
  s.finds = Array.from({ length: FINDS_LOG_LIMIT }, (_, i) => ({ id: i + 1, depth: 0, kind: 'chest' as const, amount: 0, tick: i }));
  s.ahead[1] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.finds).toHaveLength(FINDS_LOG_LIMIT);
  expect(s.finds.at(-1)).toMatchObject({ kind: 'gem', depth: 1 });
});

it('an infinite or zero dig power neither hangs nor corrupts the state', () => {
  for (const digPower of [Infinity, NaN, 0]) {
    const s = fresh();
    applyTicks(s, 5, { ...stats, digPower });
    expect(s.deepest).toBe(0);
    expect(validateState(s)).toBe(true);
    applyTicks(s, 400, stats);
    applyTicks(s, 5, { ...stats, digPower });
    expect(validateState(s)).toBe(true);
  }
});

it('Gold yield pays whole Gold each tick', () => {
  const s = fresh();
  const events: TickEvent[] = [];
  applyTicks(s, 2, { ...stats, goldMultiplier: 2.5 }, events);
  expect(s.gold).toBe(4);
  expect(events.flatMap((e) => (e.kind === 'gold' ? [e.amount] : []))).toEqual([2, 2]);
});

it('veins pay their yield and log what was paid', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const rich = { ...stats, goldMultiplier: 1.5 };
  while (s.deepest < 1) applyTicks(s, 1, rich);
  expect(s.finds[0]).toMatchObject({ kind: 'goldVein', amount: 29 });
  expect(s.gold).toBe(s.tickCount + 29);
});

it('Diamond yield raises the chance per tick, up to the cap', () => {
  const s = fresh();
  const events: TickEvent[] = [];
  applyTicks(s, 2000, { ...stats, diamondMultiplier: 100 }, events);
  const share = events.filter((e) => e.kind === 'diamond').length / 2000;
  expect(share).toBeGreaterThan(0.45);
  expect(share).toBeLessThan(0.55);
});

it('leftover progress carries over at the next metre’s hardness', () => {
  const s = fresh();
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  s.ahead[2] = { feature: null, amount: 0, hardRock: true };
  applyTicks(s, 1, { ...stats, digPower: 1.5 * 10.13 * 25 }); // 1.5 metres of metre 1's work
  expect(s.deepest).toBe(1);
  expect(s.progress).toBeCloseTo((0.5 * 10.13) / (10.26 * 1.5), 6);
});
