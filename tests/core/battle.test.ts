import { expect, it } from 'vitest';
import { deriveBattleStats, mitigate } from '../../src/core/battle';
import { rollRarity } from '../../src/core/itemGen';
import { gainXp, xpToNext } from '../../src/core/levels';
import { monsterState } from '../../src/core/monsters';
import { monsterXp } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';
import type { Slot, StatKey } from '../../src/core/items';
import type { ChampionMod } from '../../src/core/types';
import { gear } from '../helpers/items';

it('a naked level-1 miner', () => {
  expect(deriveBattleStats(newGame(1, 0))).toEqual({
    maxLife: 60, damageMin: 3, damageMax: 6, attacksPerSecond: 1, critChance: 0.05, critMultiplier: 1.5,
    armor: 0, resistAll: 0, soulMultiplier: 1, magicFindMultiplier: 1,
  });
});

it('battle gear and level add up', () => {
  const s = newGame(1, 0);
  s.level = 10;
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 14 }, affixes: [{ stat: 'attackSpeed', value: 20 }] });
  s.equipped.battle.amulet = gear(s, 'amulet', { implicit: { stat: 'damagePct', value: 50 } });
  s.equipped.battle.ring = gear(s, 'ring', { implicit: { stat: 'critChance', value: 5 } });
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 }, affixes: [{ stat: 'resistAll', value: 90 }] });
  s.equipped.battle.helm = gear(s, 'helm', { implicit: { stat: 'life', value: 40 }, affixes: [{ stat: 'soulFind', value: 50 }] });
  expect(deriveBattleStats(s)).toMatchObject({ maxLife: 190, damageMin: 39, damageMax: 57, attacksPerSecond: 1.2, critChance: 0.1, armor: 30, resistAll: 75, soulMultiplier: 1.5 });
});

it('each battle stat stops at its limit', () => {
  const stat = (key: StatKey, value: number, slot: Slot) => {
    const s = newGame(1, 0);
    s.equipped.battle[slot] = gear(s, slot, { implicit: { stat: key, value }, affixes: [] });
    return deriveBattleStats(s);
  };
  expect(stat('critChance', 200, 'ring').critChance).toBe(0.75);
  expect(stat('attackSpeed', 1000, 'weapon').attacksPerSecond).toBe(5);
  expect(stat('attackSpeed', -1000, 'weapon').attacksPerSecond).toBe(0.2);
  expect(stat('damagePct', -150, 'amulet')).toMatchObject({ damageMin: 1, damageMax: 1 });
  expect(stat('magicFind', 50, 'helm').magicFindMultiplier).toBe(1.5);
});

it('armor and resistance soften hits', () => {
  const b = deriveBattleStats(newGame(1, 0));
  expect(mitigate(10, 'physical', { ...b, armor: 100 })).toBe(5);
  expect(mitigate(10, 'elemental', { ...b, resistAll: 75 })).toBe(3);
  expect(mitigate(4, 'physical', { ...b, armor: 1_000_000 })).toBe(1);
  expect(mitigate(100, 'physical', { ...b, armor: 1_000_000 })).toBe(10);
  expect(mitigate(10, 'physical', b)).toBe(10);
});

it('xp levels the miner up to the cap', () => {
  expect([1, 2, 10, 59].map(xpToNext)).toEqual([100, 283, 3162, 45_319]);
  expect(xpToNext(60)).toBe(0);
  const s = newGame(1, 0);
  expect(gainXp(s, 383)).toBe(2);
  expect([s.level, s.xp]).toEqual([3, 0]);
  s.level = 59; s.xp = 45_000;
  expect(gainXp(s, 1_000)).toBe(1);
  expect([s.level, s.xp]).toEqual([60, 0]);
  expect(gainXp(s, 5_000)).toBe(0);
});

it('xp past a level carries over', () => {
  const s = newGame(1, 0);
  expect(gainXp(s, 150)).toBe(1);
  expect([s.level, s.xp]).toEqual([2, 50]);
  expect(gainXp(s, 400)).toBe(1);   // 450 total, 283 to leave level 2
  expect([s.level, s.xp]).toEqual([3, 167]);
  const t = newGame(1, 0);
  expect(gainXp(t, 100 + 283 + 520 + 99)).toBe(3);   // levels 1, 2 and 3 cost 100, 283 and 520
  expect([t.level, t.xp]).toEqual([4, 99]);
});

it('xp that is negative or not a number is ignored', () => {
  const s = newGame(1, 0);
  for (const amount of [-50, NaN, Infinity]) expect(gainXp(s, amount)).toBe(0);
  expect([s.level, s.xp]).toEqual([1, 0]);
});

it('monster numbers by rank and modifier', () => {
  const rat = { species: 0, rank: 'normal' as const, name: 'Mole Rat', mods: [], extra: 1 };
  expect(monsterState(1, rat)).toMatchObject({ life: 12, maxLife: 12, damage: 3, intervalS: 2, xp: 10, element: 'physical' });
  const champ = { ...rat, rank: 'champion' as const, name: 'Gorvash the Hollow', mods: ['thickSkinned', 'fireTouched'] as ChampionMod[] };
  expect(monsterState(1, champ)).toMatchObject({ life: 54, damage: 5, xp: 30, element: 'elemental' });
  const swift = monsterState(1, { ...champ, mods: ['swift', 'brutal'] });
  expect(swift.intervalS).toBeCloseTo(2 / 1.4);
  expect(swift.damage).toBe(7);
  expect(monsterState(1, { ...rat, rank: 'boss' })).toMatchObject({ life: 60, damage: 5, xp: 50 });
  const slime = { species: 1, rank: 'normal' as const, name: 'Mud Slime', mods: [], extra: 1 };
  expect(monsterState(2, slime)).toMatchObject({ element: 'elemental', life: 37, damage: 4, xp: 28, intervalS: 2 });
  expect([monsterXp(2), monsterXp(4), monsterXp(10)]).toEqual([28, 80, 316]);
});

it('magic find raises the better rarities', () => {
  const s = newGame(4, 0);
  const n = 20_000;
  const rares = Array.from({ length: n }, () => rollRarity(s, 3)).filter((r) => r === 'rare').length / n;
  expect(rares).toBeGreaterThan(0.14);
  expect(rares).toBeLessThan(0.16);
});
