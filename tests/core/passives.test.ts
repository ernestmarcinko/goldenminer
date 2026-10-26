import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import {
  PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, canAllocate, canRefund, pointsToSpend,
} from '../../src/core/passives';

it('the web is 140 nodes with one start, eight keystones and sixteen notables', () => {
  expect(PASSIVE_NODES).toHaveLength(140);
  const kinds = { start: 0, small: 0, notable: 0, keystone: 0 };
  for (const n of PASSIVE_NODES) kinds[n.kind] += 1;
  expect(kinds).toEqual({ start: 1, small: 115, notable: 16, keystone: 8 });
  expect(PASSIVE_NODES.filter((n) => n.side === 'mining').length).toBeGreaterThan(PASSIVE_NODES.filter((n) => n.side === 'hybrid').length);
});

it('links are symmetric, ids unique, and the start never links to itself', () => {
  const ids = new Set(PASSIVE_NODES.map((n) => n.id));
  expect(ids.size).toBe(PASSIVE_NODES.length);
  for (const n of PASSIVE_NODES) {
    for (const l of n.links) {
      expect(ids.has(l), `${n.id} -> ${l}`).toBe(true);
      expect(PASSIVE_NODE_BY_ID.get(l)?.links.includes(n.id), `${l} -> ${n.id}`).toBe(true);
    }
  }
  expect(PASSIVE_NODE_BY_ID.get(START_NODE_ID)?.links.includes(START_NODE_ID)).toBe(false);
});

it('points are level minus one, minus what is spent', () => {
  const s = newGame(1, 0);
  expect(pointsToSpend(s)).toBe(0);
  s.level = 20;
  s.passives.allocated = [PASSIVE_NODE_BY_ID.get(START_NODE_ID)!.links[0]!, 'x'];
  expect(pointsToSpend(s)).toBe(17);
});

it('a node allocates only next to the start or an allocated node', () => {
  const s = newGame(1, 0);
  const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!;
  const ring = start.links[0]!;
  const far = PASSIVE_NODES.find((n) => n.id !== ring && !start.links.includes(n.id))!.id;
  expect(canAllocate(s, ring)).toBe(true);
  expect(canAllocate(s, far)).toBe(false);
  s.passives.allocated = [ring];
  const next = PASSIVE_NODE_BY_ID.get(ring)!.links.find((l) => l !== START_NODE_ID)!;
  expect(canAllocate(s, next)).toBe(true);
});

it('a node refunds only while every other node stays connected to the start', () => {
  const s = newGame(1, 0);
  const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!;
  const ring = start.links[0]!;
  const ring2 = PASSIVE_NODE_BY_ID.get(ring)!.links.find((l) => l !== START_NODE_ID)!;
  s.passives.allocated = [ring, ring2];
  expect(canRefund(s, ring2)).toBe(true);   // a leaf
  expect(canRefund(s, ring)).toBe(false);   // ring2 still depends on it
  expect(canRefund(s, 'nope')).toBe(false);
});
