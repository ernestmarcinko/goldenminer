import { expect, it } from 'vitest';
import { clickHit, soulsForKill } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { addMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
import type { GameState } from '../../src/core/types';
import { gear } from '../helpers/items';

it('souls per kill round by chance', () => {
  expect(soulsForKill(0.5, 4, 'normal', 1)).toBe(1);
  expect(soulsForKill(0.4, 2, 'normal', 1)).toBe(1);
  expect(soulsForKill(0.6, 2, 'normal', 1)).toBe(0);
  expect(soulsForKill(0, 1, 'boss', 2)).toBe(3);
  expect(soulsForKill(0.1, 1, 'champion', 1)).toBe(1);   // 0.75: floor 0, 0.1 < 0.75 -> 1
});

// Clicks, then ticks only while the map still runs: a tick after the final click would dig a metre and pay its Gold.
function fight(s: GameState): void {
  const stats = deriveStats(s);
  while (s.activity.kind === 'map') {
    clickHit(s);
    if (s.activity.kind === 'map') applyTicks(s, 1, stats);
  }
}

function clearTier1(seed: number) {
  const s = newGame(seed, 0);
  startMap(s, addMap(s, 1, 2).id);
  fight(s);
  return s;
}

it('a cleared tier-1 map pays Souls, 40 Gold and at least the boss and champion drops', () => {
  const s = clearTier1(1);
  expect(s.lastRun?.outcome).toBe('cleared');
  expect(s.lastRun?.gained.gold).toBe(40);   // 12 normals x 2, 1 champion x 6, the boss x 10
  expect(s.gold).toBe(40);
  expect(s.lastRun?.gained.souls).toBe(s.souls);
  expect(s.lastRun?.items).toBeGreaterThanOrEqual(3);
});

it('a full bag under stop holds map drops but the fight goes on', () => {
  const s = newGame(1, 0);
  s.settings.bagFull = 'stop';
  s.bags.battle = s.bags.battle.map(() => gear(s, 'weapon'));
  s.bags.mining = s.bags.mining.map(() => gear(s, 'pickaxe'));
  s.stash.general = s.stash.general.map(() => gear(s, 'weapon'));
  startMap(s, addMap(s, 1, 2).id);
  fight(s);
  expect(s.lastRun?.outcome).toBe('cleared');
  expect(s.overflow.length).toBeGreaterThanOrEqual(3);
  const gold = s.gold;
  applyTicks(s, 10, deriveStats(s));
  expect(s.gold).toBe(gold);
});

it('the offline summary reports maps, levels and Souls', () => {
  const before = newGame(1, 0);
  const after = clearTier1(1);
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum.maps).toEqual({ cleared: 1, lost: 0 });
  expect(sum.souls).toBe(after.souls);
  expect(sum.levels).toBe(after.level - 1);
});
