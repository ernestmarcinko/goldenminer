import { expect, it } from 'vitest';
import { ARMORED_TAKEN, ROOM_REGEN, VAMPIRIC_HEAL } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { advance } from '../../src/core/clock';
import { clickHit } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { dungeonLayout } from '../../src/core/dungeons';
import { xpToNext } from '../../src/core/levels';
import { addMap, leaveMap, startMap } from '../../src/core/maps';
import { monsterState } from '../../src/core/monsters';
import { newGame } from '../../src/core/newGame';
import { mulberry32 } from '../../src/core/rng';
import { validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GameState, MapRun, MonsterState, Stats, TickEvent } from '../../src/core/types';
import { gear } from '../helpers/items';

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

// A run started on a tier-1 map, its first room replaced by one hand-built monster.
function started(p: Partial<MonsterState> = {}): { s: GameState; run: MapRun; m: MonsterState } {
  const s = newGame(1, 0);
  expect(startMap(s, addMap(s, 1, 2).id)).toBe('ok');
  const run = runOf(s);
  const m = monster(p);
  run.queue = [m];
  return { s, run, m };
}

function monster(p: Partial<MonsterState> = {}): MonsterState {
  return {
    name: 'Test Monster', species: 0, rank: 'normal', mods: [], extra: 0,
    element: 'physical', life: 10_000, maxLife: 10_000, damage: 40, intervalS: 1, xp: 10, ...p,
  };
}

const at = (s: GameState, autoTicksPerSecond: number): Stats => ({ ...deriveStats(s), autoTicksPerSecond });
const strikes = (events: TickEvent[]) => events.flatMap((e) => (e.kind === 'strike' ? [e] : []));

it('vampiric champions heal what they bite', () => {
  const { s, run, m } = started({ rank: 'champion', mods: ['vampiric'], life: 5_000 });   // wounded, so the heal isn't capped
  run.life = 1_000_000;
  const stats = deriveStats(s);
  const events: TickEvent[] = [];
  for (let t = 0; t < 100 && !events.some((e) => e.kind === 'hurt'); t++) applyTicks(s, 1, stats, events);
  const hurt = events.find((e) => e.kind === 'hurt');
  if (hurt?.kind !== 'hurt') throw new Error('the champion never attacked');
  expect(hurt.amount).toBe(40);
  const struck = strikes(events).reduce((sum, e) => sum + e.amount, 0);
  expect(m.life).toBe(5_000 - struck + Math.round(40 * VAMPIRIC_HEAL));
  expect(run.log).toContainEqual({ kind: 'heal', monster: 'Test Monster', amount: Math.round(40 * VAMPIRIC_HEAL) });
});

it('a vampiric champion at full life stays at full life, with no heal line', () => {
  const { s, run, m } = started({ rank: 'champion', mods: ['vampiric'] });
  run.monsterCarry = 0.95;   // at 10 ticks a second it bites this tick, before the miner's first swing lands
  const events: TickEvent[] = [];
  applyTicks(s, 1, at(s, 10), events);
  expect(events).toEqual([{ kind: 'hurt', amount: 40 }]);
  expect(m.life).toBe(m.maxLife);
  expect(run.log.some((l) => l.kind === 'heal')).toBe(false);
});

it('armor soaks the hit after the crit', () => {
  let crits = 0;
  for (let rng = 1; rng <= 2000; rng++) {
    const { s } = started({ rank: 'champion', mods: ['armored'] });
    s.rng = rng;
    const plain = structuredClone(s);
    runOf(plain).queue[0]?.mods.splice(0);
    const armored: TickEvent[] = [];
    const bare: TickEvent[] = [];
    clickHit(s, armored);
    clickHit(plain, bare);
    const [hit] = strikes(armored);
    const [raw] = strikes(bare);
    if (hit === undefined || raw === undefined) throw new Error('no strike');
    expect(hit, `rng ${rng}`).toEqual({ ...raw, amount: Math.max(1, Math.round(raw.amount * ARMORED_TAKEN)) });
    expect(runOf(s).queue[0]?.life).toBe(10_000 - hit.amount);
    if (raw.crit) crits++;
  }
  expect(crits).toBeGreaterThan(20);
});

it('a strike draws its damage first, then its crit', () => {
  // Only the first two draws matter here: seeds whose first draw would crit and whose second would not, and back.
  let checked = 0;
  for (let rng = 1; rng <= 5000 && checked < 40; rng++) {
    const { s } = started();
    const b = deriveBattleStats(s);
    const u1 = mulberry32(rng);
    const u2 = mulberry32(u1.state);
    if ((u1.value < b.critChance) === (u2.value < b.critChance)) continue;
    s.rng = rng;
    const events: TickEvent[] = [];
    clickHit(s, events);
    const rolled = b.damageMin + Math.floor(u1.value * (b.damageMax - b.damageMin + 1));
    const crit = u2.value < b.critChance;
    expect(strikes(events), `rng ${rng}`).toEqual([
      { kind: 'strike', amount: crit ? Math.round(rolled * b.critMultiplier) : rolled, crit, click: true },
    ]);
    checked++;
  }
  expect(checked).toBe(40);
});

it('held loot does not freeze a run', () => {
  const { s, m } = started();
  s.overflow.push({ bag: 'battle', item: gear(s, 'helm') });
  applyTicks(s, 1, at(s, 0.1));
  expect(m.life).toBeLessThan(m.maxLife);
  expect(s.tickCount).toBe(1);
});

it('a room clear ends its combat step: the unspent swings drop and the new room waits', () => {
  const { s, run } = started({ life: 1 });
  s.equipped.battle.weapon = gear(s, 'weapon', { affixes: [{ stat: 'attackSpeed', value: 1000 }] });   // 5 swings a second
  run.hitCarry = 0.9;
  const events: TickEvent[] = [];
  applyTicks(s, 1, at(s, 4), events);   // one 0.25 s step: the carry reaches 2.15, and the first swing clears the room
  expect(run.room).toBe(2);
  expect(run.hitCarry).toBeCloseTo(0.15);   // the second whole swing is dropped, the fraction kept
  expect(run.monsterCarry).toBe(0);
  expect(strikes(events)).toHaveLength(1);
  expect(events.some((e) => e.kind === 'hurt')).toBe(false);
  expect(run.queue).toEqual(dungeonLayout(s.seed, run.map).rooms[1]?.map((lm) => monsterState(1, lm)));
});

it('the combat steps after a room clear fight on in the same tick', () => {
  const { s, run } = started({ life: 1 });
  run.hitCarry = 0.9;
  const events: TickEvent[] = [];
  applyTicks(s, 1, at(s, 0.1), events);   // 10 s in 40 steps: the first clears the room, the other 39 swing 9 times
  expect(run.room).toBe(2);
  expect(strikes(events)).toHaveLength(10);
  expect(run.hitCarry).toBeCloseTo(0.9);   // 0.15 kept from the clear, plus 39 × 0.25, less 9 swings
  expect(events.some((e) => e.kind === 'hurt')).toBe(true);
});

it('the tick rate never changes how long a fight lasts', () => {
  // A tier-2 map kills a naked miner; the time it takes must not depend on how coarse the ticks are.
  const medianDeath = (rate: number) => {
    const times: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(seed, 0);
      expect(startMap(s, addMap(s, 2, 10 + seed).id)).toBe('ok');
      const stats = at(s, rate);
      while (s.activity.kind === 'map') applyTicks(s, 1, stats);
      expect(s.lastRun?.outcome, `seed ${seed} rate ${rate}`).toBe('died');
      times.push((s.tickCount - 0.5) / rate);   // the death fell somewhere in the last tick: count half of it
    }
    times.sort((x, y) => x - y);
    return ((times[9] ?? 0) + (times[10] ?? 0)) / 2;
  };
  const base = medianDeath(1);
  expect(base).toBeGreaterThan(20);
  for (const rate of [0.1, 10]) {
    const median = medianDeath(rate);
    expect(median, `rate ${rate}`).toBeGreaterThan(base * 0.75);
    expect(median, `rate ${rate}`).toBeLessThan(base * 1.25);
  }
});

it('a kill resets the monster carry', () => {
  const { s, run } = started({ life: 1 });
  run.queue.push(monster());
  run.monsterCarry = 0.6;
  clickHit(s);
  expect(run.queue).toHaveLength(1);
  expect(run.monsterCarry).toBe(0);
});

it('a level-up mid-run adds the life it grants, before the room regen', () => {
  const { s, run } = started({ life: 1, xp: 10 });
  s.xp = xpToNext(1) - 1;
  run.life = 35;
  const oldMax = deriveBattleStats(s).maxLife;
  clickHit(s);
  expect(s.level).toBe(2);
  const newMax = deriveBattleStats(s).maxLife;
  expect(newMax).toBeGreaterThan(oldMax);
  expect(run.room).toBe(2);
  expect(run.life).toBe(Math.min(newMax, 35 + (newMax - oldMax) + Math.round(newMax * ROOM_REGEN)));
  expect(run.log).toContainEqual({ kind: 'level', level: 2 });
  expect(run.gained).toMatchObject({ xp: 10, levels: 1 });
});

it('the swings after a level-up in the same tick hit with the new level', () => {
  let xp = 0;
  for (let l = 1; l < 20; l++) xp += xpToNext(l);
  const { s, run } = started({ life: 1, xp });
  run.queue.push(monster({ life: 1_000_000, maxLife: 1_000_000 }));
  const old = deriveBattleStats(s);
  const events: TickEvent[] = [];
  applyTicks(s, 1, at(s, 0.1), events);
  expect(s.level).toBe(20);
  const now = deriveBattleStats(s);
  expect(now.damageMin).toBeGreaterThan(Math.round(old.damageMax * old.critMultiplier));
  const after = strikes(events).slice(1);
  expect(after.length).toBeGreaterThan(5);
  for (const e of after) {
    expect(e.amount).toBeGreaterThanOrEqual(now.damageMin);
    expect(e.amount).toBeLessThanOrEqual(Math.round(now.damageMax * now.critMultiplier));
  }
});

it('every state of a run, tick by tick and click by click, is a valid save', () => {
  for (const seed of [1, 2, 3]) {
    for (const tier of [1, 2, 4]) {
      for (const rate of [0.1, 1, 10]) {
        for (const clicks of [0, 2]) {
          const s = newGame(seed, 0);
          expect(startMap(s, addMap(s, tier, 10 + seed).id)).toBe('ok');
          const stats = at(s, rate);
          for (let t = 0; t < 20_000 && s.activity.kind === 'map'; t++) {
            for (let c = 0; c < clicks && s.activity.kind === 'map'; c++) {
              clickHit(s);
              expect(validateState(s), `seed ${seed} tier ${tier} rate ${rate} tick ${t} click ${c}`).toBe(true);
            }
            applyTicks(s, 1, stats);
            expect(validateState(s), `seed ${seed} tier ${tier} rate ${rate} clicks ${clicks} tick ${t}`).toBe(true);
          }
          expect(s.activity.kind, `seed ${seed} tier ${tier} rate ${rate} clicks ${clicks}`).toBe('dig');
        }
      }
    }
  }
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
  expect(once.lastRun?.outcome).toBe('cleared');
  expect(once.deepest).toBeGreaterThan(0);   // the ticks left after the run went back to digging
});

it('pumped play and one long catch-up give the same run at a fractional tick rate', () => {
  // 0.8 ticks a second: 1.25 s ticks, so the hit carry keeps a fraction between ticks (and 1250 ms is exact).
  const mk = () => { const s = newGame(3, 0); startMap(s, addMap(s, 1, 2).id); return s; };
  const pumped = mk();
  const once = mk();
  const stats = at(pumped, 0.8);
  for (let t = 250; t <= 600_000; t += 250) advance(pumped, t, stats);
  advance(once, 600_000, stats);
  expect(pumped).toEqual(once);
  expect(once.lastRun?.outcome).toBe('cleared');
  expect(once.deepest).toBeGreaterThan(0);
});
