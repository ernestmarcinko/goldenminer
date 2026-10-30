import { expect, it } from 'vitest';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import {
  autoMapMaxTier, autoMapping, autoMapQueueSize, nextEligibleAutoMap, queueForAutoMap, unqueueForAutoMap,
} from '../../src/core/autoMap';
import { endRun } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { leaveMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { stashMap } from '../helpers/items';

const fresh = () => newGame(1, 0);

/** A fresh game with the Surveyor notable allocated, auto-mapping still switched off. */
const surveyor = () => {
  const s = fresh();
  s.passives.allocated = ['surveyor'];
  return s;
};

/** A fresh game with the Surveyor notable allocated and auto-mapping switched on. */
const ready = () => {
  const s = surveyor();
  s.autoMap.on = true;
  return s;
};

it('auto-mapping is off until the Surveyor notable is allocated', () => {
  const s = fresh();
  expect(autoMapping(s)).toBe(false);
  s.passives.allocated = ['surveyor'];
  expect(autoMapping(s)).toBe(true);
});

it('the auto-map tier limit starts at 3 and rises with the ascendancy tree', () => {
  const s = fresh();
  expect(autoMapMaxTier(s)).toBe(3);
  const node = ASCENDANCY_NODES.find((n) => n.effects.some((e) => e.kind === 'autoMapTier'));
  if (node === undefined) throw new Error('no auto-map tier ascendancy node');
  s.ascendancy.allocated = [node.id];
  expect(autoMapMaxTier(s)).toBeGreaterThan(3);
});

it('the auto-map queue holds 100 maps, and the World Atlas ascendancy raises it', () => {
  const s = fresh();
  expect(autoMapQueueSize(s)).toBe(100);
  const atlas = ASCENDANCY_NODES.find((n) => n.id === 'worldAtlas');
  if (atlas === undefined) throw new Error('no worldAtlas node');
  s.ascendancy.allocated = [atlas.id];
  expect(autoMapQueueSize(s)).toBe(150);
});

it('queueing is locked until Surveyor is allocated', () => {
  const s = fresh();
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('locked');
  expect(s.autoMap.queue).toEqual([]);
  s.passives.allocated = ['surveyor'];
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([map.id]);
});

it('queueing refuses a full queue', () => {
  const s = surveyor();
  for (let i = 0; i < 100; i++) {
    const map = stashMap(s, 2, 10 + i);
    expect(queueForAutoMap(s, map.id)).toBe('ok');
  }
  const extra = stashMap(s, 2, 5000);
  expect(queueForAutoMap(s, extra.id)).toBe('queueFull');
  expect(s.autoMap.queue).toHaveLength(100);
});

it('queueing moves a held map into the queue, and unqueueing returns it to the stash', () => {
  const s = surveyor();
  expect(queueForAutoMap(s, 999)).toBe('noSuchMap');
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([map.id]);
  expect(Object.values(s.stash.maps).flat().some((m) => m.id === map.id)).toBe(false);
  expect(queueForAutoMap(s, map.id)).toBe('alreadyQueued');
  expect(unqueueForAutoMap(s, map.id)).toBe('ok');
  expect(s.stash.maps[2]?.map((m) => m.id)).toEqual([map.id]);
  expect(unqueueForAutoMap(s, map.id)).toBe('notQueued');
  expect(s.autoMap.queue).toEqual([]);
});

it('away time runs a queued map instead of digging', () => {
  const s = ready();
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.bag.some((c) => c?.type === 'map' && c.id === map.id)).toBe(false);
  expect(Object.values(s.stash.maps).flat().some((m) => m.id === map.id)).toBe(false);
  expect(s.mapTally.cleared + s.mapTally.lost).toBe(1);
  expect(s.autoMap.queue).toEqual([]);
});

it('live ticks auto-map too: starting it begins the battle at once', () => {
  const s = ready();
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, false);
  expect(s.mapTally.cleared + s.mapTally.lost).toBe(1);
  expect(s.autoMap.queue).toEqual([]);
});

it('an over-tier map stays queued and digging continues', () => {
  const s = ready();
  const map = stashMap(s, 5, 50);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([map.id]);
  expect(s.deepest).toBeGreaterThan(0);
});

it('auto-mapping switched off leaves the queue alone while away', () => {
  const s = surveyor();
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([map.id]);
  expect(s.deepest).toBeGreaterThan(0);
});

it('turning auto-map off mid-battle stops the chain after the current map', () => {
  const s = ready();
  const first = stashMap(s, 2, 10);
  const second = stashMap(s, 2, 11);
  expect(queueForAutoMap(s, first.id)).toBe('ok');
  expect(queueForAutoMap(s, second.id)).toBe('ok');
  applyTicks(s, 1, deriveStats(s), undefined, false, false);   // starts the first map, one tick in
  expect(s.activity.kind).toBe('map');
  s.autoMap.on = false;                                        // "Stop after this map"
  applyTicks(s, 400, deriveStats(s), undefined, false, false); // the first map resolves, the next does not start
  expect(s.activity.kind).toBe('dig');
  expect(s.mapTally.cleared + s.mapTally.lost).toBe(1);
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([second.id]);
});

it('leaving the map stops auto-mapping', () => {
  const s = ready();
  const first = stashMap(s, 2, 10);
  const second = stashMap(s, 2, 11);
  expect(queueForAutoMap(s, first.id)).toBe('ok');
  expect(queueForAutoMap(s, second.id)).toBe('ok');
  applyTicks(s, 1, deriveStats(s), undefined, false, false);
  expect(s.activity.kind).toBe('map');
  expect(leaveMap(s)).toBe(true);
  expect(s.autoMap.on).toBe(false);
  expect(s.activity.kind).toBe('dig');
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([second.id]);
});

it('a manual run is never pre-empted', () => {
  const s = ready();
  const manual = stashMap(s, 1, 2);
  const queued = stashMap(s, 2, 10);
  expect(startMap(s, manual.id)).toBe('ok');
  expect(queueForAutoMap(s, queued.id)).toBe('ok');
  applyTicks(s, 1, deriveStats(s), undefined, false, true);
  expect(s.activity.kind).toBe('map');
  expect(s.autoMap.queue.map((m) => m.id)).toEqual([queued.id]);
  expect(s.lastRun).toBeNull();
});

it('queueing a map and allocating the Surveyor leave the RNG streams alone', () => {
  const s = fresh();
  const rng = s.rng;
  const uniqueRng = s.uniqueRng;
  s.passives.allocated = ['surveyor'];
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  expect([s.rng, s.uniqueRng]).toEqual([rng, uniqueRng]);
});

it('auto-mapping switches itself off once the queue is exhausted', () => {
  const s = ready();
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.mapTally.cleared + s.mapTally.lost).toBe(1);
  expect(s.autoMap.queue).toEqual([]);
  expect(s.autoMap.on).toBe(false);   // nothing left to run: the chain is done
});

it('the next eligible map is the oldest queued within the tier limit', () => {
  const s = surveyor();
  const low = stashMap(s, 2, 10);
  const high = stashMap(s, 5, 50);   // over the base tier-3 limit
  expect(queueForAutoMap(s, high.id)).toBe('ok');
  expect(queueForAutoMap(s, low.id)).toBe('ok');
  expect(nextEligibleAutoMap(s)?.id).toBe(low.id);
  s.autoMap.on = true;
  expect(startMap(s, low.id, true)).toBe('ok');
  expect(nextEligibleAutoMap(s)).toBeUndefined();   // the over-tier map stays queued but isn't eligible
});

it('an auto-mapped run that hands to the next queued map keeps its result off-screen', () => {
  const s = ready();
  const first = stashMap(s, 2, 10);
  const second = stashMap(s, 2, 11);
  expect(queueForAutoMap(s, first.id)).toBe('ok');
  expect(queueForAutoMap(s, second.id)).toBe('ok');
  expect(startMap(s, first.id, true)).toBe('ok');
  const run = s.activity.kind === 'map' ? s.activity.run : undefined;
  if (run === undefined) throw new Error('no run');
  expect(run.auto).toBe(true);
  endRun(s, run, 'cleared');
  expect(s.lastRun?.seen).toBe(true);   // the chain continues, so no result dialog
});

it('the last auto-mapped map and a manual run show their results', () => {
  const s = ready();
  const only = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, only.id)).toBe('ok');
  expect(startMap(s, only.id, true)).toBe('ok');
  let run = s.activity.kind === 'map' ? s.activity.run : undefined;
  if (run === undefined) throw new Error('no run');
  endRun(s, run, 'cleared');
  expect(s.lastRun?.seen).toBe(false);   // nothing queued behind it

  const manual = stashMap(s, 1, 2);
  const queued = stashMap(s, 2, 12);
  expect(queueForAutoMap(s, queued.id)).toBe('ok');
  expect(startMap(s, manual.id)).toBe('ok');   // manual: no auto flag
  run = s.activity.kind === 'map' ? s.activity.run : undefined;
  if (run === undefined) throw new Error('no run');
  endRun(s, run, 'cleared');
  expect(s.lastRun?.seen).toBe(false);   // a manual run always shows, even with a queue behind it
});
