import { expect, it } from 'vitest';
import { advance } from '../../src/core/clock';
import { applyTicks } from '../../src/core/dig';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GameState } from '../../src/core/types';

const stats = deriveStats(newGame(1, 0));

function run(roundTrip: boolean): GameState {
  let s = newGame(12345, 0);
  applyTicks(s, 10_000, stats);
  applyTicks(s, 500, stats);
  if (roundTrip) {
    const decoded = decodeSave(encodeSave(s, 0));
    if (!decoded.ok) throw new Error('round trip failed');
    s = decoded.state;
  }
  applyTicks(s, 5000, stats);
  return s;
}

it('a save/decode in the middle of a run changes nothing', () => {
  expect(run(true)).toEqual(run(false));
});

it('advance in one span equals the same ticks applied directly', () => {
  const a = newGame(9, 0);
  const b = newGame(9, 0);
  advance(a, 3_600_000, stats);
  applyTicks(b, 3600, stats);
  expect(a.tickCount).toBe(b.tickCount);
  expect(a.gold).toBe(b.gold);
});
