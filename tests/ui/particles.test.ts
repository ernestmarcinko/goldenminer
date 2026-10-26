import { expect, it } from 'vitest';
import { eventsForMotion, feedbackToEvents, particlesFromEvents, pruneParticles, shaftFaceOrigin } from '../../src/ui/mine/particles';
import type { Feedback } from '../../src/store/gameStore';
import type { TickEvent } from '../../src/core/types';

let id = 0; const next = () => ++id;

it('a burst of ticks becomes a handful of particles', () => {
  const events: TickEvent[] = [
    ...Array.from({ length: 300 }, () => ({ kind: 'gold', amount: 3 }) as const),
    { kind: 'diamond', amount: 1 }, { kind: 'diamond', amount: 1 },
    ...Array.from({ length: 5 }, (_, i) => ({ kind: 'find', find: { id: i + 1, depth: i, kind: 'chest', amount: 0, tick: i } }) as const),
  ];
  const ps = particlesFromEvents(events, { x: 100, y: 200 }, 0, next);
  expect(ps.find((p) => p.kind === 'gold')).toMatchObject({ text: '+900', x: 100, y: 200 });
  expect(ps.find((p) => p.kind === 'diamond')).toMatchObject({ text: '+2', x: 126, y: 214 });
  expect(ps.filter((p) => p.kind === 'chest')).toHaveLength(3);
  expect(ps).toHaveLength(5);
});

it('a material vein pops up as the material', () => {
  const events: TickEvent[] = [{ kind: 'find', find: { id: 1, depth: 4, kind: 'materialVein', material: 'tin', amount: 3, tick: 1 } }];
  expect(particlesFromEvents(events, { x: 100, y: 200 }, 0, next)).toMatchObject([{ kind: 'materialVein', text: 'Tin ore!' }]);
});

it('old particles expire and the count stays bounded', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ id: i, kind: 'gold' as const, text: '+1', x: 0, y: 0, bornAt: i * 10 }));
  const kept = pruneParticles(many, 1500);
  expect(kept.every((p) => 1500 - p.bornAt <= 1300)).toBe(true);
  expect(pruneParticles(many, 500)).toHaveLength(30);
});

it('find particles stack above the gold number', () => {
  const events: TickEvent[] = Array.from({ length: 3 }, (_, i) => ({ kind: 'find', find: { id: i + 1, depth: i, kind: 'chest', amount: 0, tick: i } }) as const);
  const ps = particlesFromEvents(events, { x: 100, y: 200 }, 0, next);
  expect(ps.map((p) => [p.x, p.y])).toEqual([[90, 176], [90, 152], [90, 128]]);
});

it('floats off drops gold and diamonds, pops off drops finds', () => {
  const events: TickEvent[] = [
    { kind: 'gold', amount: 3 }, { kind: 'diamond', amount: 1 },
    { kind: 'find', find: { id: 1, depth: 4, kind: 'gem', amount: 0, tick: 1 } },
  ];
  expect(eventsForMotion(events, { floats: true, pops: true })).toHaveLength(3);
  expect(eventsForMotion(events, { floats: false, pops: true }).map((e) => e.kind)).toEqual(['find']);
  expect(eventsForMotion(events, { floats: true, pops: false }).map((e) => e.kind)).toEqual(['gold', 'diamond']);
  expect(eventsForMotion(events, { floats: false, pops: false })).toEqual([]);
});

it('the dig face is the middle of the shaft cell one row below the miner', () => {
  expect(shaftFaceOrigin(536)).toEqual({ x: 268, y: 308 });
});

it('feedbackToEvents expands digs into one dig event each', () => {
  const fb: Feedback = { gold: 0, diamonds: 0, finds: [], strikes: [], hurt: 0, digs: 3 };
  expect(feedbackToEvents(fb)).toEqual([{ kind: 'dig' }, { kind: 'dig' }, { kind: 'dig' }]);
});

it('a dig event becomes a strike particle at the origin, capped at 8', () => {
  const events: TickEvent[] = Array.from({ length: 12 }, () => ({ kind: 'dig' }) as const);
  const ps = particlesFromEvents(events, { x: 100, y: 200 }, 0, next);
  const digs = ps.filter((p) => p.kind === 'dig');
  expect(digs).toHaveLength(8);
  expect(digs[0]).toMatchObject({ kind: 'dig', text: '', x: 100, y: 200, bornAt: 0 });
  expect(digs.every((p) => p.x === 100 && p.y === 200)).toBe(true);
});

it('a dig strike expires on its short life while other particles keep theirs', () => {
  const strikes = Array.from({ length: 10 }, (_, i) => ({ id: i, kind: 'dig' as const, text: '', x: 0, y: 0, bornAt: i * 10 }));
  const kept = pruneParticles(strikes, 300);
  expect(kept.every((p) => 300 - p.bornAt <= 260)).toBe(true);
  expect(kept).toHaveLength(strikes.filter((p) => 300 - p.bornAt <= 260).length);
});

it('floats off drops dig events, independent of pops', () => {
  const events: TickEvent[] = [{ kind: 'dig' }];
  expect(eventsForMotion(events, { floats: true, pops: false }).map((e) => e.kind)).toEqual(['dig']);
  expect(eventsForMotion(events, { floats: false, pops: true })).toEqual([]);
});
