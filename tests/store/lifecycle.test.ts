import { expect, it } from 'vitest';
import { advance } from '../../src/core/clock';
import { addMap, startMap } from '../../src/core/maps';
import { freshWorld } from '../../src/core/seed';
import { deriveStats } from '../../src/core/stats';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';

it('an hour of 250 ms pumps, a save, then a 2 h absence equals one advance over the span', () => {
  const storage = new MemoryStorage();
  const now = { t: 0 };
  const mk = () => new GameStore({ storage, storageAvailable: true, now: () => now.t, newSeed: () => 7 });
  const first = mk();
  first.load();
  const HOUR = 3_600_000;
  for (now.t = 250; now.t <= HOUR; now.t += 250) first.pump();
  first.save();
  now.t = HOUR + 2 * HOUR;
  const second = mk();
  second.load();

  const reference = freshWorld(() => 7, 0);
  advance(reference, 3 * HOUR, deriveStats(reference));
  expect(second.state).toEqual(reference);
  expect(second.offlineSummary?.ticks).toBe(2 * 3600);
});

it('a run left going while away finishes offline and digging resumes, the same as one advance', () => {
  const storage = new MemoryStorage();
  const now = { t: 0 };
  const mk = () => new GameStore({ storage, storageAvailable: true, now: () => now.t, newSeed: () => 7 });
  const first = mk();
  first.load();
  first.startMap(addMap(first.state, 1, 2).id);
  for (now.t = 250; now.t <= 10_000; now.t += 250) first.pump(); // the run is still going when the tab closes
  expect(first.state.activity.kind).toBe('map');
  first.save();
  now.t = 10_000 + 2 * 3_600_000;
  const second = mk();
  second.load();

  const reference = freshWorld(() => 7, 0);
  startMap(reference, addMap(reference, 1, 2).id);
  advance(reference, now.t, deriveStats(reference));
  expect(second.state).toEqual(reference);
  expect(second.state.activity.kind).toBe('dig');
  expect(second.state.deepest).toBeGreaterThan(0);
  expect(second.offlineSummary?.maps.cleared).toBe(1);
});
