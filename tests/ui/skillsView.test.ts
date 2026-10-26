import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { PASSIVE_NODE_BY_ID, START_NODE_ID } from '../../src/core/passives';
import { nodeVMs, pointsLine, refundLine, resetLine, searchNodes } from '../../src/ui/skills/skillsView';

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
