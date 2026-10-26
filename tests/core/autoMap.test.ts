import { expect, it } from 'vitest';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import {
  autoMapMaxTier, autoMapping, queueForAutoMap, unqueueForAutoMap,
} from '../../src/core/autoMap';
import { applyTicks } from '../../src/core/dig';
import { startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { stashMap } from '../helpers/items';

const fresh = () => newGame(1, 0);

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

it('queueing needs a real map and never doubles up; unqueueing needs the id', () => {
  const s = fresh();
  expect(queueForAutoMap(s, 999)).toBe('noSuchMap');
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  expect(queueForAutoMap(s, map.id)).toBe('alreadyQueued');
  expect(s.autoMap.queue).toEqual([map.id]);
  expect(unqueueForAutoMap(s, map.id)).toBe('ok');
  expect(unqueueForAutoMap(s, map.id)).toBe('notQueued');
  expect(s.autoMap.queue).toEqual([]);
});

it('away time runs a queued map instead of digging', () => {
  const s = fresh();
  s.passives.allocated = ['surveyor'];
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.bag.some((c) => c?.type === 'map' && c.id === map.id)).toBe(false);
  expect(Object.values(s.stash.maps).flat().some((m) => m.id === map.id)).toBe(false);
  expect(s.mapTally.cleared + s.mapTally.lost).toBe(1);
  expect(s.autoMap.queue).toEqual([]);
});

it('an over-tier map stays queued and digging continues', () => {
  const s = fresh();
  s.passives.allocated = ['surveyor'];
  const map = stashMap(s, 5, 50);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.autoMap.queue).toEqual([map.id]);
  expect(s.stash.maps[5]?.map((m) => m.id)).toEqual([map.id]);
  expect(s.deepest).toBeGreaterThan(0);
});

it('a stale queue id is dropped and digging continues', () => {
  const s = fresh();
  s.passives.allocated = ['surveyor'];
  s.autoMap.queue.push(123456);
  applyTicks(s, 400, deriveStats(s), undefined, false, true);
  expect(s.autoMap.queue).toEqual([]);
  expect(s.deepest).toBeGreaterThan(0);
});

it('live ticks do not auto-map', () => {
  const s = fresh();
  s.passives.allocated = ['surveyor'];
  const map = stashMap(s, 2, 10);
  expect(queueForAutoMap(s, map.id)).toBe('ok');
  applyTicks(s, 400, deriveStats(s), undefined, false, false);
  expect(s.autoMap.queue).toEqual([map.id]);
  expect(s.activity.kind).toBe('dig');
  expect(s.deepest).toBeGreaterThan(0);
});

it('a manual run is never pre-empted', () => {
  const s = fresh();
  s.passives.allocated = ['surveyor'];
  const manual = stashMap(s, 1, 2);
  const queued = stashMap(s, 2, 10);
  expect(startMap(s, manual.id)).toBe('ok');
  expect(queueForAutoMap(s, queued.id)).toBe('ok');
  applyTicks(s, 1, deriveStats(s), undefined, false, true);
  expect(s.activity.kind).toBe('map');
  expect(s.autoMap.queue).toEqual([queued.id]);
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
