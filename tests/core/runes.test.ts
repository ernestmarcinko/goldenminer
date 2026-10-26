import { expect, it } from 'vitest';
import { RUNE_DROP_CHANCE } from '../../src/core/balance';
import { newGame } from '../../src/core/newGame';
import { rollGem, rollGemOrRune, rollRune } from '../../src/core/itemGen';
import { RUNE_TYPES, type RuneType } from '../../src/core/items';
import { nextRandom } from '../../src/core/rng';
import {
  RUNE_DESCRIPTIONS, RUNE_EFFECTS, RUNE_LABELS, runeName, runeTotals, runeWeights,
  type RuneFlag, type RuneStat,
} from '../../src/core/runes';
import { deriveBattleStats } from '../../src/core/battle';
import { deriveStats } from '../../src/core/stats';
import { gear } from '../helpers/items';

const RUNE_STATS: readonly RuneStat[] = ['gold', 'digPower', 'damage', 'autoTicks', 'souls', 'xp', 'critMultiplier'];
const RUNE_FLAGS: readonly RuneFlag[] = ['ignoreHardRock', 'hazardImmune', 'extraChest', 'slowMonsters'];

it('the catalogue is exactly ten special runes, each a multiplicative factor or a flag', () => {
  expect(RUNE_TYPES).toHaveLength(10);
  expect(RUNE_TYPES).toEqual(['fehu', 'uruz', 'thurisaz', 'ansuz', 'raidho', 'kenaz', 'gebo', 'wunjo', 'hagalaz', 'isa']);
  for (const rune of RUNE_TYPES) {
    const label = RUNE_LABELS[rune];
    const effect = RUNE_EFFECTS[rune];
    expect(label, rune).toBeTruthy();
    expect(effect, rune).toBeTruthy();
    expect(RUNE_DESCRIPTIONS[rune], rune).toBeTruthy();
    // Every effect is a multiplicative factor and/or a flag — never a flat stat line (there is no stat field at all).
    for (const key of Object.keys(effect)) expect(['mults', 'flags'], rune).toContain(key);
    for (const [stat, factor] of Object.entries(effect.mults ?? {}) as [RuneStat, number][]) {
      expect(RUNE_STATS, rune).toContain(stat);
      expect(typeof factor, rune).toBe('number');
    }
    for (const flag of effect.flags ?? []) expect(RUNE_FLAGS, rune).toContain(flag);
  }
});

it('pins every rune\'s exact effect', () => {
  expect(RUNE_EFFECTS).toEqual({
    fehu: { mults: { gold: 2 } },
    uruz: { mults: { digPower: 1.5, damage: 1.5 } },
    thurisaz: { flags: ['ignoreHardRock'] },
    ansuz: { mults: { souls: 2 } },
    raidho: { mults: { autoTicks: 1.5 } },
    kenaz: { flags: ['hazardImmune'] },
    gebo: { flags: ['extraChest'] },
    wunjo: { mults: { xp: 1.5 } },
    hagalaz: { mults: { critMultiplier: 1.5 } },
    isa: { flags: ['slowMonsters'] },
  });
  expect(runeName({ rune: 'fehu' })).toBe('Fehu');
  expect(RUNE_LABELS.isa).toBe('Isa');
});

it('the kind curve is geometric, 512 down to 1, summing to 1023', () => {
  const weights = runeWeights();
  expect(weights.map(([, w]) => w)).toEqual([512, 256, 128, 64, 32, 16, 8, 4, 2, 1]);
  expect(weights.reduce((sum, [, w]) => sum + w, 0)).toBe(1023);
  expect(weights.map(([rune]) => rune)).toEqual(RUNE_TYPES);
});

it('runeTotals multiplies present kinds once each, character-wide, only while worn', () => {
  const s = newGame(1, 0);
  const worn = (slot: 'pickaxe' | 'weapon', rune: RuneType) => gear(s, slot, { sockets: 1, gems: [{ rune }] });
  // fehu (gold x2) and uruz (digPower and damage x1.5) on worn gear of both sets.
  s.equipped.mining.pickaxe = worn('pickaxe', 'fehu');
  s.equipped.battle.weapon = worn('weapon', 'uruz');
  // A second fehu and an ansuz sit in the bag, unworn, and count for nothing.
  s.bag[0] = gear(s, 'gloves', { sockets: 2, gems: [{ rune: 'fehu' }, { rune: 'ansuz' }] });
  const totals = runeTotals(s);
  expect(totals.mults).toEqual({ gold: 2, digPower: 1.5, damage: 1.5 });
  expect(totals.flags).toEqual(new Set());
});

it('a rune kind applies at most once, however many copies are socketed', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { sockets: 2, gems: [{ rune: 'fehu' }, { rune: 'fehu' }] });
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 1, gems: [{ rune: 'fehu' }] });
  expect(runeTotals(s).mults.gold).toBe(2);   // not 8
});

it('flags union across both sets', () => {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { sockets: 1, gems: [{ rune: 'thurisaz' }] });
  s.equipped.battle.weapon = gear(s, 'weapon', { sockets: 1, gems: [{ rune: 'isa' }] });
  const totals = runeTotals(s);
  expect(totals.flags).toEqual(new Set(['ignoreHardRock', 'slowMonsters']));
  expect(totals.mults).toEqual({});
});

it('a rune\'s gold, dig power, damage, souls, xp and crit factors move the derived stats', () => {
  const runed = newGame(1, 0);
  runed.equipped.mining.lamp = gear(runed, 'lamp', { sockets: 1, gems: [{ rune: 'uruz' }] });
  runed.equipped.battle.ring = gear(runed, 'ring', { sockets: 3, gems: [{ rune: 'ansuz' }, { rune: 'wunjo' }, { rune: 'hagalaz' }] });
  const plain = newGame(1, 0);
  plain.equipped.mining.lamp = gear(plain, 'lamp', { sockets: 1, gems: [] });
  plain.equipped.battle.ring = gear(plain, 'ring', { sockets: 3, gems: [] });
  const mining = deriveStats(runed);
  const bareMining = deriveStats(plain);
  expect(mining.digPower).toBeCloseTo(bareMining.digPower * 1.5);
  expect(mining.autoTicksPerSecond).toBeCloseTo(bareMining.autoTicksPerSecond);
  const battle = deriveBattleStats(runed);
  const bareBattle = deriveBattleStats(plain);
  expect(battle.damageMin).toBeGreaterThanOrEqual(bareBattle.damageMin * 1.5 - 1);
  expect(battle.soulMultiplier).toBeCloseTo(bareBattle.soulMultiplier * 2);
  expect(battle.xpMultiplier).toBeCloseTo(bareBattle.xpMultiplier * 1.5);
  expect(battle.critMultiplier).toBeCloseTo(bareBattle.critMultiplier * 1.5);
});

it('rollRune honours the geometric weights', () => {
  const gen = { rng: 7, nextId: 1 };
  const counts = new Map<RuneType, number>();
  for (let i = 0; i < 20_000; i++) {
    const rune = rollRune(gen);
    counts.set(rune.rune, (counts.get(rune.rune) ?? 0) + 1);
  }
  const fehu = counts.get('fehu') ?? 0;
  const isa = counts.get('isa') ?? 0;
  expect(fehu).toBeGreaterThan(isa * 400);          // 512x the weight, sampled loosely
  expect(fehu).toBeGreaterThan(0);
  expect(isa).toBeGreaterThan(0);
});

it('the rune upgrade decision reads runeRng only, so a no-rune drop is byte-identical to a gem-only roll', () => {
  // A runeRng whose first draw is at or above the chance never upgrades on that draw.
  let noRune = 0;
  for (let r = 0; r < 100_000; r++) {
    if (nextRandom({ rng: r }) >= RUNE_DROP_CHANCE) { noRune = r; break; }
  }
  const a = newGame(1, 0);
  const b = newGame(1, 0);
  a.runeRng = noRune;
  const gemA = rollGemOrRune(a, 3);
  const gemB = rollGem(b, 3);
  expect(gemA).toEqual(gemB);
  expect(a.rng).toBe(b.rng);
  expect(a.nextId).toBe(b.nextId);
  expect(a.runeRng).not.toBe(noRune);   // the decision consumed a runeRng draw
});

it('an actual rune drop draws the kind but still advances the loot stream by one draw, as a gem would', () => {
  // A runeRng whose first draw is below the chance upgrades on that draw.
  let drop = 0;
  for (let r = 0; r < 100_000; r++) {
    if (nextRandom({ rng: r }) < RUNE_DROP_CHANCE) { drop = r; break; }
  }
  const a = newGame(1, 0);
  const b = newGame(1, 0);
  a.runeRng = drop;
  const rolled = rollGemOrRune(a, 3);
  const gemB = rollGem(b, 3);
  expect(rolled.type).toBe('rune');
  expect(a.rng).toBe(b.rng);            // one main-stream draw either way
  expect(a.nextId).toBe(b.nextId);
});
