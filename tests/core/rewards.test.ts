import { expect, it, vi } from 'vitest';
import { MAX_OVERFLOW } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { clickHit, onKill, soulsForKill } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { addMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { isGear, setOfSlot } from '../../src/core/items';
import { nextRandom } from '../../src/core/rng';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
import type { GameState, MapRun, MonsterState, Rank } from '../../src/core/types';
import { gear } from '../helpers/items';

// Spies that call through: which rarity multiplier each item rolled with, and how many gems were rolled.
const spy = vi.hoisted(() => ({ rarityArgs: [] as number[], gems: 0 }));
vi.mock('../../src/core/itemGen', async (importActual) => {
  const actual = await importActual<typeof import('../../src/core/itemGen')>();
  return {
    ...actual,
    rollRarity: (state: Parameters<typeof actual.rollRarity>[0], magicFind?: number) => {
      spy.rarityArgs.push(magicFind ?? 1);
      return actual.rollRarity(state, magicFind);
    },
    rollGem: (...args: Parameters<typeof actual.rollGem>) => { spy.gems += 1; return actual.rollGem(...args); },
  };
});

it('souls per kill round by chance', () => {
  expect(soulsForKill(0.5, 4, 'normal', 1)).toBe(1);
  expect(soulsForKill(0.4, 2, 'normal', 1)).toBe(1);
  expect(soulsForKill(0.6, 2, 'normal', 1)).toBe(0);
  expect(soulsForKill(0, 1, 'boss', 2)).toBe(3);
  expect(soulsForKill(0.1, 1, 'champion', 1)).toBe(1);   // 0.75: floor 0, 0.1 < 0.75 -> 1
});

// Clicks, then ticks only while the map still runs: a tick after the final click would dig a metre and pay its Gold.
function fight(s: GameState, clicks = true): void {
  const stats = deriveStats(s);
  while (s.activity.kind === 'map') {
    if (clicks) clickHit(s);
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
  s.bag = s.bag.map((_, i) => gear(s, i % 2 ? 'weapon' : 'pickaxe'));
  s.stash.general = s.stash.general.map(() => gear(s, 'weapon'));
  startMap(s, addMap(s, 1, 2).id);
  fight(s);
  expect(s.lastRun?.outcome).toBe('cleared');
  expect(s.overflow.length).toBeGreaterThanOrEqual(3);
  const gold = s.gold;
  applyTicks(s, 10, deriveStats(s));
  expect(s.gold).toBe(gold);
});

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

// A started tier-1 run (seed `seed`), and a hand-built monster of `rank` ready to fall.
function kill(seed: number, rank: Rank, prepare?: (s: GameState) => void) {
  const s = newGame(seed, 0);
  prepare?.(s);
  startMap(s, addMap(s, 1, 2).id);
  const run = runOf(s);
  const m: MonsterState = {
    name: 'Test Monster', species: 0, rank, mods: [], extra: 0, element: 'physical',
    life: 0, maxLife: 10, damage: 1, intervalS: 1, xp: 10,
  };
  const b = deriveBattleStats(s);
  spy.rarityArgs.length = 0;
  spy.gems = 0;
  // The draws the kill will make, read ahead on a copy: Souls, then the extra-item chance.
  const ahead = { rng: s.rng };
  nextRandom(ahead);
  const chancePasses = nextRandom(ahead) < 0.15;
  onKill(s, run, m, b);
  return { s, run, b, chancePasses };
}

const dropLines = (run: MapRun) => run.log.filter((l) => l.kind === 'drop').length;

const GUARANTEED: Record<Rank, number> = { normal: 0, champion: 1, boss: 2 };

it('each rank drops its guaranteed items plus one more when the chance draw passes', () => {
  for (const rank of ['normal', 'champion', 'boss'] as const) {
    const seen = { pass: 0, miss: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const { run, chancePasses } = kill(seed, rank);
      seen[chancePasses ? 'pass' : 'miss'] += 1;
      // Gem notes are on the run too: items rolled with a rarity draw are counted by the spy.
      expect(spy.rarityArgs.length, `${rank} seed ${seed}`).toBe(GUARANTEED[rank] + (chancePasses ? 1 : 0));
      expect(run.loot.length, `${rank} seed ${seed}`).toBe(spy.rarityArgs.length + spy.gems);
    }
    expect(seen.pass, rank).toBeGreaterThan(0);
    expect(seen.miss, rank).toBeGreaterThan(0);
  }
});

it('only a champion\'s guaranteed item rolls with the champion magic-find boost', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const champion = kill(seed, 'champion');
    const mf = champion.b.magicFindMultiplier;
    expect(spy.rarityArgs[0], `champion seed ${seed}`).toBe(mf * 3);
    expect(spy.rarityArgs.slice(1), `champion seed ${seed}`).toEqual(spy.rarityArgs.length > 1 ? [mf] : []);
    kill(seed, 'boss');
    expect(spy.rarityArgs.every((a) => a === mf), `boss seed ${seed}`).toBe(true);
    kill(seed, 'normal');
    expect(spy.rarityArgs.every((a) => a === mf), `normal seed ${seed}`).toBe(true);
  }
});

it('about 80% of map gear is battle gear, and gems land in the bag', () => {
  let battle = 0;
  let mining = 0;
  let gems = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { s } = kill(seed, 'boss');
    for (const c of s.bag) {
      if (c === null) continue;
      if (!isGear(c)) gems++;
      else if (setOfSlot(c.slot) === 'battle') battle++;
      else mining++;
    }
  }
  const share = battle / (battle + mining);
  expect(share).toBeGreaterThan(0.75);
  expect(share).toBeLessThan(0.85);
  expect(gems).toBeGreaterThan(0);
});

it('a gem drop is noted on the run and in the log like an item', () => {
  let found = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { run } = kill(seed, 'normal');
    if (spy.gems > 0) {
      found++;
      expect(run.loot.some((n) => n.rarity === 'gem'), `seed ${seed}`).toBe(true);
    }
    expect(dropLines(run), `seed ${seed}`).toBe(run.loot.length);
  }
  expect(found).toBeGreaterThan(0);
});

it('with MAX_OVERFLOW items already held under stop, a further drop is sold and nothing more is held', () => {
  const { s, run } = kill(1, 'boss', (g) => {
    g.settings.bagFull = 'stop';
    g.bag = g.bag.map((_, i) => gear(g, i % 2 ? 'weapon' : 'pickaxe'));
    g.stash.general = g.stash.general.map(() => gear(g, 'weapon'));
    for (let i = 0; i < MAX_OVERFLOW; i++) g.overflow.push(gear(g, 'weapon'));
  });
  expect(s.overflow).toHaveLength(MAX_OVERFLOW);
  expect(run.loot.some((n) => n.outcome === 'sold')).toBe(true);
  expect(run.loot.some((n) => n.outcome === 'held')).toBe(false);
});

it('the offline summary reports maps, levels and Souls as differences from a non-zero start', () => {
  const before = newGame(1, 0);
  before.souls = 7;
  before.level = 2;
  before.mapTally = { cleared: 3, lost: 1 };
  const after = structuredClone(before);
  startMap(after, addMap(after, 1, 2).id);
  fight(after);
  expect(after.lastRun?.outcome).toBe('cleared');
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum.maps).toEqual({ cleared: 1, lost: 0 });
  expect(sum.souls).toBe(after.souls - 7);
  expect(sum.souls).toBeGreaterThan(0);
  expect(sum.levels).toBe(after.level - 2);
});

it('the offline summary counts a lost map', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  startMap(after, addMap(after, 4, 2).id);
  fight(after, false);
  expect(after.lastRun?.outcome).toBe('died');
  expect(summarize(before, after, 600_000, 600, 28_800_000).maps).toEqual({ cleared: 0, lost: 1 });
});

it('the offline summary notices the bag holding map drops', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  after.settings.bagFull = 'stop';
  after.bag = after.bag.map((_, i) => gear(after, i % 2 ? 'weapon' : 'pickaxe'));
  after.stash.general = after.stash.general.map(() => gear(after, 'weapon'));
  startMap(after, addMap(after, 1, 2).id);
  fight(after);
  expect(after.overflow.length).toBeGreaterThan(0);
  expect(summarize(before, after, 600_000, 600, 28_800_000).bagStopped).toBe(true);
});
