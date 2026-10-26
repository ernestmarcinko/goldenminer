import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import {
  PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, canAllocate, canRefund, freeStashPages, pointsToSpend, stackCaps,
} from '../../src/core/passives';

it('the web is 141 nodes with one start, eight keystones and seventeen notables', () => {
  expect(PASSIVE_NODES).toHaveLength(141);
  const kinds = { start: 0, small: 0, notable: 0, keystone: 0 };
  for (const n of PASSIVE_NODES) kinds[n.kind] += 1;
  expect(kinds).toEqual({ start: 1, small: 115, notable: 17, keystone: 8 });
  expect(PASSIVE_NODES.filter((n) => n.side === 'mining').length).toBeGreaterThan(PASSIVE_NODES.filter((n) => n.side === 'hybrid').length);
});

it('Surveyor is a hybrid notable that unlocks auto-mapping', () => {
  expect(PASSIVE_NODE_BY_ID.get('surveyor')).toMatchObject({
    kind: 'notable', side: 'hybrid', effects: [{ kind: 'autoMap' }],
  });
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

it('the web is a tree, not a mesh: 140 edges for 141 nodes, rooted at the start', () => {
  const edges = new Set<string>();
  for (const n of PASSIVE_NODES) {
    for (const l of n.links) edges.add(n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`);
  }
  expect(edges.size).toBe(PASSIVE_NODES.length - 1);
});

it('linked nodes are at least one ring apart, so the web reads as spokes and branches', () => {
  for (const n of PASSIVE_NODES) {
    for (const l of n.links) {
      const m = PASSIVE_NODE_BY_ID.get(l);
      if (m === undefined) continue;
      const distance = Math.hypot(n.x - m.x, n.y - m.y);
      expect(distance, `${n.id} -> ${l}`).toBeGreaterThanOrEqual(70);
    }
  }
});

it('points are level minus one, minus what is spent', () => {
  const s = newGame(1, 0);
  expect(pointsToSpend(s)).toBe(0);
  s.level = 20;
  s.passives.allocated = [PASSIVE_NODE_BY_ID.get(START_NODE_ID)!.links[0]!, 'x'];
  expect(pointsToSpend(s)).toBe(17);
});

it('ascendancy passive points add to the spendable points', () => {
  const s = newGame(1, 0);
  const node = ASCENDANCY_NODES.find((n) => n.effects.some((e) => e.kind === 'passivePoints'));
  if (node === undefined) throw new Error('no passive-point ascendancy node');
  s.ascendancy.allocated = [node.id];   // the bonus comes from the allocated node, not the unspent points
  expect(pointsToSpend(s)).toBe(1);
  s.level = 5;
  expect(pointsToSpend(s)).toBe(5);
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

it('Gem Pouch and Ore Cart raise the bag stack caps, Deep Pockets the free pages', () => {
  const s = newGame(1, 0);
  expect(stackCaps(s)).toEqual({ gem: 25, material: 50 });
  expect(freeStashPages(s)).toBe(0);
  s.passives.allocated = ['gemPouch', 'oreCart', 'deepPockets'];
  expect(stackCaps(s)).toEqual({ gem: 35, material: 75 });
  expect(freeStashPages(s)).toBe(2);
});
