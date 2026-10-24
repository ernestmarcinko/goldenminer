import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats, gearTotals, itemTotals } from '../../src/core/stats';
import { MAX_HAZARD_WARD } from '../../src/core/balance';
import { MINING_STATS } from '../../src/core/items';
import { gear, gem } from '../helpers/items';

it('no gear means the Plan 1 base stats', () => {
  expect(deriveStats(newGame(1, 0))).toMatchObject({
    digPower: 10, autoTicksPerSecond: 1, ticksPerClick: 1, lampSight: 3, offlineCapMs: 28_800_000,
    goldMultiplier: 1, diamondMultiplier: 1,
  });
});

it('the worn mining set adds to the base', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'goldYield', value: 50 }] });
  s.equipped.mining.lamp = gear(s, 'lamp', { implicit: { stat: 'lampSight', value: 30 } });
  s.equipped.mining.gloves = gear(s, 'gloves', { implicit: { stat: 'goldYield', value: 10 }, affixes: [{ stat: 'autoTickRate', value: 10 }, { stat: 'ticksPerClick', value: 1 }] });
  s.equipped.mining.boots = gear(s, 'boots', { implicit: { stat: 'offlineCap', value: 60 }, affixes: [{ stat: 'chestFind', value: 100 }, { stat: 'diamondYield', value: 25 }] });
  const st = deriveStats(s);
  expect(st.digPower).toBe(18);
  expect(st.goldMultiplier).toBeCloseTo(1.6);
  expect(st.diamondMultiplier).toBeCloseTo(1.25);
  expect(st.lampSight).toBe(20);
  expect(st.autoTicksPerSecond).toBeCloseTo(1.1);
  expect(st.ticksPerClick).toBe(2);
  expect(st.offlineCapMs).toBe(9 * 3_600_000);
  expect(st.featureChances.chest).toBeCloseTo(0.12);
  expect(st.featureChances.goldVein).toBe(0.12);
});

it('battle gear leaves digging alone', () => {
  const s = newGame(1, 0);
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 14 } });
  expect(deriveStats(s)).toEqual(deriveStats(newGame(1, 0)));
  expect(gearTotals(s, 'battle').damage).toBe(14);
  expect(gearTotals(s, 'mining').digPower).toBe(0);
});

it('a gem counts with the stat of the set it sits in', () => {
  const s = newGame(1, 0);
  const pick = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 4 }, sockets: 1, gems: [gem(s, 'ruby')] });
  s.equipped.mining.pickaxe = pick;
  s.equipped.battle.helm = gear(s, 'helm', { implicit: { stat: 'life', value: 20 }, sockets: 1, gems: [gem(s, 'ruby')] });
  expect(itemTotals(pick)).toEqual({ digPower: 4, goldYield: 7 });
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(1.07);
  expect(gearTotals(s, 'battle').damagePct).toBe(7);
});

it('find chances are capped together and never go below zero', () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: 2000 }] });
  const capped = deriveStats(s).featureChances;
  expect(Object.values(capped).reduce((a, b) => a + b, 0)).toBeCloseTo(0.9);
  expect(capped.chest / capped.goldVein).toBeCloseTo(10.5);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: -200 }] });
  expect(deriveStats(s).featureChances.chest).toBe(0);
});

it('absurd gear totals are clamped to sane bounds', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 1_000_000 }, affixes: [{ stat: 'autoTickRate', value: 1_000_000 }, { stat: 'ticksPerClick', value: 1_000_000 }, { stat: 'offlineCap', value: 1_000_000 }] });
  expect(deriveStats(s)).toMatchObject({ digPower: 5000, autoTicksPerSecond: 10, ticksPerClick: 10, offlineCapMs: 48 * 3_600_000 });
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: -1_000_000 }, affixes: [{ stat: 'lampSight', value: -1_000_000 }, { stat: 'ticksPerClick', value: -1_000_000 }, { stat: 'offlineCap', value: -1_000_000 }] });
  expect(deriveStats(s)).toMatchObject({ digPower: 1, lampSight: 0, ticksPerClick: 1, offlineCapMs: 3_600_000 });
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { affixes: [{ stat: 'autoTickRate', value: -1_000_000 }] });
  expect(deriveStats(s).autoTicksPerSecond).toBe(0.1);
});

it('hazard ward rolls on mining gear and adds up, capped', () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'hazardWard', value: 40 }] });
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat: 'hazardWard', value: 40 }] });
  expect(deriveStats(s).hazardWard).toBe(MAX_HAZARD_WARD);
  expect(MINING_STATS).toContain('hazardWard');
});
