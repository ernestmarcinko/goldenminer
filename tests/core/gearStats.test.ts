import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveCharacterSheet, deriveStats, gearTotals, itemTotals, localTotals } from '../../src/core/stats';
import type { SheetRow } from '../../src/core/stats';
import { deriveBattleStats, armorReduction } from '../../src/core/battle';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import { MAX_HAZARD_WARD, MAX_ORE_BONUS_CHANCE, monsterDamageBase } from '../../src/core/balance';
import { MINING_STATS } from '../../src/core/items';
import { metreTier } from '../../src/core/bands';
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
  const weapon = s.equipped.battle.weapon;
  if (weapon === undefined) throw new Error('weapon not equipped');
  expect(deriveStats(s)).toEqual(deriveStats(newGame(1, 0)));
  expect(gearTotals(s, 'battle').damage).toBe(0);   // a weapon's damage is local, not global
  expect(localTotals(weapon).local.damage).toBe(14);
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

it('percent dig power multiplies the base and the flat dig power', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 4 }, affixes: [{ stat: 'digPowerPct', value: 50 }] });
  expect(deriveStats(s).digPower).toBe(21);
});

it("a pickaxe's dig power% raises the base and the pickaxe's own flat, not another slot's dig power", () => {
  const s = newGame(1, 0);
  // the pickaxe's 4 dig power and 50% are local; the gloves' 10 dig power is global
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 4 }, affixes: [{ stat: 'digPowerPct', value: 50 }] });
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat: 'digPower', value: 10 }] });
  // local: (10 + 4) × 1.5 = 21; then + 10 global flat = 31
  expect(deriveStats(s).digPower).toBe(31);
});

it('the new mining modifiers become multipliers and the ore bonus chance', () => {
  const bare = deriveStats(newGame(1, 0));
  expect(bare).toMatchObject({ veinMultiplier: 1, oreBonusChance: 0, sellMultiplier: 1, salvageMultiplier: 1 });
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'veinYield', value: 20 }, { stat: 'oreFind', value: 100 }] });
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat: 'sellBonus', value: 50 }, { stat: 'salvageYield', value: 100 }] });
  const st = deriveStats(s);
  expect(st.veinMultiplier).toBeCloseTo(1.2);
  expect(st.oreBonusChance).toBeCloseTo(0.3);
  expect(st.sellMultiplier).toBeCloseTo(1.5);
  expect(st.salvageMultiplier).toBeCloseTo(2);
});

it('the ore bonus chance is capped and never negative', () => {
  const s = newGame(1, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'oreFind', value: 1000 }] });
  expect(deriveStats(s).oreBonusChance).toBe(MAX_ORE_BONUS_CHANCE);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'oreFind', value: -50 }] });
  expect(deriveStats(s).oreBonusChance).toBe(0);
});

it('allocated mining passives add to the derived stats', () => {
  const s = newGame(1, 0);
  const before = deriveStats(s);
  s.passives.allocated = ['veinSense', 'prospector'];
  const after = deriveStats(s);
  expect(after.featureChances.chest).toBeCloseTo(before.featureChances.chest * 1.15, 6);
  expect(after.diamondMultiplier).toBeCloseTo(before.diamondMultiplier * 1.2, 6);
});

it('allocated ascendancy stats add to the derived mining stats', () => {
  const s = newGame(1, 0);
  const before = deriveStats(s);
  const gold = ASCENDANCY_NODES.find((n) => n.kind === 'small' &&
    n.effects.some((e) => e.kind === 'stat' && e.stat === 'goldYield'));
  if (gold === undefined) throw new Error('no gold-yield ascendancy small');
  const value = gold.effects.reduce(
    (sum, e) => sum + (e.kind === 'stat' && e.stat === 'goldYield' ? e.value : 0), 0);
  expect(value).toBeGreaterThan(0);
  s.ascendancy.allocated = [gold.id];   // deriveStats does not check adjacency
  expect(deriveStats(s).goldMultiplier).toBeCloseTo(before.goldMultiplier * (1 + value / 100), 6);
});

it('Earthshaker digs three times per click but a third slower automatically', () => {
  const s = newGame(1, 0);
  const base = deriveStats(s);
  s.passives.allocated = ['earthshaker'];
  const shaker = deriveStats(s);
  expect(shaker.ticksPerClick).toBe(base.ticksPerClick * 3);
  expect(shaker.autoTicksPerSecond).toBeCloseTo(base.autoTicksPerSecond * 0.7, 6);
});

it("Prospector's Luck trades Gold for Diamonds", () => {
  const s = newGame(1, 0);
  const base = deriveStats(s);
  s.passives.allocated = ['prospectorsLuck'];
  const after = deriveStats(s);
  expect(after.diamondMultiplier).toBeCloseTo(base.diamondMultiplier * 1.5, 6);
  expect(after.goldMultiplier).toBeCloseTo(base.goldMultiplier * 0.8, 6);
});

it('the character sheet reads the derived values, never a parallel sum', () => {
  const s = newGame(1, 0);
  s.level = 7;
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { implicit: { stat: 'digPower', value: 8 }, affixes: [{ stat: 'digPowerPct', value: 50 }] });
  s.equipped.mining.gloves = gear(s, 'gloves', { affixes: [{ stat: 'goldYield', value: 40 }] });
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 12 }, affixes: [{ stat: 'damagePct', value: 50 }, { stat: 'critChance', value: 10 }] });
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 30 }, affixes: [{ stat: 'armorPct', value: 20 }] });
  const sheet = deriveCharacterSheet(s);
  const mining = deriveStats(s);
  const battle = deriveBattleStats(s);
  const row = (rows: readonly SheetRow[], label: string) => rows.find((r) => r.label === label);
  const at = (rows: readonly SheetRow[], label: string) => {
    const r = row(rows, label);
    if (r === undefined) throw new Error(`no ${label} row`);
    return r.value;
  };
  expect(at(sheet.mining, 'Dig power')).toBe(mining.digPower);
  expect(at(sheet.mining, 'Ticks per click')).toBe(mining.ticksPerClick);
  expect(at(sheet.mining, 'Auto ticks')).toBe(mining.autoTicksPerSecond);
  expect(at(sheet.mining, 'Offline cap')).toBe(mining.offlineCapMs);
  expect(at(sheet.mining, 'Hazard ward')).toBe(mining.hazardWard);
  expect(at(sheet.mining, 'Gold yield')).toBe(mining.goldMultiplier);
  expect(at(sheet.mining, 'Diamond yield')).toBe(mining.diamondMultiplier);
  expect(at(sheet.mining, 'Vein yield')).toBe(mining.veinMultiplier);
  expect(at(sheet.mining, 'Chest find')).toBe(mining.featureChances.chest * 100);
  expect(at(sheet.mining, 'Gem find')).toBe(mining.featureChances.gem * 100);
  expect(at(sheet.mining, 'Map find')).toBe(mining.featureChances.map * 100);
  expect(at(sheet.mining, 'Ore bonus')).toBe(mining.oreBonusChance * 100);
  expect(at(sheet.mining, 'Sell')).toBe(mining.sellMultiplier);
  expect(at(sheet.mining, 'Salvage')).toBe(mining.salvageMultiplier);
  const dmg = row(sheet.battle, 'Damage');
  if (dmg === undefined || dmg.value2 === undefined) throw new Error('no Damage range');
  expect([dmg.value, dmg.value2]).toEqual([battle.damageMin, battle.damageMax]);
  expect(at(sheet.battle, 'Attack speed')).toBe(battle.attacksPerSecond);
  expect(at(sheet.battle, 'Crit chance')).toBe(battle.critChance * 100);
  expect(at(sheet.battle, 'Crit multiplier')).toBe(battle.critMultiplier);
  expect(at(sheet.battle, 'Elemental damage')).toBe(battle.elementalDamage);
  expect(at(sheet.battle, 'Life')).toBe(battle.maxLife);
  expect(at(sheet.battle, 'Armor')).toBe(battle.armor);
  expect(at(sheet.battle, 'Resistances')).toBe(battle.resistAll);
  expect(at(sheet.battle, 'Life regen')).toBe(battle.lifeRegen);
  expect(at(sheet.battle, 'Life on kill')).toBe(battle.lifeOnKill);
  expect(at(sheet.battle, 'XP find')).toBe(battle.xpMultiplier);
  expect(at(sheet.battle, 'Magic find')).toBe(battle.magicFindMultiplier);
  expect(at(sheet.battle, 'Soul find')).toBe(battle.soulMultiplier);
});

it('the sheet DPS is the mean hit times attacks per second times the crit factor', () => {
  const s = newGame(1, 0);
  s.equipped.battle.weapon = gear(s, 'weapon', { implicit: { stat: 'damage', value: 10 }, affixes: [{ stat: 'attackSpeed', value: 50 }, { stat: 'critChance', value: 10 }] });
  const battle = deriveBattleStats(s);
  const dps = (battle.damageMin + battle.damageMax) / 2 * battle.attacksPerSecond
    * (1 + battle.critChance * (battle.critMultiplier - 1));
  const row = deriveCharacterSheet(s).battle.find((r) => r.label === 'DPS');
  if (row === undefined) throw new Error('no DPS row');
  expect(row.value).toBe(dps);
});

it('the sheet armor reduction is the same formula the combat code mitigates with', () => {
  const s = newGame(1, 0);
  s.equipped.battle.armor = gear(s, 'armor', { implicit: { stat: 'armor', value: 120 } });
  const battle = deriveBattleStats(s);
  const raw = monsterDamageBase(metreTier(s.deepest + 1));
  const row = deriveCharacterSheet(s).battle.find((r) => r.label === 'Armor reduction');
  if (row === undefined) throw new Error('no Armor reduction row');
  expect(row.value).toBe(armorReduction(battle.armor, raw) * 100);
});
