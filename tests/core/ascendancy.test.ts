import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import {
  ASCENDANCY_NODES, ASCENDANCY_NODE_BY_ID, ASCENDANCY_START_ID, MAX_ASCENDANCY_PASSIVE_POINTS,
  allocateAscendancy, ascendancyPoints, ascendancyTotals, canAllocateAscendancy,
} from '../../src/core/ascendancy';

const start = ASCENDANCY_NODE_BY_ID.get(ASCENDANCY_START_ID);
if (start === undefined) throw new Error('the ascendancy tree has no start');
const ring1 = start.links[0];
if (ring1 === undefined) throw new Error('the ascendancy start has no links');

const node = (id: string) => {
  const n = ASCENDANCY_NODE_BY_ID.get(id);
  if (n === undefined) throw new Error(`missing ascendancy node ${id}`);
  return n;
};

it('the tree is 81 nodes: one start, 64 smalls, eight mids and eight bigs', () => {
  expect(ASCENDANCY_NODES).toHaveLength(81);
  const kinds = { start: 0, small: 0, mid: 0, big: 0 };
  for (const n of ASCENDANCY_NODES) kinds[n.kind] += 1;
  expect(kinds).toEqual({ start: 1, small: 64, mid: 8, big: 8 });
  expect(MAX_ASCENDANCY_PASSIVE_POINTS).toBe(12);
});

it('every node\'s cost follows its kind and every big carries a large bonus', () => {
  for (const n of ASCENDANCY_NODES) {
    const cost = n.kind === 'start' ? 0 : n.kind === 'small' ? 1 : n.kind === 'mid' ? 2 : 4;
    expect(n.cost, n.id).toBe(cost);
  }
  const bigStartingDepth = ASCENDANCY_NODES.find((n) => n.kind === 'big'
    && n.effects.some((e) => e.kind === 'startingDepth'));
  expect(bigStartingDepth).toBeDefined();
  expect(bigStartingDepth?.effects.some((e) => e.kind === 'startingDepth' && e.value === 250)).toBe(true);
  const bigPassive = ASCENDANCY_NODES.find((n) => n.kind === 'big'
    && n.effects.some((e) => e.kind === 'passivePoints'));
  expect(bigPassive?.effects.some((e) => e.kind === 'passivePoints' && e.value === 3)).toBe(true);
  const bigTier = ASCENDANCY_NODES.find((n) => n.kind === 'big'
    && n.effects.some((e) => e.kind === 'autoMapTier'));
  expect(bigTier?.effects.some((e) => e.kind === 'autoMapTier' && e.value === 4)).toBe(true);
});

it('the original node ids survive: smalls still cost 1, the old notables are 2-point mids', () => {
  for (const id of ['wealthSmall1', 'depthSmall1', 'insightSmall1', 'cartographySmall1', 'enduranceSmall1',
    'fortunaSmall1', 'midasTouch', 'deepRoots', 'secondSight', 'masterSurveyor', 'tireless', 'luckyBreak']) {
    expect(ASCENDANCY_NODE_BY_ID.get(id), id).toBeDefined();
  }
  expect(node('wealthSmall1').cost).toBe(1);
  expect(node('insightSmall1').cost).toBe(1);
  expect(node('masterSurveyor').cost).toBe(2);
  expect(node('luckyBreak').cost).toBe(2);
});

it('links are symmetric, ids unique, and the start never links to itself', () => {
  const ids = new Set(ASCENDANCY_NODES.map((n) => n.id));
  expect(ids.size).toBe(ASCENDANCY_NODES.length);
  for (const n of ASCENDANCY_NODES) {
    for (const l of n.links) {
      expect(ids.has(l), `${n.id} -> ${l}`).toBe(true);
      expect(node(l).links.includes(n.id), `${l} -> ${n.id}`).toBe(true);
    }
  }
  expect(start.links.includes(ASCENDANCY_START_ID)).toBe(false);
});

it('points come from the deepest depth as a square root', () => {
  expect(ascendancyPoints(0, 60, 0)).toBe(0);
  expect(ascendancyPoints(249, 60, 0)).toBe(0);
  expect(ascendancyPoints(250, 60, 0)).toBe(1);
  expect(ascendancyPoints(1000, 60, 0)).toBe(2);
  expect(ascendancyPoints(2250, 60, 0)).toBe(3);
  expect(ascendancyPoints(-1, 60, 0)).toBe(0);
  expect(ascendancyPoints(Number.NaN, 60, 0)).toBe(0);
  expect(ascendancyPoints(Number.POSITIVE_INFINITY, 60, 0)).toBe(0);
});

it('the level bonus only applies from the second ascension on', () => {
  // The first ascension has no level bonus, whatever the level.
  expect(ascendancyPoints(1000, 60, 0)).toBe(2);
  expect(ascendancyPoints(1000, 100, 0)).toBe(2);
  // From the second ascension, every 10 levels past 60 add a point.
  expect(ascendancyPoints(1000, 60, 1)).toBe(2);
  expect(ascendancyPoints(1000, 70, 1)).toBe(3);
  expect(ascendancyPoints(1000, 99, 1)).toBe(5);
  expect(ascendancyPoints(1000, 100, 1)).toBe(6);
});

it('allocation spends a point, follows adjacency, and never refunds', () => {
  const s = newGame(1, 0);
  const far = ASCENDANCY_NODES.find((n) => n.kind !== 'start' && !start.links.includes(n.id));
  if (far === undefined) throw new Error('no far ascendancy node');
  // With no points, even a first-ring small is unaffordable.
  expect(canAllocateAscendancy(s, ring1)).toBe(false);
  expect(canAllocateAscendancy(s, far.id)).toBe(false);
  expect(canAllocateAscendancy(s, ASCENDANCY_START_ID)).toBe(false);
  expect(canAllocateAscendancy(s, 'notANode')).toBe(false);

  expect(allocateAscendancy(s, far.id)).toBe('notAdjacent');
  expect(allocateAscendancy(s, ring1)).toBe('noPoints');
  expect(allocateAscendancy(s, 'notANode')).toBe('invalid');

  const rng = s.rng;
  s.ascendancy.points = 1;
  expect(allocateAscendancy(s, ring1)).toBe('ok');
  expect(s.ascendancy.points).toBe(0);
  expect(s.ascendancy.allocated).toEqual([ring1]);
  expect(s.rng).toBe(rng);

  // A second call is refused and never gives the point back: there is no refund.
  expect(allocateAscendancy(s, ring1)).toBe('allocated');
  const next = node(ring1).links.find((l) => l !== ASCENDANCY_START_ID);
  if (next === undefined) throw new Error('the first ring has no successor');
  expect(allocateAscendancy(s, next)).toBe('noPoints');
  expect(s.ascendancy.allocated).toEqual([ring1]);
  expect(s.ascendancy.points).toBe(0);
});

it('a mid node costs 2 points and a big node costs 4', () => {
  const mid = ASCENDANCY_NODES.find((n) => n.kind === 'mid');
  const big = ASCENDANCY_NODES.find((n) => n.kind === 'big');
  if (mid === undefined || big === undefined) throw new Error('no mid/big ascendancy node');
  const midParent = mid.links[0];
  const bigParent = big.links[0];
  if (midParent === undefined || bigParent === undefined) throw new Error('mid/big has no link');

  const s = newGame(1, 0);
  s.ascendancy.allocated = [midParent];
  s.ascendancy.points = 1;
  expect(allocateAscendancy(s, mid.id)).toBe('noPoints');   // 1 < 2
  expect(s.ascendancy.allocated).toEqual([midParent]);
  expect(s.ascendancy.points).toBe(1);
  s.ascendancy.points = 2;
  expect(canAllocateAscendancy(s, mid.id)).toBe(true);
  expect(allocateAscendancy(s, mid.id)).toBe('ok');
  expect(s.ascendancy.points).toBe(0);
  expect(s.ascendancy.allocated).toEqual([midParent, mid.id]);

  const t = newGame(1, 0);
  t.ascendancy.allocated = [bigParent];
  t.ascendancy.points = 3;
  expect(allocateAscendancy(t, big.id)).toBe('noPoints');   // 3 < 4
  expect(t.ascendancy.allocated).toEqual([bigParent]);
  t.ascendancy.points = 4;
  expect(allocateAscendancy(t, big.id)).toBe('ok');
  expect(t.ascendancy.points).toBe(0);
  expect(t.ascendancy.allocated).toEqual([bigParent, big.id]);
});

it('allocated nodes add their stats and structural bonuses to the totals', () => {
  const gold = ASCENDANCY_NODES.find((n) => n.kind === 'small' &&
    n.effects.some((e) => e.kind === 'stat' && e.stat === 'goldYield'));
  const passive = ASCENDANCY_NODES.find((n) => n.kind === 'small' &&
    n.effects.some((e) => e.kind === 'passivePoints'));
  const depth = ASCENDANCY_NODES.find((n) => n.effects.some((e) => e.kind === 'startingDepth'));
  const tier = ASCENDANCY_NODES.find((n) => n.effects.some((e) => e.kind === 'autoMapTier'));
  if (gold === undefined || passive === undefined || depth === undefined || tier === undefined) {
    throw new Error('the ascendancy tree is missing an effect kind');
  }
  const s = newGame(1, 0);
  expect(ascendancyTotals(s)).toEqual({ stats: {}, startingDepth: 0, passivePoints: 0, autoMapTier: 0 });
  s.ascendancy.allocated = [gold.id];
  expect(ascendancyTotals(s).stats.goldYield).toBe(10);
  s.ascendancy.allocated = [passive.id];
  expect(ascendancyTotals(s).passivePoints).toBe(1);
  s.ascendancy.allocated = [depth.id];
  expect(ascendancyTotals(s).startingDepth).toBe(25);
  s.ascendancy.allocated = [tier.id];
  expect(ascendancyTotals(s).autoMapTier).toBe(1);
  s.ascendancy.allocated = ['notANode'];
  expect(ascendancyTotals(s)).toEqual({ stats: {}, startingDepth: 0, passivePoints: 0, autoMapTier: 0 });
});
