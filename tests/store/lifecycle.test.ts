import { expect, it } from 'vitest';
import { advance } from '../../src/core/clock';
import { newGame } from '../../src/core/newGame';
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

  const reference = newGame(7, 0);
  advance(reference, 3 * HOUR, deriveStats(reference));
  expect(second.state).toEqual(reference);
  expect(second.offlineSummary?.ticks).toBe(2 * 3600);
});
