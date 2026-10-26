import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import {
  PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, canAllocate, canRefund, freeStashPages, pointsToSpend, stackCaps,
} from '../../src/core/passives';
import type { StatKey } from '../../src/core/items';

it('the web is ~200 nodes: one start, fourteen keystones, twenty-two notables and 165 smalls', () => {
  expect(PASSIVE_NODES.length).toBeGreaterThanOrEqual(200);
  const kinds = { start: 0, small: 0, notable: 0, keystone: 0 };
  for (const n of PASSIVE_NODES) kinds[n.kind] += 1;
  expect(kinds).toEqual({ start: 1, small: 165, notable: 22, keystone: 14 });
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

it('the whole web is connected from the start', () => {
  const seen = new Set<string>([START_NODE_ID]);
  const queue = [START_NODE_ID];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) continue;
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node === undefined) throw new Error(`unknown node ${id}`);
    for (const l of node.links) if (!seen.has(l)) { seen.add(l); queue.push(l); }
  }
  expect(seen.size).toBe(PASSIVE_NODES.length);
});

it('the web is a woven mesh, not a forest of spokes: cross-links add cycles', () => {
  const edges = new Set<string>();
  for (const n of PASSIVE_NODES) {
    for (const l of n.links) edges.add(n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`);
  }
  // A tree has exactly one edge per non-start node; a mesh has more (its cross-links close cycles).
  expect(edges.size).toBeGreaterThan(PASSIVE_NODES.length - 1);
  expect(PASSIVE_NODES.some((n) => n.links.length >= 3)).toBe(true);
});

it('no node sits further than a bounded distance from the start', () => {
  const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID);
  expect(start).toBeDefined();
  if (start === undefined) return;
  for (const n of PASSIVE_NODES) {
    const distance = Math.hypot(n.x - start.x, n.y - start.y);
    expect(distance, n.id).toBeLessThanOrEqual(500);
  }
});

// The order the SMALL_BUDGET tables were expanded before this plan: the builder numbers smalls from them, so these
// ids must keep meaning the same stat forever. This is the old save's load guarantee.
const OLD_SMALL_BUDGET: Record<'mining' | 'battle' | 'hybrid', ReadonlyArray<readonly [StatKey, number, number]>> = {
  mining: [
    ['digPower', 4, 8], ['digPowerPct', 6, 4], ['goldYield', 6, 4], ['diamondYield', 6, 4],
    ['veinYield', 4, 4], ['chestFind', 5, 4], ['gemFind', 5, 3], ['mapFind', 5, 3], ['oreFind', 5, 3],
    ['lampSight', 1, 2], ['autoTickRate', 4, 3], ['ticksPerClick', 0.5, 2], ['offlineCap', 30, 2], ['hazardWard', 8, 2],
  ],
  battle: [
    ['damage', 4, 6], ['damagePct', 6, 3], ['attackSpeed', 4, 3], ['critChance', 2, 4], ['critMultiplier', 6, 3],
    ['life', 20, 5], ['lifePct', 4, 3], ['armor', 20, 4], ['armorPct', 6, 3], ['resistAll', 4, 3],
    ['elementalDamage', 4, 2], ['lifeRegen', 1, 2], ['lifeOnKill', 3, 1], ['soulFind', 5, 3], ['magicFind', 5, 2], ['xpFind', 5, 1],
  ],
  hybrid: [
    ['digPower', 3, 3], ['damage', 3, 3], ['life', 10, 4], ['goldYield', 4, 3], ['soulFind', 3, 3], ['magicFind', 3, 3],
  ],
};

it('every pre-existing small id keeps its stat, so old saves load with no migration', () => {
  const expand = (rows: ReadonlyArray<readonly [StatKey, number, number]>): ReadonlyArray<readonly [StatKey, number]> =>
    rows.flatMap(([stat, value, count]) => Array.from({ length: count }, () => [stat, value] as const));
  for (const side of ['mining', 'battle', 'hybrid'] as const) {
    const expected = expand(OLD_SMALL_BUDGET[side]);
    for (let i = 0; i < expected.length; i++) {
      const id = `${side}Small${i + 1}`;
      const node = PASSIVE_NODE_BY_ID.get(id);
      expect(node, id).toBeDefined();
      if (node === undefined) continue;
      expect(node.kind, id).toBe('small');
      const effect = node.effects[0];
      expect(effect?.kind, id).toBe('stat');
      if (effect?.kind === 'stat') expect([effect.stat, effect.value], id).toEqual(expected[i]);
    }
  }
});

it('the new smalls append after the old ones with fresh ids', () => {
  expect(PASSIVE_NODE_BY_ID.get('miningSmall49')).toBeDefined();
  expect(PASSIVE_NODE_BY_ID.get('battleSmall49')).toBeDefined();
  expect(PASSIVE_NODE_BY_ID.get('hybridSmall20')).toBeDefined();
});

it('the keystones grew to fourteen, and the old eight keep their ids', () => {
  const keystones = PASSIVE_NODES.filter((n) => n.kind === 'keystone').map((n) => n.id);
  expect(keystones).toHaveLength(14);
  for (const id of ['earthshaker', 'cartographer', 'prospectorsLuck', 'berserker', 'soulReaper', 'bulwark', 'deepPockets', 'twoWayStreet']) {
    expect(keystones, id).toContain(id);
  }
});

it('points are level minus one, minus what is spent; level 100 gives 99', () => {
  const s = newGame(1, 0);
  expect(pointsToSpend(s)).toBe(0);
  s.level = 20;
  s.passives.allocated = [PASSIVE_NODE_BY_ID.get(START_NODE_ID)!.links[0]!, 'x'];
  expect(pointsToSpend(s)).toBe(17);
  s.level = 100;
  s.passives.allocated = [];
  expect(pointsToSpend(s)).toBe(99);
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
