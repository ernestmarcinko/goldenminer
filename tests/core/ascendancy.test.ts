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

it('every node carries its cluster group, and every small a variation 1–8', () => {
  const start = node(ASCENDANCY_START_ID);
  expect(start.group).toBeUndefined();
  expect(start.variation).toBeUndefined();
  const groups = ['wealth', 'depth', 'insight', 'cartography', 'endurance', 'fortuna', 'might', 'greed'];
  for (const group of groups) {
    const smalls = ASCENDANCY_NODES.filter((n) => n.kind === 'small' && n.group === group);
    expect(smalls, group).toHaveLength(8);
    expect(smalls.map((n) => n.variation).sort((a, b) => (a ?? 0) - (b ?? 0)), group).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const named = ASCENDANCY_NODES.filter((n) => (n.kind === 'mid' || n.kind === 'big') && n.group === group);
    expect(named, group).toHaveLength(2);
    expect(named.every((n) => n.variation === undefined), group).toBe(true);
  }
});

it('every node\'s cost follows its kind and every big carries a large bonus', () => {
  for (const n of ASCENDANCY_NODES) {
    const cost = n.kind === 'start' ? 0 : n.kind === 'small' ? 1 : n.kind === 'mid' ? 6 : 12;
    expect(n.cost, n.id).toBe(cost);
  }
  const bigStartingDepth = ASCENDANCY_NODES.find((n) => n.kind === 'big'
    && n.effects.some((e) => e.kind === 'startingDepth'));
  expect(bigStartingDepth).toBeDefined();
  expect(bigStartingDepth?.effects.some((e) => e.kind === 'startingDepth' && e.value === 250)).toBe(true);
  const bigPassive = ASCENDANCY_NODES.find((n) => n.kind === 'big'
    && n.effects.some((e) => e.kind === 'passivePoints'));
  expect(bigPassive?.effects.some((e) => e.kind === 'passivePoints' && e.value === 3)).toBe(true);
  const cartographySmalls = ASCENDANCY_NODES.filter((n) => n.kind === 'small' && n.id.startsWith('cartographySmall'));
  expect(cartographySmalls.length).toBeGreaterThan(0);
  for (const small of cartographySmalls) {
    expect(small.name, small.id).toBe('Auto-map Queue');
    expect(small.effects, small.id).toEqual([{ kind: 'autoMapQueue', value: 10 }]);
  }
  expect(node('masterSurveyor').effects).toEqual([{ kind: 'autoMapQueue', value: 20 }]);
  expect(node('worldAtlas').effects).toEqual([{ kind: 'autoMapQueue', value: 50 }]);
});

it('the original node ids survive: smalls still cost 1, the old notables are 6-point mids', () => {
  for (const id of ['wealthSmall1', 'depthSmall1', 'insightSmall1', 'cartographySmall1', 'enduranceSmall1',
    'fortunaSmall1', 'midasTouch', 'deepRoots', 'secondSight', 'masterSurveyor', 'tireless', 'luckyBreak']) {
    expect(ASCENDANCY_NODE_BY_ID.get(id), id).toBeDefined();
  }
  expect(node('wealthSmall1').cost).toBe(1);
  expect(node('insightSmall1').cost).toBe(1);
  expect(node('masterSurveyor').cost).toBe(6);
  expect(node('luckyBreak').cost).toBe(6);
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

it('every mid sits mid-branch: four smalls before it, four after it, and the big is the tip', () => {
  const dist = (n: { x: number; y: number }): number => Math.hypot(n.x - start.x, n.y - start.y);
  const prefixes = [...new Set(ASCENDANCY_NODES.filter((n) => n.kind === 'small')
    .map((n) => n.id.replace(/Small\d+$/, '')))];
  expect(prefixes).toHaveLength(8);
  for (const prefix of prefixes) {
    const smalls = ASCENDANCY_NODES.filter((n) => n.id.startsWith(`${prefix}Small`));
    const mid = ASCENDANCY_NODES.find((n) => n.kind === 'mid' && n.links.some((l) => l.startsWith(`${prefix}Small`)));
    const big = ASCENDANCY_NODES.find((n) => n.kind === 'big' && n.links.some((l) => l.startsWith(`${prefix}Small`)));
    if (mid === undefined || big === undefined) throw new Error(`cluster ${prefix} has no mid/big`);
    expect(smalls, prefix).toHaveLength(8);
    const midDist = dist(mid);
    // The mid is strictly between the leading and trailing smalls — in the branch, not at its tip.
    expect(smalls.filter((s) => dist(s) < midDist), prefix).toHaveLength(4);
    expect(smalls.filter((s) => dist(s) > midDist), prefix).toHaveLength(4);
    // The big is the terminal keystone, farther out than every small.
    expect(smalls.every((s) => dist(s) < dist(big)), prefix).toBe(true);
  }
});

it('clearing the whole tree costs 208 points: 8 × (8 smalls + 6 + 12)', () => {
  expect(ASCENDANCY_NODES.reduce((sum, n) => sum + n.cost, 0)).toBe(208);
});

it('an old save\'s chain (start → smalls → mid → big) stays one connected set under the new links', () => {
  // A pre-change save could hold the whole spine of a branch; the reordered links must still connect all of it.
  const set = new Set([
    'wealthSmall1', 'wealthSmall2', 'wealthSmall3', 'wealthSmall4', 'wealthSmall5',
    'wealthSmall6', 'wealthSmall7', 'wealthSmall8', 'midasTouch', 'goldRush',
  ]);
  const reached = new Set([ASCENDANCY_START_ID]);
  const queue = [ASCENDANCY_START_ID];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) break;
    for (const l of node(id).links) {
      if (!set.has(l) || reached.has(l)) continue;
      reached.add(l);
      queue.push(l);
    }
  }
  for (const id of set) expect(reached.has(id), id).toBe(true);
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

it('a mid node costs 6 points and a big node costs 12', () => {
  const mid = ASCENDANCY_NODES.find((n) => n.kind === 'mid');
  const big = ASCENDANCY_NODES.find((n) => n.kind === 'big');
  if (mid === undefined || big === undefined) throw new Error('no mid/big ascendancy node');
  const midParent = mid.links[0];
  const bigParent = big.links[0];
  if (midParent === undefined || bigParent === undefined) throw new Error('mid/big has no link');

  const s = newGame(1, 0);
  s.ascendancy.allocated = [midParent];
  s.ascendancy.points = 5;
  expect(allocateAscendancy(s, mid.id)).toBe('noPoints');   // 5 < 6
  expect(s.ascendancy.allocated).toEqual([midParent]);
  expect(s.ascendancy.points).toBe(5);
  s.ascendancy.points = 6;
  expect(canAllocateAscendancy(s, mid.id)).toBe(true);
  expect(allocateAscendancy(s, mid.id)).toBe('ok');
  expect(s.ascendancy.points).toBe(0);
  expect(s.ascendancy.allocated).toEqual([midParent, mid.id]);

  const t = newGame(1, 0);
  t.ascendancy.allocated = [bigParent];
  t.ascendancy.points = 11;
  expect(allocateAscendancy(t, big.id)).toBe('noPoints');   // 11 < 12
  expect(t.ascendancy.allocated).toEqual([bigParent]);
  t.ascendancy.points = 12;
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
  const queue = ASCENDANCY_NODES.find((n) => n.effects.some((e) => e.kind === 'autoMapQueue'));
  if (gold === undefined || passive === undefined || depth === undefined || queue === undefined) {
    throw new Error('the ascendancy tree is missing an effect kind');
  }
  const s = newGame(1, 0);
  expect(ascendancyTotals(s)).toEqual({ stats: {}, startingDepth: 0, passivePoints: 0, autoMapQueue: 0 });
  s.ascendancy.allocated = [gold.id];
  expect(ascendancyTotals(s).stats.goldYield).toBe(10);
  s.ascendancy.allocated = [passive.id];
  expect(ascendancyTotals(s).passivePoints).toBe(1);
  s.ascendancy.allocated = [depth.id];
  expect(ascendancyTotals(s).startingDepth).toBe(25);
  s.ascendancy.allocated = [queue.id];
  expect(ascendancyTotals(s).autoMapQueue).toBeGreaterThan(0);
  s.ascendancy.allocated = ['notANode'];
  expect(ascendancyTotals(s)).toEqual({ stats: {}, startingDepth: 0, passivePoints: 0, autoMapQueue: 0 });
});
