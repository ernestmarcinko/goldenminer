import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { PASSIVE_NODE_BY_ID, START_NODE_ID } from '../../src/core/passives';
import { allocate } from '../../src/core/respec';
import { ascendancyVMs } from '../../src/ui/ascend/ascensionView';
import {
  nodeVMs, pointsLine, pruneStaged, refundAffordable, refundLine, refundTotalLine, resetLine, searchNodes,
} from '../../src/ui/skills/skillsView';

const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!;
const ring1 = start.links[0]!;
const ring2 = PASSIVE_NODE_BY_ID.get(ring1)!.links.find((l) => l !== START_NODE_ID)!;

it('the view model marks the start allocated and the first ring allocatable', () => {
  const s = newGame(1, 0);
  s.level = 3;
  const vms = nodeVMs(s);
  const start = vms.find((n) => n.id === 'miner')!;
  expect(start.allocated).toBe(true);
  expect(start.allocatable).toBe(false);
  const ring = vms.find((n) => n.allocatable);
  expect(ring).toBeTruthy();
});

it('nothing is allocatable without a point to spend', () => {
  const s = newGame(1, 0);            // level 1: no points
  expect(nodeVMs(s).some((n) => n.allocatable)).toBe(false);
  s.level = 2;                         // level 2: one point
  expect(nodeVMs(s).some((n) => n.allocatable)).toBe(true);
});

it('allocating a first-ring node opens the next ring', () => {
  const s = newGame(1, 0);
  s.level = 3;
  const ring = nodeVMs(s).find((n) => n.allocatable)!;
  expect(allocate(s, ring.id)).toBe('ok');
  const after = nodeVMs(s);
  expect(after.find((n) => n.id === ring.id)?.allocated).toBe(true);
  expect(after.some((n) => n.allocatable)).toBe(true);
});

it('staged nodes open the next ring before they are confirmed', () => {
  const s = newGame(1, 0);
  s.level = 3;   // two points
  const staged = nodeVMs(s, { staged: [ring1] });
  expect(staged.find((n) => n.id === ring1)?.staged).toBe(true);
  expect(staged.find((n) => n.id === ring1)?.allocated).toBe(false);
  expect(staged.find((n) => n.id === ring2)?.allocatable).toBe(true);
});

it('refund mode offers only nodes whose removal leaves the web connected', () => {
  const s = newGame(1, 0);
  s.level = 5;
  allocate(s, ring1);
  allocate(s, ring2);
  const vms = nodeVMs(s, { mode: 'refund' });
  expect(vms.find((n) => n.id === ring2)?.refundable).toBe(true);
  expect(vms.find((n) => n.id === ring1)?.refundable).toBe(false);
  const withChild = nodeVMs(s, { mode: 'refund', refund: [ring2] });
  expect(withChild.find((n) => n.id === ring1)?.refundable).toBe(true);
  expect(withChild.find((n) => n.id === ring2)?.refunding).toBe(true);
});

it('pruneStaged drops dependants when their parent is unstaged', () => {
  expect(pruneStaged([], [ring1, ring2])).toEqual([ring1, ring2]);
  expect(pruneStaged([], [ring2])).toEqual([]);
  expect(pruneStaged([ring1], [ring2])).toEqual([ring2]);
});

it('the staged refund names its nodes and Gold price', () => {
  const s = newGame(1, 0);
  s.level = 10;
  s.gold = 2000;
  expect(refundTotalLine(s, [])).toBe('No nodes marked for refund');
  expect(refundTotalLine(s, [ring1, ring2])).toBe('Refund 2 nodes for 2,000 Gold');
  expect(refundAffordable(s, [ring1, ring2])).toBe(true);
  s.gold = 1999;
  expect(refundAffordable(s, [ring1, ring2])).toBe(false);
});

it('the points line says how many are left', () => {
  const s = newGame(1, 0);
  s.level = 18;
  expect(pointsLine(s)).toBe('17 points to spend · level 18');
  const ring1 = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!.links[0]!;
  s.passives.allocated = [ring1];
  expect(pointsLine(s)).toBe('16 points to spend · level 18');
});

it('refund and reset lines name their price', () => {
  const s = newGame(1, 0);
  s.level = 10;
  const ring1 = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!.links[0]!;
  s.passives.allocated = [ring1];
  expect(refundLine(s, ring1)).toBe('Refund for 1,000 Gold');
  expect(resetLine()).toBe('Reset web for 20 Diamonds');
});

it('search finds a node by name or effect', () => {
  const s = newGame(1, 0);
  expect(searchNodes(s, 'vein sense')).toContain('veinSense');
  expect(searchNodes(s, 'earthshaker')).toContain('earthshaker');
});

it('every passive VM carries a composed 24 × 24 icon with a palette and id', () => {
  const s = newGame(1, 0);
  s.level = 3;
  const vms = nodeVMs(s);
  expect(vms.length).toBeGreaterThan(0);
  for (const vm of vms) {
    expect(vm.icon.id.length).toBeGreaterThan(0);
    expect(vm.icon.grid).toHaveLength(24);
    for (const row of vm.icon.grid) expect(row).toHaveLength(24);
    expect(Object.keys(vm.icon.palette).length).toBeGreaterThan(0);
  }
});

it('the passive start, an allocated keystone and a small node map to the right icons', () => {
  const s = newGame(1, 0);
  s.level = 3;
  const vms = nodeVMs(s);
  const start = vms.find((n) => n.id === START_NODE_ID);
  expect(start?.icon.id).toBe('miner');
  const earthshaker = vms.find((n) => n.id === 'earthshaker');
  expect(earthshaker?.icon.id).toBe('earthshaker');
  const digPower = vms.find((n) => n.kind === 'small' && n.icon.id === 'digPower');
  expect(digPower?.icon.id).toBe('digPower');
});

it('the new keystones and notables map to their own glyphs', () => {
  const s = newGame(1, 0);
  s.level = 3;
  const vms = nodeVMs(s);
  for (const id of ['oreBaron', 'allOrNothing', 'deepBreath', 'bloodMoney', 'soulDebt', 'prospectorsEye']) {
    expect(vms.find((n) => n.id === id)?.icon.id, id).toBe(id);
  }
  for (const id of ['deepMiner', 'reckoner', 'vanguard', 'alchemist', 'nightowl']) {
    expect(vms.find((n) => n.id === id)?.icon.id, id).toBe(id);
  }
});

it('the composed icons are round: their four corners are transparent', () => {
  const s = newGame(1, 0);
  s.level = 3;
  for (const vm of nodeVMs(s)) {
    expect(vm.icon.grid[0]?.[0], vm.id).toBe('.');
    expect(vm.icon.grid[0]?.[23], vm.id).toBe('.');
    expect(vm.icon.grid[23]?.[0], vm.id).toBe('.');
    expect(vm.icon.grid[23]?.[23], vm.id).toBe('.');
  }
});

it('every ascendancy VM carries a composed 24 × 24 icon', () => {
  const s = newGame(1, 0);
  const vms = ascendancyVMs(s);
  expect(vms.length).toBeGreaterThan(0);
  for (const vm of vms) {
    expect(vm.icon.id.length).toBeGreaterThan(0);
    expect(vm.icon.grid).toHaveLength(24);
    for (const row of vm.icon.grid) expect(row).toHaveLength(24);
    expect(Object.keys(vm.icon.palette).length).toBeGreaterThan(0);
  }
  const start = vms.find((n) => n.id === 'minerReborn');
  expect(start?.icon.id).toBe('minerReborn');
});
