import { expect, it } from 'vitest';
import fixture7 from '../fixtures/save-schema-7.txt?raw';
import { ARMORED_TAKEN, DEATH_LOG_LIMIT, DROP_LOG_LIMIT, RUN_LOOT_LIMIT, VAMPIRIC_HEAL } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { advance } from '../../src/core/clock';
import { applyTicks } from '../../src/core/dig';
import { dungeonLayout } from '../../src/core/dungeons';
import type { MapMod } from '../../src/core/items';
import { xpToNext } from '../../src/core/levels';
import { leaveMap, startMap } from '../../src/core/maps';
import { monsterState } from '../../src/core/monsters';
import { newGame } from '../../src/core/newGame';
import { mulberry32 } from '../../src/core/rng';
import { decodeSave, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { DropEntry, GameState, MapRun, MonsterState, Stats, TickEvent } from '../../src/core/types';
import { gear, stashMap } from '../helpers/items';

const DROP: DropEntry = {
  id: 0, kind: 'gear', name: 'Test ring', rarity: 'magic', base: 'ring', count: 1, origin: { kind: 'metre', metre: 1 }, trail: [{ event: 'bag' }],
};

function runMap(tier: number, seed: number): GameState {
  const s = newGame(seed, 0);
  const map = stashMap(s, tier, 10 + seed);
  expect(startMap(s, map.id)).toBe('ok');
  const stats = deriveStats(s);
  for (let t = 0; t < 5000 && s.activity.kind === 'map'; t++) applyTicks(s, 1, stats);
  return s;
}

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

it('a naked level-1 miner clears a tier-1 map on auto hits alone', () => {
  // The drop-rate re-tune re-seeded the loot stream, so exactly which seeds clear shifted; the guarantee is that a naked
  // miner wins the first map about two times in three.
  const cleared = [1, 2, 3, 4, 5].filter((seed) => runMap(1, seed).lastRun?.outcome === 'cleared').length;
  expect(cleared).toBeGreaterThanOrEqual(3);
});

it('the same miner falls in a tier-2 map', () => {
  for (const seed of [1, 2, 3, 4, 5]) expect(runMap(2, seed).lastRun?.outcome, `seed ${seed}`).toBe('died');
});

it('a tier-4 map kills a level-1 miner in the first room', () => {
  expect(runMap(4, 1).lastRun).toMatchObject({ outcome: 'died', room: 1 });
});

it('a cleared run levels up, consumes the map and keeps the tally', () => {
  const s = runMap(1, 1);
  expect(s.level).toBeGreaterThanOrEqual(2);
  expect(s.stash.maps).toEqual({});
  expect(s.mapTally).toEqual({ cleared: 1, lost: 0 });
  expect(s.lastRun).toMatchObject({ room: s.lastRun?.bossRoom, seen: false, gained: { xp: 184 } });   // 15 normals + 1 champion ×3 + boss ×5 = 23 × 8 XP
  expect(s.activity).toEqual({ kind: 'dig' });
});

// A run started on a tier-1 map, its first room replaced by one hand-built monster.
function started(p: Partial<MonsterState> = {}): { s: GameState; run: MapRun; m: MonsterState } {
  const s = newGame(1, 0);
  expect(startMap(s, stashMap(s, 1, 2).id)).toBe('ok');
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
/** One automatic strike, at once: the swing is due, and the step is a thousandth of a second, too short for anything else. */
function swing(s: GameState, events?: TickEvent[]): void {
  runOf(s).hitCarry = 1;
  applyTicks(s, 1, at(s, 1000), events);
}
const strikes = (events: TickEvent[]) => events.flatMap((e) => (e.kind === 'strike' ? [e] : []));

it('Isa makes monsters attack 20% slower', () => {
  const ticksToBite = (runed: boolean): number => {
    const { s } = started({ intervalS: 1 });
    if (runed) s.equipped.battle.ring = gear(s, 'ring', { sockets: 1, gems: [{ rune: 'isa' }] });
    const events: TickEvent[] = [];
    for (let t = 1; t <= 200; t++) {
      applyTicks(s, 1, at(s, 10), events);
      if (events.some((e) => e.kind === 'hurt')) return t;
    }
    return -1;
  };
  const plain = ticksToBite(false);
  const slow = ticksToBite(true);
  expect(plain).toBeGreaterThan(0);
  expect(slow).toBeGreaterThan(plain);   // the 1.25 s interval stretches the time to the first bite
});

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
    swing(s, armored);
    swing(plain, bare);
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
    swing(s, events);
    const rolled = b.damageMin + Math.floor(u1.value * (b.damageMax - b.damageMin + 1));
    const crit = u2.value < b.critChance;
    expect(strikes(events), `rng ${rng}`).toEqual([
      { kind: 'strike', amount: crit ? Math.round(rolled * b.critMultiplier) : rolled, crit },
    ]);
    checked++;
  }
  expect(checked).toBe(40);
});

it('held loot does not freeze a run', () => {
  const { s, m } = started();
  s.overflow.push(gear(s, 'helm'));
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
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 6 } });
  run.hitCarry = 0.9;
  const events: TickEvent[] = [];
  applyTicks(s, 1, at(s, 0.1), events);   // 10 s in 40 steps: every swing lands, and the run clears past the first rooms
  expect(strikes(events)).toHaveLength(10);
  expect(run.room).toBeGreaterThan(2);   // cleave chews through rooms faster than the old single-target maps did
  expect(run.hitCarry).toBeCloseTo(0.9);   // no whole swing is dropped by a room clear
});

it('the tick rate never changes how long a fight lasts', () => {
  // A tier-2 map kills a naked miner; the time it takes must not depend on how coarse the ticks are.
  const medianDeath = (rate: number) => {
    const times: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(seed, 0);
      s.level = 4;   // long enough a fight that a 10 s tick is a small part of it
      expect(startMap(s, stashMap(s, 2, 10 + seed).id)).toBe('ok');
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
  swing(s);
  expect(run.queue).toHaveLength(1);
  expect(run.monsterCarry).toBeCloseTo(0.001, 9);   // reset, then the thousandth of a second the swing's step lasted
});

it('a level-up mid-run adds the life it grants, before the room regen', () => {
  const { s, run } = started({ life: 1, xp: 10 });
  s.xp = xpToNext(1) - 1;
  run.life = 35;
  const oldMax = deriveBattleStats(s).maxLife;
  swing(s);
  expect(s.level).toBe(2);
  const newMax = deriveBattleStats(s).maxLife;
  expect(newMax).toBeGreaterThan(oldMax);
  expect(run.room).toBe(2);
  expect([oldMax, newMax, run.bossRoom]).toEqual([60, 71, 6]);
  expect(run.life).toBe(67);   // 35 + the 11 the level grants + round(71 × 1.5 / 5) = 21
  expect(run.log).toContainEqual({ kind: 'level', level: 2 });
  expect(run.gained).toMatchObject({ xp: 10, levels: 1 });
});

it('every map heals the same total: a room clear heals 1.5 × max life over the rooms before the boss', () => {
  // A naked level-1 miner has 60 life; seed 1 has 4 rooms at tier 2 metre 1, 5 at metre 2, 6 at metre 4, 7 at tier 1 metre 4.
  const cases: [number, number, number, number][] = [
    [2, 1, 5, 23],   // round(60 × 1.5 / 4) = round(22.5)
    [2, 2, 6, 18],   // 60 × 1.5 / 5
    [2, 4, 7, 15],   // 60 × 1.5 / 6
    [1, 4, 8, 13],   // round(60 × 1.5 / 7) = round(12.86)
  ];
  for (const [tier, metre, bossRoom, healed] of cases) {
    const s = newGame(1, 0);
    expect(startMap(s, stashMap(s, tier, metre).id)).toBe('ok');
    const run = runOf(s);
    expect(run.bossRoom, `metre ${metre}`).toBe(bossRoom);
    run.queue = [monster({ life: 1 })];
    run.life = 1;
    swing(s);
    expect(run.room).toBe(2);
    expect(run.life, `metre ${metre}`).toBe(1 + healed);
  }
});

it('room regen never heals past max life', () => {
  const { s, run } = started({ life: 1 });
  run.life = 59;
  swing(s);
  expect(run.room).toBe(2);
  expect(run.life).toBe(60);
});

it('a boss room past the layout still fights the boss: the queue is never empty and the run ends', () => {
  // seed 1's tier-1 dungeon at metre 11 has 6 rooms; a hand-edited boss room of 8 leaves room 7 without a layout room
  for (const bossRoom of [5, 6, 7, 8]) {
    const s = newGame(1, 0);
    expect(startMap(s, stashMap(s, 1, 11).id)).toBe('ok');
    const run = runOf(s);
    run.bossRoom = bossRoom;
    run.life = 1_000_000;
    for (let c = 0; c < 200 && s.activity.kind === 'map'; c++) {
      const m = run.queue[0];
      if (m) m.life = 1;
      swing(s);
      if (s.activity.kind === 'map') expect(run.queue.length, `boss room ${bossRoom} room ${run.room}`).toBeGreaterThan(0);
    }
    expect(s.lastRun, `boss room ${bossRoom}`).toMatchObject({ outcome: 'cleared', room: bossRoom });
  }
});

it('the run result counts every item, not only the notes the run keeps', () => {
  const { s, run } = started({ rank: 'boss', life: 1 });
  run.room = run.bossRoom;
  const note = { name: 'Old ring', rarity: 'normal', base: 'ring', outcome: 'sold', value: 1 } as const;
  run.loot = Array.from({ length: RUN_LOOT_LIMIT }, () => ({ ...note }));
  run.items = 41;
  const before = run.log.length;
  swing(s);
  const drops = run.log.slice(before).filter((l) => l.kind === 'drop' && l.note.rarity !== 'material').length;   // empty bags: one note per item; ore stacks are not items
  expect(drops).toBeGreaterThanOrEqual(2);
  expect(run.loot).toHaveLength(RUN_LOOT_LIMIT);
  expect(s.lastRun?.items).toBe(41 + drops);
});

it('a new run has counted no items', () => {
  const { run } = started();
  expect(run.items).toBe(0);
  expect(run.loot).toEqual([]);
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

it('every state of a run, tick by tick, is a valid save', () => {
  for (const seed of [1, 2, 3]) {
    for (const tier of [1, 2, 4]) {
      for (const rate of [0.1, 1, 10]) {
        for (const peacemaker of [false, true]) {
          const s = newGame(seed, 0);
          if (peacemaker) s.equipped.battle.weapon = gear(s, 'weapon', { rarity: 'legendary', name: 'The Peacemaker', uniqueId: 'peacemaker' });
          expect(startMap(s, stashMap(s, tier, 10 + seed).id)).toBe('ok');
          const stats = at(s, rate);
          for (let t = 0; t < 20_000 && s.activity.kind === 'map'; t++) {
            applyTicks(s, 1, stats);
            expect(validateState(s), `seed ${seed} tier ${tier} rate ${rate} tick ${t}`).toBe(true);
          }
          expect(s.activity.kind, `seed ${seed} tier ${tier} rate ${rate} peacemaker ${peacemaker}`).toBe('dig');
        }
      }
    }
  }
});

it('digging pauses during a run and resumes after it', () => {
  const s = newGame(1, 0);
  const map = stashMap(s, 1, 2);
  startMap(s, map.id);
  const before = { gold: s.gold, deepest: s.deepest, progress: s.progress };
  applyTicks(s, 1, deriveStats(s)); // one hit can't kill a tier-1 monster, so no kill Gold either
  expect([s.gold, s.deepest, s.progress]).toEqual([before.gold, before.deepest, before.progress]);
  expect(s.tickCount).toBe(1);
  expect(leaveMap(s)).toBe(true);
  expect(s.lastRun).toMatchObject({ outcome: 'left', room: 1 });
  expect(s.mapTally).toEqual({ cleared: 0, lost: 1 });
  applyTicks(s, 1, deriveStats(s));
  expect(s.progress).toBeGreaterThan(before.progress);
  expect(leaveMap(s)).toBe(false);
});

it('only one run at a time, and only maps that are held', () => {
  const s = newGame(1, 0);
  const a = stashMap(s, 1, 2);
  const b = stashMap(s, 1, 3);
  expect(startMap(s, 999)).toBe('invalid');
  expect(startMap(s, a.id)).toBe('ok');
  expect(startMap(s, b.id)).toBe('busy');
  expect(Object.values(s.stash.maps).flat().map((m) => m.id)).toEqual([b.id]);
});

it('pumped play and one long catch-up give the same run', () => {
  const mk = () => { const s = newGame(1, 0); startMap(s, stashMap(s, 1, 2).id); return s; };
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
  const mk = () => { const s = newGame(1, 0); startMap(s, stashMap(s, 1, 2).id); return s; };
  const pumped = mk();
  const once = mk();
  const stats = at(pumped, 0.8);
  for (let t = 250; t <= 600_000; t += 250) advance(pumped, t, stats);
  advance(once, 600_000, stats);
  expect(pumped).toEqual(once);
  expect(once.lastRun?.outcome).toBe('cleared');
  expect(once.deepest).toBeGreaterThan(0);
});

it('elemental damage adds to every hit, Armored softens only the physical part, and a crit multiplies both', () => {
  let crits = 0;
  for (let rng = 1; rng <= 2000; rng++) {
    const { s } = started({ rank: 'champion', mods: ['armored'] });
    s.equipped.battle.weapon = gear(s, 'weapon', { affixes: [{ stat: 'elementalDamage', value: 5 }] });
    s.rng = rng;
    const plain = structuredClone(s);
    runOf(plain).queue[0]?.mods.splice(0);
    plain.equipped.battle.weapon!.affixes = [];
    const armored: TickEvent[] = [];
    const bare: TickEvent[] = [];
    swing(s, armored);
    swing(plain, bare);
    const [hit] = strikes(armored);
    const [raw] = strikes(bare);
    if (hit === undefined || raw === undefined) throw new Error('no strike');
    const elemental = raw.crit ? Math.round(5 * deriveBattleStats(s).critMultiplier) : 5;
    expect(hit, `rng ${rng}`).toEqual({ ...raw, amount: Math.max(1, Math.round(raw.amount * ARMORED_TAKEN)) + elemental });
    if (raw.crit) crits++;
  }
  expect(crits).toBeGreaterThan(20);
});

it('life regeneration heals per second, capped at max life', () => {
  const { s, run } = started({ intervalS: 1000 });
  s.equipped.battle.ring = gear(s, 'ring', { affixes: [{ stat: 'lifeRegen', value: 2 }] });
  run.life = 10;
  applyTicks(s, 1, at(s, 1));   // one second, fought in four steps of 0.25 s
  expect(run.life).toBe(12);
  const { maxLife } = deriveBattleStats(s);
  run.life = maxLife - 1;
  applyTicks(s, 1, at(s, 1));
  expect(run.life).toBe(maxLife);
});

it('life regeneration heals before the monster attacks in the same step', () => {
  const { s, run } = started({ damage: 1, intervalS: 1 });
  s.equipped.battle.ring = gear(s, 'ring', { affixes: [{ stat: 'lifeRegen', value: 4 }] });   // 1 life a 0.25 s step
  run.life = 1;
  run.monsterCarry = 0.99;
  const events: TickEvent[] = [];
  applyTicks(s, 1, at(s, 4), events);
  expect(events).toContainEqual({ kind: 'hurt', amount: 1 });
  expect(s.activity.kind).toBe('map');
  expect(run.life).toBe(1);
});

it('life per kill heals on each kill, capped at max life', () => {
  const { s, run } = started({ life: 1 });
  s.equipped.battle.ring = gear(s, 'ring', { affixes: [{ stat: 'lifeOnKill', value: 5 }] });
  run.queue.push(monster());   // tough enough to survive the cleave splash, so the room stays uncleared
  run.life = 10;
  swing(s);
  expect(run.life).toBe(15);
  const { maxLife } = deriveBattleStats(s);
  run.life = maxLife - 2;
  run.queue = [monster({ life: 1 }), monster()];
  swing(s);
  expect(run.life).toBe(maxLife);
});

it('XP find raises the XP of a kill, and the kill line shows it', () => {
  const { s, run } = started({ life: 1, xp: 40 });
  s.equipped.battle.amulet = gear(s, 'amulet', { affixes: [{ stat: 'xpFind', value: 50 }] });
  run.queue.push(monster());
  swing(s);
  expect(s.xp).toBe(60);
  expect(run.gained.xp).toBe(60);
  expect(run.log).toContainEqual(expect.objectContaining({ kind: 'kill', monster: 'Test Monster', xp: 60 }));
});

const enchant = (run: MapRun, mods: MapMod[]) => { run.map.rarity = 'magic'; run.map.mods = mods; };

it('a hardened map\'s monsters take less from every strike, never below 1, with no extra draw', () => {
  for (const [elemental, plainHit, hardHit] of [[9, 10, 5], [0, 1, 1]] as const) {
    let checked = 0;
    for (let rng = 1; rng <= 200; rng++) {
      const { s, run } = started();
      // No physical damage to speak of (1 a hit), so a strike is 1 plus the elemental part. The damage% that zeroes
      // the physical sits on the amulet (global), not the weapon, whose damage% is local now.
      s.equipped.battle.weapon = gear(s, 'weapon', {
        affixes: [{ stat: 'elementalDamage', value: elemental }],
      });
      s.equipped.battle.amulet = gear(s, 'amulet', { implicit: { stat: 'damagePct', value: -100 } });
      s.rng = rng;
      const plain = structuredClone(s);
      enchant(run, [{ kind: 'hardened', tier: 10, value: 50 }]);
      const hardened: TickEvent[] = [];
      const bare: TickEvent[] = [];
      swing(s, hardened);
      swing(plain, bare);
      const [hit] = strikes(hardened);
      const [raw] = strikes(bare);
      if (hit === undefined || raw === undefined) throw new Error('no strike');
      expect(s.rng, `rng ${rng}`).toBe(plain.rng);
      expect(hit, `rng ${rng}`).toEqual({ ...raw, amount: Math.max(1, Math.round(raw.amount * 0.5)) });
      expect(run.queue[0]?.life).toBe(10_000 - hit.amount);
      if (raw.crit) continue;
      expect([raw.amount, hit.amount], `rng ${rng}`).toEqual([plainHit, hardHit]);
      checked++;
    }
    expect(checked).toBeGreaterThan(150);
  }
});

it('a map with weak healing heals less on each room clear', () => {
  const s = newGame(1, 0);
  expect(startMap(s, stashMap(s, 2, 2).id)).toBe('ok');   // 6 rooms: a plain clear heals 60 × 1.5 / 5 = 18
  const run = runOf(s);
  enchant(run, [{ kind: 'weakHealing', tier: 10, value: 50 }]);
  run.queue = [monster({ life: 1 })];
  run.life = 1;
  swing(s);
  expect(run.room).toBe(2);
  expect(run.life).toBe(1 + 9);
});

it('a saved run in progress plays out exactly as before modifiers existed', () => {
  const replay = (change?: (run: MapRun) => void) => {
    const r = decodeSave(fixture7.trim());
    if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
    const s = r.state;
    const run = runOf(s);
    change?.(run);
    const stats = deriveStats(s);
    while (s.activity.kind === 'map') applyTicks(s, 1, stats);
    return { rng: s.rng, log: run.log, gained: s.lastRun?.gained, outcome: s.lastRun?.outcome };
  };
  const played = replay();
  expect(replay((run) => { run.map.mods = []; })).toEqual(played);
  // Pinned before map modifiers touched combat; the achievement boost leaves the stream untouched (it only shifts the
  // amounts the fixture's already-earned achievements multiply).
  expect(played).toMatchObject({
    rng: 3438939776, gained: { xp: 1048, souls: 16, gold: 144, levels: 1 }, outcome: 'cleared',
  });
});

it('logging the run\'s drops and its end makes no draws: the saved run plays out as pinned', () => {
  const replay = (logsFull: boolean) => {
    const r = decodeSave(fixture7.trim());
    if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
    const s = r.state;
    const run = runOf(s);
    if (logsFull) {
      // full logs trim on every entry
      for (let i = 0; i < DROP_LOG_LIMIT; i++) s.drops.push({ ...DROP, id: s.nextId++ });
      for (let i = 0; i < DEATH_LOG_LIMIT; i++) s.deaths.push({ id: s.nextId++, tick: 0, at: 0, map: structuredClone(run.map), room: 1, bossRoom: run.bossRoom, killer: 'Bog Leech' });
    }
    const stats = deriveStats(s);
    while (s.activity.kind === 'map') applyTicks(s, 1, stats);
    return { rng: s.rng, log: run.log, gained: s.lastRun?.gained, outcome: s.lastRun?.outcome, logged: s.drops.filter((e) => e.origin.kind === 'map').length };
  };
  const played = replay(false);
  expect(played.logged).toBeGreaterThan(0);
  expect(replay(true)).toEqual(played);
  expect(played).toMatchObject({
    rng: 3438939776, gained: { xp: 1048, souls: 16, gold: 144, levels: 1 }, outcome: 'cleared',
  });
});
