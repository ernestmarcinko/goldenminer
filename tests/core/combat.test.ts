import { expect, it } from 'vitest';
import { ARMORED_TAKEN, VAMPIRIC_HEAL } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { advance } from '../../src/core/clock';
import { clickHit } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { addMap, leaveMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { mulberry32 } from '../../src/core/rng';
import { deriveStats } from '../../src/core/stats';
import type { GameState, MapRun, MonsterState, TickEvent } from '../../src/core/types';

function runMap(tier: number, clicksPerTick: number, seed: number): GameState {
  const s = newGame(seed, 0);
  const map = addMap(s, tier, 10 + seed);
  expect(startMap(s, map.id)).toBe('ok');
  const stats = deriveStats(s);
  for (let t = 0; t < 5000 && s.activity.kind === 'map'; t++) {
    for (let c = 0; c < clicksPerTick && s.activity.kind === 'map'; c++) clickHit(s);
    applyTicks(s, 1, stats);
  }
  return s;
}

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

it('a naked level-1 miner clears a tier-1 map on auto hits alone', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(1, 0, seed).lastRun?.outcome, `seed ${seed}`).toBe('cleared');
});

it('the same miner falls in a tier-2 map without clicking', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(2, 0, seed).lastRun?.outcome, `seed ${seed}`).toBe('died');
});

it('three clicks a second win that tier-2 map', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(2, 3, seed).lastRun?.outcome, `seed ${seed}`).toBe('cleared');
});

it('a tier-4 map kills a level-1 miner in the first room', () => {
  expect(runMap(4, 0, 1).lastRun).toMatchObject({ outcome: 'died', room: 1 });
});

it('a cleared run levels up, consumes the map and keeps the tally', () => {
  const s = runMap(1, 0, 1);
  expect(s.level).toBeGreaterThanOrEqual(2);
  expect(s.stash.maps).toEqual([]);
  expect(s.mapTally).toEqual({ cleared: 1, lost: 0 });
  expect(s.lastRun).toMatchObject({ room: s.lastRun?.bossRoom, seen: false, gained: { xp: 200 } });   // 12 normals + 1 champion ×3 + boss ×5 = 20 × 10 XP
  expect(s.activity).toEqual({ kind: 'dig' });
});

it('vampiric champions heal, armored ones soak hits', () => {
  const s = newGame(1, 0);
  expect(startMap(s, addMap(s, 1, 2).id)).toBe('ok');
  const run = runOf(s);
  const champ: MonsterState = {   // wounded, so its heal isn't capped at max life
    name: 'Test Champion', species: 0, rank: 'champion', mods: ['armored', 'vampiric'], extra: 0,
    element: 'physical', life: 5_000, maxLife: 10_000, damage: 40, intervalS: 1, xp: 30,
  };
  run.queue[0] = champ;
  run.life = 1_000_000;

  // The click: replay its two draws (damage, then crit) to know the hit before the armor soaks it.
  const b = deriveBattleStats(s);
  const u1 = mulberry32(s.rng);
  const u2 = mulberry32(u1.state);
  const rolled = b.damageMin + Math.floor(u1.value * (b.damageMax - b.damageMin + 1));
  const hit = u2.value < b.critChance ? Math.round(rolled * b.critMultiplier) : rolled;
  const clickEvents: TickEvent[] = [];
  clickHit(s, clickEvents);
  const soaked = Math.max(1, Math.round(hit * ARMORED_TAKEN));
  expect(clickEvents).toEqual([{ kind: 'strike', amount: soaked, crit: u2.value < b.critChance, click: true }]);
  expect(champ.life).toBe(5_000 - soaked);

  // Tick until the champion strikes once; its life is what our strikes took, plus the bite it healed.
  const stats = deriveStats(s);
  const events: TickEvent[] = [];
  const before = champ.life;
  for (let t = 0; t < 100 && !events.some((e) => e.kind === 'hurt'); t++) applyTicks(s, 1, stats, events);
  const hurt = events.find((e) => e.kind === 'hurt');
  if (hurt?.kind !== 'hurt') throw new Error('the champion never attacked');
  expect(hurt.amount).toBe(40);
  const struck = events.reduce((sum, e) => sum + (e.kind === 'strike' ? e.amount : 0), 0);
  expect(champ.life).toBe(before - struck + Math.round(hurt.amount * VAMPIRIC_HEAL));
  expect(run.log).toContainEqual({ kind: 'heal', monster: 'Test Champion', amount: Math.round(40 * VAMPIRIC_HEAL) });
});

it('digging pauses during a run and resumes after it', () => {
  const s = newGame(1, 0);
  const map = addMap(s, 1, 2);
  startMap(s, map.id);
  const before = { gold: s.gold, deepest: s.deepest, progress: s.progress };
  applyTicks(s, 1, deriveStats(s)); // one hit can't kill a tier-1 monster, so no kill Gold either
  expect([s.gold, s.deepest, s.progress]).toEqual([before.gold, before.deepest, before.progress]);
  expect(s.tickCount).toBe(1);
  expect(leaveMap(s)).toBe(true);
  expect(s.lastRun).toMatchObject({ outcome: 'left', room: 1 });
  expect(s.mapTally).toEqual({ cleared: 0, lost: 1 });
  applyTicks(s, 1, deriveStats(s));
  expect(s.gold).toBeGreaterThan(before.gold);
  expect(leaveMap(s)).toBe(false);
});

it('only one run at a time, and only maps from the stash', () => {
  const s = newGame(1, 0);
  const a = addMap(s, 1, 2);
  const b = addMap(s, 1, 3);
  expect(startMap(s, 999)).toBe('invalid');
  expect(startMap(s, a.id)).toBe('ok');
  expect(startMap(s, b.id)).toBe('busy');
  expect(s.stash.maps.map((m) => m.id)).toEqual([b.id]);
});

it('pumped play and one long catch-up give the same run', () => {
  const mk = () => { const s = newGame(3, 0); startMap(s, addMap(s, 1, 2).id); return s; };
  const pumped = mk();
  const once = mk();
  const stats = deriveStats(pumped);
  for (let t = 250; t <= 600_000; t += 250) advance(pumped, t, stats);
  advance(once, 600_000, stats);
  expect(pumped).toEqual(once);
  expect(once.activity.kind).toBe('dig');
});
