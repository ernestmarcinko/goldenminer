import { expect, it } from 'vitest';
import { deriveBattleStats, mitigate, armorReduction } from '../../src/core/battle';
import { rollRarity } from '../../src/core/itemGen';
import { gainXp, xpToNext } from '../../src/core/levels';
import { monsterState } from '../../src/core/monsters';
import { MAX_DAMAGE, MAX_LIFE, MIN_RESIST, baseResist, monsterXp } from '../../src/core/balance';
import { dungeonLayout } from '../../src/core/dungeons';
import { startMap } from '../../src/core/maps';
import { validateState } from '../../src/core/save';
import { newGame } from '../../src/core/newGame';
import type { Slot, StatKey } from '../../src/core/items';
import type { ChampionMod } from '../../src/core/types';
import { gear, stashMap } from '../helpers/items';

it('a naked level-1 miner', () => {
  expect(deriveBattleStats(newGame(1, 0))).toEqual({
    maxLife: 60, damageMin: 3, damageMax: 6, attacksPerSecond: 1, critChance: 0.05, critMultiplier: 1.5,
    armor: 0, resistAll: 0, maxResist: 75, baseResist: 0, soulMultiplier: 1, magicFindMultiplier: 1,
    elementalDamage: 0, lifeRegen: 0, lifeOnKill: 0, xpMultiplier: 1, cleave: 0.25,
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

it("a weapon's damage% raises the weapon's own damage, not the global pool", () => {
  const s = newGame(1, 0);
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 10 }, affixes: [{ stat: 'damagePct', value: 100 }] });
  s.equipped.battle.amulet = gear(s, 'amulet', { implicit: { stat: 'damagePct', value: 100 } });
  const b = deriveBattleStats(s);
  // the weapon's +100% is local: 10 × 2 = 20; the amulet's +100% is global, over base + weapon
  expect(b.damageMin).toBe(46);   // round((3 + 20) × 2)
  expect(b.damageMax).toBe(52);   // round((6 + 20) × 2)
});

it("an armor's armor% raises its own flat first, then a global armor% applies on top", () => {
  const s = newGame(1, 0);
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 }, affixes: [{ stat: 'armorPct', value: 50 }] });
  expect(deriveBattleStats(s).armor).toBe(45);   // 30 × 1.5
  s.equipped.battle.helm = gear(s, 'helm', { affixes: [{ stat: 'armorPct', value: 20 }] });
  expect(deriveBattleStats(s).armor).toBe(54);   // (30 × 1.5 + 0) × 1.2
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
  expect(mitigate(10, 'physical', { ...b, armor: 100 }, 1)).toBe(5);
  expect(mitigate(10, 'elemental', { ...b, resistAll: 75 }, 1)).toBe(3);
  expect(mitigate(4, 'physical', { ...b, armor: 1_000_000 }, 1)).toBe(1);
  expect(mitigate(100, 'physical', { ...b, armor: 1_000_000 }, 1)).toBe(5);
  expect(mitigate(10, 'physical', b, 1)).toBe(10);
});

it('armor reduction is a level-scaled curve capped at 95 %', () => {
  expect(armorReduction(0, 1, 100)).toBe(0);
  expect(armorReduction(100, 1, 10)).toBe(100 / (100 + 10 * 10));   // level 1 is the old armor / (armor + 10·raw)
  expect(armorReduction(100, 100, 10)).toBe(100 / (100 + (10 + 0.25 * 99) * 10));   // level 100 needs more armor
  expect(armorReduction(100, 100, 10)).toBeLessThan(armorReduction(100, 1, 10));
  expect(armorReduction(1_000_000, 1, 100)).toBe(0.95);   // the cap
  // monotone in armor
  const levels = [1, 25, 50, 100];
  for (const level of levels) {
    let prev = 0;
    for (let a = 0; a <= 10_000; a += 500) {
      const now = armorReduction(a, level, 100);
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
  }
});

it('elemental resist is taxed by level and can be raised past the base cap', () => {
  expect(baseResist(1)).toBe(0);
  expect(baseResist(50)).toBe(-49);
  expect(baseResist(100)).toBe(-99);
  const naked = newGame(1, 0);
  naked.level = 50;
  const naked50 = deriveBattleStats(naked);
  expect(naked50.baseResist).toBe(-49);
  expect(naked50.resistAll).toBe(-49);
  expect(naked50.maxResist).toBe(75);
  // 130 resistAll of gear reaches the 75 % cap at level 50 (130 − 49 = 81, clamped to 75).
  naked.equipped.battle.helm = gear(naked, 'helm', { affixes: [{ stat: 'resistAll', value: 130 }] });
  const capped = deriveBattleStats(naked);
  expect(capped.resistAll).toBe(75);
  // +20 maxResist raises the cap to 95, so 130 resistAll now reads 81.
  naked.equipped.battle.ring = gear(naked, 'ring', { affixes: [{ stat: 'maxResist', value: 20 }] });
  const raised = deriveBattleStats(naked);
  expect(raised.maxResist).toBe(95);
  expect(raised.resistAll).toBe(81);
  // the cap never exceeds 95 however large the affix, and resist never drops below MIN_RESIST.
  naked.equipped.battle.amulet = gear(naked, 'amulet', { affixes: [{ stat: 'maxResist', value: 1_000_000 }] });
  expect(deriveBattleStats(naked).maxResist).toBe(95);
  const low = newGame(1, 0);
  low.level = 100;
  low.equipped.battle.helm = gear(low, 'helm', { affixes: [{ stat: 'resistAll', value: -1_000_000 }] });
  expect(deriveBattleStats(low).resistAll).toBe(MIN_RESIST);
});

it('xp levels the miner up to the cap', () => {
  // Levels 1–30 keep the tuned early curve; past 30 a second ramp stage carries the cost up to the 100 cap.
  expect([1, 2, 10, 30].map(xpToNext)).toEqual([100, 283, 3162, 24_648]);
  expect(xpToNext(99)).toBeGreaterThan(0);
  expect(xpToNext(100)).toBe(0);
  const s = newGame(1, 0);
  expect(gainXp(s, 383)).toBe(2);
  expect([s.level, s.xp]).toEqual([3, 0]);
  s.level = 99; s.xp = xpToNext(99) - 1;
  expect(gainXp(s, 1)).toBe(1);
  expect([s.level, s.xp]).toEqual([100, 0]);
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
  // tier 1's monsters are scaled × 1.38, tier 2's × 1.34 (MAP_MONSTER_SCALE)
  expect(monsterState(1, rat)).toMatchObject({ life: 17, maxLife: 17, damage: 4, intervalS: 2, xp: 8, element: 'physical' });
  const champ = { ...rat, rank: 'champion' as const, name: 'Gorvash the Hollow', mods: ['thickSkinned', 'fireTouched'] as ChampionMod[] };
  expect(monsterState(1, champ)).toMatchObject({ life: 75, damage: 7, xp: 24, element: 'elemental' });
  const swift = monsterState(1, { ...champ, mods: ['swift', 'brutal'] });
  expect(swift.intervalS).toBeCloseTo(2 / 1.4);
  expect(swift.damage).toBe(10);
  expect(monsterState(1, { ...rat, rank: 'boss' })).toMatchObject({ life: 83, damage: 7, xp: 40 });
  const slime = { species: 1, rank: 'normal' as const, name: 'Mud Slime', mods: [], extra: 1 };
  // re-pinned for Plan 10's tier-2 scale (was life 78, damage 9)
  expect(monsterState(2, slime)).toMatchObject({ element: 'elemental', life: 49, damage: 6, xp: 23, intervalS: 2 });
  expect([monsterXp(2), monsterXp(4), monsterXp(10)]).toEqual([23, 64, 253]);
});

it('monster numbers stop at the save limits, however deep the tier', () => {
  // Unclamped, a tier-2,000 Bone Crawler boss would have 2,200,349 life and a tier-100,000 brutal champion would hit for 4,640,631.
  for (const tier of [2_000, 100_000]) {
    for (const rank of ['normal', 'champion', 'boss'] as const) {
      const m = monsterState(tier, { species: 0, rank, name: 'Deep One', mods: rank === 'champion' ? ['thickSkinned', 'brutal'] : [], extra: 1 });
      expect(m.maxLife, `tier ${tier} ${rank}`).toBeLessThanOrEqual(MAX_LIFE);
      expect(m.life).toBe(m.maxLife);
      expect(m.damage, `tier ${tier} ${rank}`).toBeLessThanOrEqual(MAX_DAMAGE);
    }
    expect(monsterState(tier, { species: 0, rank: 'boss', name: 'Deep One', mods: [], extra: 1 }).maxLife).toBe(MAX_LIFE);
  }
  expect(monsterState(100_000, { species: 0, rank: 'champion', name: 'Deep One', mods: ['brutal'], extra: 1 }).damage).toBe(MAX_DAMAGE);
  // and a run started that deep is a valid save, its boss included
  for (const tier of [2_000, 100_000]) {
    const s = newGame(1, 0);
    expect(startMap(s, stashMap(s, tier, 5).id)).toBe('ok');
    expect(validateState(s), `tier ${tier}`).toBe(true);
    if (s.activity.kind !== 'map') throw new Error('no run');
    const run = s.activity.run;
    run.room = run.bossRoom;
    run.queue = [monsterState(tier, dungeonLayout(s.seed, run.map).boss)];
    expect(validateState(s), `tier ${tier} boss`).toBe(true);
  }
});

it('magic find raises the better rarities', () => {
  const s = newGame(4, 0);
  const n = 20_000;
  const rares = Array.from({ length: n }, () => rollRarity(s, 3)).filter((r) => r === 'rare').length / n;
  expect(rares).toBeGreaterThan(0.14);
  expect(rares).toBeLessThan(0.16);
});

it('percent life and percent armor multiply their flat totals, and critical damage raises the crit multiplier', () => {
  const s = newGame(1, 0);
  s.level = 5;   // 50 + 10 × 5 = 100 base life
  s.equipped.battle.helm = gear(s, 'helm', { implicit: { stat: 'lifePct', value: 50 } });
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 }, affixes: [{ stat: 'armorPct', value: 20 }] });
  s.equipped.battle.ring = gear(s, 'ring', { implicit: { stat: 'critMultiplier', value: 30 } });
  const b = deriveBattleStats(s);
  expect(b.maxLife).toBe(150);
  expect(b.armor).toBe(36);
  expect(b.critMultiplier).toBeCloseTo(1.8);
});

it('elemental damage, life regeneration, life per kill and XP come from battle gear', () => {
  const s = newGame(1, 0);
  s.equipped.battle.weapon = gear(s, 'weapon', { affixes: [{ stat: 'elementalDamage', value: 5 }] });
  s.equipped.battle.ring = gear(s, 'ring', { affixes: [{ stat: 'lifeRegen', value: 2 }, { stat: 'lifeOnKill', value: 5 }] });
  s.equipped.battle.amulet = gear(s, 'amulet', { affixes: [{ stat: 'xpFind', value: 50 }] });
  expect(deriveBattleStats(s)).toMatchObject({ elementalDamage: 5, lifeRegen: 2, lifeOnKill: 5, xpMultiplier: 1.5 });
});

it('allocated battle passives add to the derived battle stats', () => {
  const s = newGame(1, 0);
  const before = deriveBattleStats(s);
  s.passives.allocated = ['thickSkin', 'sharpened'];
  const after = deriveBattleStats(s);
  expect(after.maxLife).toBe(Math.round(before.maxLife * 1.15));
  expect(after.damageMin).toBe(Math.round(before.damageMin * 1.15));
  expect(after.damageMax).toBe(Math.round(before.damageMax * 1.15));
});

it('Berserker, Soul Reaper and Bulwark trade off', () => {
  const s = newGame(1, 0);
  const base = deriveBattleStats(s);
  s.passives.allocated = ['berserker'];
  const berserk = deriveBattleStats(s);
  expect(berserk.armor).toBe(0);
  expect(berserk.damageMin).toBe(Math.round(base.damageMin * 1.5));
  s.passives.allocated = ['soulReaper'];
  const reaper = deriveBattleStats(s);
  expect(reaper.soulMultiplier).toBe(base.soulMultiplier * 2);
  expect(reaper.maxLife).toBe(Math.round(base.maxLife * 0.8));
  s.passives.allocated = ['bulwark'];
  const wall = deriveBattleStats(s);
  expect(wall.damageMin).toBe(Math.round(base.damageMin * 0.75));
});
