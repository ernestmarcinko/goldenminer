import { expect, it } from 'vitest';
import { isGear } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { chooseGear, playReference, runReference } from '../../src/core/sim';
import type { GameState } from '../../src/core/types';
import { gear } from '../helpers/items';

const spares = (s: GameState) => s.stash.general.filter((c) => c !== null && isGear(c));

it('the reference run is deterministic', () => {
  expect(runReference({ seed: 1, minutes: 600 })).toEqual(runReference({ seed: 1, minutes: 600 }));
});

it('wears the resist chest before an elemental gate and the armour chest before a physical one', () => {
  const s = newGame(1, 0);
  s.level = 10;
  const plated = gear(s, 'armor', { implicit: { stat: 'armor', value: 200 } });
  const warded = gear(s, 'armor', { implicit: { stat: 'armor', value: 5 }, affixes: [{ stat: 'resistAll', value: 75 }] });
  s.equipped.battle.armor = plated;
  s.bag[0] = warded;

  chooseGear(s, 'elemental');
  expect(s.equipped.battle.armor?.id).toBe(warded.id);
  expect(spares(s).map((c) => c.id)).toEqual([plated.id]);   // the armour chest is kept as the spare
  expect(s.bag.every((c) => c === null)).toBe(true);

  chooseGear(s, 'physical');
  expect(s.equipped.battle.armor?.id).toBe(plated.id);
  expect(spares(s).map((c) => c.id)).toEqual([warded.id]);
});

it('keeps one spare a slot at most, and drops the rest', () => {
  const s = newGame(1, 0);
  s.level = 10;
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 200 } });
  s.bag[0] = gear(s, 'armor', { implicit: { stat: 'armor', value: 5 }, affixes: [{ stat: 'resistAll', value: 75 }] });
  s.bag[1] = gear(s, 'armor', { implicit: { stat: 'armor', value: 5 }, affixes: [{ stat: 'resistAll', value: 20 }] });
  s.bag[2] = gear(s, 'armor', { implicit: { stat: 'armor', value: 1 } });
  chooseGear(s, 'physical');
  expect(spares(s)).toHaveLength(1);
  expect(s.bag.every((c) => c === null)).toBe(true);
});

it('the raw-power player never keeps a spare; the defence-aware one does', () => {
  const raw = playReference({ seed: 1, minutes: 1440, policy: 'rawPower' });
  expect(spares(raw)).toEqual([]);
  const aware = playReference({ seed: 1, minutes: 1440 });
  expect(spares(aware).length).toBeGreaterThan(0);
});

it('records every gate it reaches, and each cleared one after its first attempt', () => {
  const report = runReference({ seed: 1, minutes: 1440 });
  expect(report.gates.length).toBeGreaterThan(0);
  expect(report.gates.map((g) => g.tier)).toEqual([...report.gates.map((g) => g.tier)].sort((a, b) => a - b));
  const cleared = report.gates.filter((g) => g.clearedDay >= 0);
  expect(cleared.length).toBeGreaterThan(0);
  for (const g of cleared) {
    expect(g.attempts).toBeGreaterThanOrEqual(1);
    expect(g.clearedDay).toBeGreaterThanOrEqual(g.firstAttemptDay);
  }
  expect(report.achievementsAtDay1).toBeGreaterThan(0);
  expect(report.achievementsAtLevel[1]).toBe(0);
  for (const level of Object.keys(report.levelDays)) expect(report.achievementsAtLevel[Number(level)]).toBeGreaterThanOrEqual(0);
});
