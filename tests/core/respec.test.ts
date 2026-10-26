import { expect, it } from 'vitest';
import { RESET_WEB_DIAMONDS, STASH_PAGE_SIZE } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';
import { PASSIVE_NODE_BY_ID, START_NODE_ID } from '../../src/core/passives';
import { allocate, refund, refundPrice, resetWeb } from '../../src/core/respec';
import { gear } from '../helpers/items';

const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!;
const ring1 = start.links[0]!;
const ring2 = PASSIVE_NODE_BY_ID.get(ring1)!.links.find((l) => l !== START_NODE_ID)!;

/** A node id on a path from the start to `target`, in allocation order (first adjacent to the start, last = target). */
function pathTo(target: string): string[] {
  const prev = new Map<string, string>();
  const seen = new Set([START_NODE_ID]);
  const queue = [START_NODE_ID];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const l of PASSIVE_NODE_BY_ID.get(cur)!.links) {
      if (seen.has(l)) continue;
      seen.add(l);
      prev.set(l, cur);
      queue.push(l);
    }
  }
  const path: string[] = [];
  let cur: string | undefined = target;
  while (cur !== undefined && cur !== START_NODE_ID) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

it('a refund costs more at higher levels', () => {
  expect(refundPrice(1)).toBe(100);
  expect(refundPrice(10)).toBe(1000);
});

it('allocate spends a point and only next to an allocated node', () => {
  const s = newGame(1, 0);
  s.level = 3;
  expect(allocate(s, ring2)).toBe('notAdjacent');
  expect(allocate(s, ring1)).toBe('ok');
  expect(allocate(s, ring1)).toBe('allocated');
  expect(allocate(s, ring2)).toBe('ok');
  expect(s.passives.allocated).toEqual([ring1, ring2]);
  expect(allocate(s, 'notANode')).toBe('invalid');
  const t = newGame(1, 0);
  t.level = 2;
  expect(allocate(t, ring1)).toBe('ok');
  expect(allocate(t, ring2)).toBe('noPoints');
});

it('refund spends Gold, only on a leaf', () => {
  const s = newGame(1, 0);
  s.level = 10;
  s.gold = 5000;
  allocate(s, ring1);
  allocate(s, ring2);
  expect(refund(s, ring1)).toBe('notLeaf');
  expect(refund(s, ring2)).toBe('ok');
  expect(s.gold).toBe(5000 - refundPrice(10));
  expect(refund(s, 'notANode')).toBe('invalid');
  expect(refund(s, 'veinSense')).toBe('notAllocated');
  s.gold = 0;
  expect(refund(s, ring1)).toBe('noGold');
});

it('a full reset spends Diamonds and empties the web', () => {
  const s = newGame(1, 0);
  s.level = 5;
  s.diamonds = 100;
  allocate(s, ring1);
  allocate(s, ring2);
  expect(resetWeb(s)).toBe('ok');
  expect(s.passives.allocated).toEqual([]);
  expect(s.diamonds).toBe(100 - RESET_WEB_DIAMONDS);
  s.diamonds = RESET_WEB_DIAMONDS - 1;
  expect(resetWeb(s)).toBe('noDiamonds');
});

it('Deep Pockets appends two free pages and its refund removes them while empty', () => {
  const s = newGame(1, 0);
  s.level = 20;
  s.gold = 100_000;
  const before = s.stash.general.length;
  for (const id of pathTo('deepPockets')) expect(allocate(s, id)).toBe('ok');
  expect(s.stash.general.length).toBe(before + 2 * STASH_PAGE_SIZE);
  // a full free page refuses the refund and changes nothing
  s.stash.general[s.stash.general.length - 1] = gear(s, 'pickaxe');
  expect(refund(s, 'deepPockets')).toBe('occupied');
  expect(s.stash.general.length).toBe(before + 2 * STASH_PAGE_SIZE);
  s.stash.general[s.stash.general.length - 1] = null;
  expect(refund(s, 'deepPockets')).toBe('ok');
  expect(s.stash.general.length).toBe(before);
});
