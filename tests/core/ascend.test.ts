import { expect, it } from 'vitest';
import { ascend } from '../../src/core/ascend';
import {
  ASCENDANCY_NODE_BY_ID, ASCENDANCY_NODES, ASCENDANCY_START_ID, ascendancyPoints, ascendancyTotals,
} from '../../src/core/ascendancy';
import { ASCEND_LEVEL, GUARANTEED_FIRST_MAP_METRE } from '../../src/core/balance';
import { emptyInventory } from '../../src/core/cells';
import { startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { gear, stashMap } from '../helpers/items';

const fresh = () => newGame(1, 0);

/** A node id on a path from the ascendancy start to `target`, in allocation order (the start excluded). */
function pathTo(target: string): string[] {
  const prev = new Map<string, string>();
  const seen = new Set([ASCENDANCY_START_ID]);
  const queue = [ASCENDANCY_START_ID];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined || cur === target) break;
    const node = ASCENDANCY_NODE_BY_ID.get(cur);
    if (node === undefined) continue;
    for (const l of node.links) {
      if (seen.has(l)) continue;
      seen.add(l);
      prev.set(l, cur);
      queue.push(l);
    }
  }
  const path: string[] = [];
  let cur: string | undefined = target;
  while (cur !== undefined && cur !== ASCENDANCY_START_ID) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

it('cannot ascend below the ascend level', () => {
  const s = fresh();
  s.level = ASCEND_LEVEL - 1;
  const before = structuredClone(s);
  expect(ascend(s)).toBe('notReady');
  expect(s).toEqual(before);
});

it('at the cap it grants points for the deepest depth and resets the run', () => {
  const s = fresh();
  s.level = ASCEND_LEVEL;
  s.deepest = 1000;
  s.xp = 0;
  expect(ascend(s)).toBe('ok');
  expect(s.lifetime).toEqual({ ascensions: 1, deepest: 1000 });
  expect(s.ascendancy.points).toBe(ascendancyPoints(1000, ASCEND_LEVEL, 0));
  expect(s.level).toBe(1);
  expect(s.xp).toBe(0);
  expect(s.passives.allocated).toEqual([]);
  expect(s.deepest).toBe(0);
  expect(s.progress).toBe(0);
  expect(s.ahead[1]?.hardRock).toBe(false);
  expect(s.ahead[GUARANTEED_FIRST_MAP_METRE]).toEqual({ feature: 'map', amount: 0, hardRock: false });
});

it('rebuilds every run field from scratch', () => {
  const s = fresh();
  s.level = ASCEND_LEVEL;
  s.xp = 4321;
  s.deepest = 1000;
  s.progress = 0.75;
  s.gold = 5000;
  s.diamonds = 50;
  s.souls = 25;
  s.passives.allocated = ['veinSense'];
  s.bag[0] = gear(s, 'pickaxe');
  s.stash.general[0] = gear(s, 'ring');
  s.equipped.mining.pickaxe = gear(s, 'pickaxe');
  s.overflow.push(gear(s, 'boots'));
  s.ahead[1000] = { feature: 'chest', amount: 0, hardRock: false };
  s.finds.push({ id: 1, depth: 1000, kind: 'chest', amount: 0, tick: 1 });
  const map = stashMap(s, 1, 2);
  expect(startMap(s, map.id)).toBe('ok');
  s.lastRun = {
    map, outcome: 'left', room: 1, bossRoom: 5, gained: { xp: 0, souls: 0, gold: 0, levels: 0 }, items: 0, seen: true,
  };
  s.mapTally = { cleared: 4, lost: 1 };
  s.lootTally = { kept: 3, sold: 2, salvaged: 1 };
  s.paused = true;
  s.drops.push({
    id: 1, kind: 'gear', name: 'Test pickaxe', rarity: 'normal', base: 'pickaxe', count: 1,
    origin: { kind: 'metre', metre: 10 }, trail: [],
  });
  s.deaths.push({ id: 1, tick: 5, at: 0, map, room: 1, bossRoom: 5, killer: 'Test' });
  s.merchant = { band: 2, bought: [1, 3] };
  s.nextId = 500;

  const empty = emptyInventory();
  expect(ascend(s)).toBe('ok');
  expect(s.level).toBe(1);
  expect(s.xp).toBe(0);
  expect(s.passives).toEqual({ allocated: [] });
  expect(s.gold).toBe(0);
  expect(s.diamonds).toBe(0);
  expect(s.souls).toBe(0);
  expect(s.deepest).toBe(0);
  expect(s.progress).toBe(0);
  expect(s.ahead[1000]).toBeUndefined();
  expect(s.finds).toEqual([]);
  expect(s.nextId).toBe(1);
  expect(s.activity).toEqual({ kind: 'dig' });
  expect(s.lastRun).toBeNull();
  expect(s.mapTally).toEqual({ cleared: 0, lost: 0 });
  expect(s.lootTally).toEqual({ kept: 0, sold: 0, salvaged: 0 });
  expect(s.paused).toBe(false);
  expect(s.drops).toEqual([]);
  expect(s.deaths).toEqual([]);
  expect(s.merchant).toEqual({ band: 0, bought: [] });
  expect(s.bag).toEqual(empty.bag);
  expect(s.stash).toEqual(empty.stash);
  expect(s.equipped).toEqual(empty.equipped);
  expect(s.overflow).toEqual([]);
  expect(s.ahead[GUARANTEED_FIRST_MAP_METRE]).toEqual({ feature: 'map', amount: 0, hardRock: false });
});

it('keeps the world, the RNG streams, settings, the tree, the auto-map queue and lifetime', () => {
  const s = newGame(11, 1234, { seedText: 'kept-world', lootSeed: 99 });
  s.level = ASCEND_LEVEL;
  s.deepest = 2500;
  s.worldGen = 1;
  s.rng = 12345;
  s.uniqueRng = 67890;
  s.tickCount = 777;
  s.lastTickAt = 1234;
  s.settings.motion.floats = false;
  s.settings.lootFilter = [{ kind: 'gem', action: 'sell' }];
  s.ascendancy.allocated = ['wealthSmall1'];
  s.autoMap.queue = [42];
  s.lifetime = { ascensions: 2, deepest: 900 };
  const kept = {
    seed: s.seed,
    worldSeed: s.worldSeed,
    worldGen: s.worldGen,
    settings: structuredClone(s.settings),
    rng: s.rng,
    uniqueRng: s.uniqueRng,
    tickCount: s.tickCount,
    lastTickAt: s.lastTickAt,
    allocated: [...s.ascendancy.allocated],
    queue: [...s.autoMap.queue],
  };

  expect(ascend(s)).toBe('ok');
  expect(s.seed).toBe(kept.seed);
  expect(s.worldSeed).toBe(kept.worldSeed);
  expect(s.worldGen).toBe(kept.worldGen);
  expect(s.settings).toEqual(kept.settings);
  expect(s.rng).toBe(kept.rng);
  expect(s.uniqueRng).toBe(kept.uniqueRng);
  expect(s.tickCount).toBe(kept.tickCount);
  expect(s.lastTickAt).toBe(kept.lastTickAt);
  expect(s.ascendancy.allocated).toEqual(kept.allocated);
  expect(s.autoMap.queue).toEqual(kept.queue);
  expect(s.lifetime).toEqual({ ascensions: 3, deepest: 2500 });
});

it('starts the next run at the tree\'s starting depth, with the new-run guarantees', () => {
  const depthNode = ASCENDANCY_NODES.find((n) => n.effects.some((e) => e.kind === 'startingDepth'));
  if (depthNode === undefined) throw new Error('the ascendancy tree has no starting-depth node');
  const s = fresh();
  s.ascendancy.allocated = pathTo(depthNode.id);
  const startingDepth = ascendancyTotals(s).startingDepth;
  expect(startingDepth).toBeGreaterThan(0);
  s.level = ASCEND_LEVEL;
  s.deepest = 5000;
  expect(ascend(s)).toBe('ok');
  expect(s.deepest).toBe(startingDepth);
  expect(s.ahead[startingDepth + 1]?.hardRock).toBe(false);
  expect(s.ahead[startingDepth + GUARANTEED_FIRST_MAP_METRE]).toEqual({ feature: 'map', amount: 0, hardRock: false });
});

it('a second ascension keeps the first tree and accumulates points', () => {
  const s = fresh();
  s.level = ASCEND_LEVEL;
  s.deepest = 1000;
  expect(ascend(s)).toBe('ok');
  const first = s.ascendancy.points;
  expect(first).toBe(ascendancyPoints(1000, ASCEND_LEVEL, 0));
  s.ascendancy.allocated = ['wealthSmall1'];
  s.level = ASCEND_LEVEL;
  s.deepest = 3000;
  expect(ascend(s)).toBe('ok');
  expect(s.lifetime.ascensions).toBe(2);
  expect(s.lifetime.deepest).toBe(3000);
  expect(s.ascendancy.points).toBe(first + ascendancyPoints(3000, ASCEND_LEVEL, 1));
  expect(s.ascendancy.allocated).toEqual(['wealthSmall1']);
});

it('leaves both RNG streams alone', () => {
  const s = fresh();
  s.level = ASCEND_LEVEL;
  s.deepest = 1500;
  const rng = s.rng;
  const uniqueRng = s.uniqueRng;
  expect(ascend(s)).toBe('ok');
  expect([s.rng, s.uniqueRng]).toEqual([rng, uniqueRng]);
});
