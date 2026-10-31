import { expect, it } from 'vitest';
import { goldPerKill } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { endRun, onKill } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { mulberry32 } from '../../src/core/rng';
import { soulUpgradeCostFor } from '../../src/core/soulUpgrade';
import { deriveStats } from '../../src/core/stats';
import type { GameState, MapItem, MapRun, MonsterState, Stats, TickEvent } from '../../src/core/types';
import { gear, stashMap } from '../helpers/items';

const runOf = (s: GameState): MapRun => {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
};

const mapOf = (s: GameState): MapItem | undefined => s.bag.find((c): c is MapItem => c?.type === 'map');

/** A sturdy normal monster that neither kills the miner in one hit nor dies to one auto hit. */
const dummy = (): MonsterState => ({
  name: 'Test Monster', species: 0, rank: 'normal', mods: [], extra: 0,
  element: 'physical', life: 1_000_000, maxLife: 1_000_000, damage: 40, intervalS: 1000, xp: 0,
});

it('Ore Baron doubles ore find and halves Gold from gold veins', () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'oreFind', value: 100 }] });
  const base = deriveStats(s);
  expect(base.oreBonusChance).toBeCloseTo(0.3);
  expect(base.goldMultiplier).toBe(1);
  s.passives.allocated = ['oreBaron'];
  const baron = deriveStats(s);
  expect(baron.oreBonusChance).toBeCloseTo(0.6);
  expect(baron.goldMultiplier).toBe(0.5);
});

it('All or Nothing triples critical hits and reduces non-critical hits by 40%', () => {
  for (let rng = 1; rng <= 3000; rng++) {
    const s = newGame(1, 0);
    s.passives.allocated = ['allOrNothing'];
    expect(startMap(s, stashMap(s, 1, 2).id)).toBe('ok');
    const run = runOf(s);
    run.queue = [dummy()];
    run.hitCarry = 1;
    s.rng = rng;
    const b = deriveBattleStats(s);
    const u1 = mulberry32(rng);
    const u2 = mulberry32(u1.state);
    const events: TickEvent[] = [];
    applyTicks(s, 1, { ...deriveStats(s), autoTicksPerSecond: 1000 }, events);
    const strike = events.find((e) => e.kind === 'strike');
    if (strike?.kind !== 'strike') throw new Error('no strike');
    const rolled = b.damageMin + Math.floor(u1.value * (b.damageMax - b.damageMin + 1));
    const crit = u2.value < b.critChance;
    const expected = crit ? Math.round(rolled * b.critMultiplier) : Math.max(1, Math.round(rolled * 0.6));
    expect(strike.amount, `rng ${rng}`).toBe(expected);
    expect(strike.crit, `rng ${rng}`).toBe(crit);
    expect(b.critMultiplier).toBeCloseTo(4.5);   // base 1.5 × 3
  }
});

it('Deep Breath triples the offline cap and cuts active dig power by a quarter', () => {
  const s = newGame(1, 0);
  const base = deriveStats(s);
  expect(base.offlineCapMs).toBe(8 * 3_600_000);
  expect(base.digPower).toBe(10);
  s.passives.allocated = ['deepBreath'];
  const breath = deriveStats(s);
  expect(breath.offlineCapMs).toBe(3 * 8 * 3_600_000);
  expect(breath.digPower).toBe(7.5);
});

it('Blood Money doubles Gold from kills and makes the miner take 25% more damage', () => {
  // Gold from a kill.
  const s = newGame(1, 0);
  s.passives.allocated = ['bloodMoney'];
  expect(startMap(s, stashMap(s, 1, 2).id)).toBe('ok');
  const run = runOf(s);
  const before = s.gold;
  onKill(s, run, { ...dummy(), rank: 'normal' }, deriveBattleStats(s));
  expect(s.gold - before).toBe(goldPerKill(1) * 2);

  // Incoming damage is a quarter higher.
  const hurt = (bloodMoney: boolean): number => {
    const t = newGame(1, 0);
    if (bloodMoney) t.passives.allocated = ['bloodMoney'];
    expect(startMap(t, stashMap(t, 1, 2).id)).toBe('ok');
    const r = runOf(t);
    r.queue = [{ ...dummy(), intervalS: 1 }];
    r.monsterCarry = 0.95;
    const events: TickEvent[] = [];
    const stats: Stats = { ...deriveStats(t), autoTicksPerSecond: 10 };
    for (let tick = 0; tick < 50 && !events.some((e) => e.kind === 'hurt'); tick++) applyTicks(t, 1, stats, events);
    const e = events.find((x) => x.kind === 'hurt');
    if (e?.kind !== 'hurt') throw new Error('the monster never attacked');
    return e.amount;
  };
  expect(hurt(false)).toBe(40);
  expect(hurt(true)).toBe(50);
});

it('Soul Debt prices Soul upgrades at 75% and a death costs 10% of current Souls', () => {
  const s = newGame(1, 0);
  s.passives.allocated = ['soulDebt'];
  expect(soulUpgradeCostFor(s, 6)).toBe(135);   // 180 × 0.75
  expect(soulUpgradeCostFor(s, 7)).toBe(184);   // 245 × 0.75, rounded
  const plain = newGame(1, 0);
  expect(soulUpgradeCostFor(plain, 6)).toBe(180);

  const dead = newGame(1, 0);
  dead.souls = 1000;
  dead.passives.allocated = ['soulDebt'];
  expect(startMap(dead, stashMap(dead, 1, 2).id)).toBe('ok');
  endRun(dead, runOf(dead), 'died', undefined, 'Mole Rat');
  expect(dead.souls).toBe(900);

  const spared = newGame(1, 0);
  spared.souls = 1000;
  expect(startMap(spared, stashMap(spared, 1, 2).id)).toBe('ok');
  endRun(spared, runOf(spared), 'died', undefined, 'Mole Rat');
  expect(spared.souls).toBe(1000);
});

it("Prospector's Eye doubles chest find and finds maps one tier lower", () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: 50 }] });
  const base = deriveStats(s);
  expect(base.featureChances.chest).toBeCloseTo(0.09);
  s.passives.allocated = ['prospectorsEye'];
  const eye = deriveStats(s);
  expect(eye.featureChances.chest).toBeCloseTo(0.12);

  // metre 51 sits in tier 2 (Clay Beds); Prospector's Eye finds it as a tier-1 map.
  const digTier = (prospectorsEye: boolean): number | undefined => {
    const t = newGame(3, 0);
    if (prospectorsEye) t.passives.allocated = ['prospectorsEye'];
    t.deepest = 50;
    t.ahead = { 51: { feature: 'map', amount: 0, hardRock: false } };
    const stats = deriveStats(t);
    while (t.deepest < 51) applyTicks(t, 1, stats);
    return mapOf(t)?.tier;
  };
  expect(digTier(false)).toBe(2);
  expect(digTier(true)).toBe(1);
});
