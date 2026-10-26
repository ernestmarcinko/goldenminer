import { expect, it } from 'vitest';
import { MAP_MOD_KINDS } from '../../src/core/items';
import type { MapItem, MapMod } from '../../src/core/items';
import { MAP_MOD_TEXT, NO_MAP_EFFECTS, mapEffects, mapModRange } from '../../src/core/mapMods';
import { rangeOf, tierRange } from '../../src/core/tiers';
import { STAT_TIERS } from '../../src/core/balance';
import { dungeonLayout } from '../../src/core/dungeons';
import { monsterState } from '../../src/core/monsters';

const map = (mods: MapMod[], rarity: MapItem['rarity'] = mods.length > 2 ? 'rare' : mods.length > 0 ? 'magic' : 'normal'): MapItem =>
  ({ id: 1, type: 'map', tier: 4, metre: 327, rarity, mods });

it('a map modifier rolls in its tier range', () => {
  expect(mapModRange('monsterLife', 4)).toEqual({ lo: 39, hi: 46 });
  expect(mapModRange('weakHealing', 2)).toEqual({ lo: 22, hi: 28 });
});

it('rangeOf is the gear tier formula', () => {
  for (const stat of ['digPower', 'ticksPerClick', 'life'] as const) {
    for (let t = 1; t <= 12; t++) expect(rangeOf(STAT_TIERS[stat], t)).toEqual(tierRange(stat, t));
  }
});

it('a map with modifiers makes monsters stronger and pays more', () => {
  const e = mapEffects(map([
    { kind: 'monsterLife', tier: 4, value: 27 },
    { kind: 'monsterDamage', tier: 3, value: 17 },
    { kind: 'monsterSpeed', tier: 4, value: 15 },
    { kind: 'weakHealing', tier: 2, value: 16 },
  ]));
  expect(e.lifeMult).toBeCloseTo(1.27);
  expect(e.damageMult).toBeCloseTo(1.17);
  expect(e.speedMult).toBeCloseTo(1.15);
  expect(e.healMult).toBeCloseTo(0.84);
  expect([e.bossMult, e.takenMult]).toEqual([1, 1]);
  expect([e.quantity, e.rarity, e.souls]).toEqual([38, 23, 38]);   // 75 × 0.5 = 37.5 → 38
});

it('weak healing and hardened are capped', () => {
  expect(mapEffects(map([{ kind: 'weakHealing', tier: 20, value: 120 }])).healMult).toBeCloseTo(0.1);
  expect(mapEffects(map([{ kind: 'hardened', tier: 30, value: 100 }])).takenMult).toBeCloseTo(0.25);
  const boss = mapEffects(map([{ kind: 'bossPower', tier: 1, value: 15 }]));
  expect(boss.bossMult).toBeCloseTo(1.15);
});

it('a normal map changes nothing and pays nothing extra', () => {
  expect(mapEffects(map([]))).toEqual({
    lifeMult: 1, damageMult: 1, speedMult: 1, bossMult: 1, healMult: 1, takenMult: 1, quantity: 0, rarity: 0, souls: 0,
  });
  expect(NO_MAP_EFFECTS).toEqual(mapEffects(map([])));
});

it('every modifier reads as its effect', () => {
  expect(MAP_MOD_KINDS.map((k) => MAP_MOD_TEXT[k](12))).toEqual([
    'Monsters have +12% life',
    'Monsters deal +12% damage',
    'Monsters attack 12% faster',
    'Champions and bosses are 12% stronger',
    'Rooms heal 12% less',
    'Monsters take 12% less damage',
  ]);
});

it('an enchanted map is the same dungeon, its monsters scaled by the modifiers', () => {
  const plain = map([]);
  const enchanted = map([
    { kind: 'monsterLife', tier: 4, value: 27 },
    { kind: 'monsterDamage', tier: 4, value: 21 },
    { kind: 'monsterSpeed', tier: 4, value: 15 },
    { kind: 'bossPower', tier: 4, value: 36 },
  ]);
  const fx = mapEffects(enchanted);
  const ranks = new Set<string>();
  for (const seed of [1, 2, 3]) {
    const layout = dungeonLayout(seed, plain);
    expect(dungeonLayout(seed, enchanted), `seed ${seed}`).toEqual(layout);
    for (const lm of [...layout.rooms.flat(), layout.boss]) {
      ranks.add(lm.rank);
      const p = monsterState(plain.tier, lm);
      const e = monsterState(enchanted.tier, lm, fx);
      expect(monsterState(plain.tier, lm, mapEffects(plain))).toEqual(p);
      const { name, species, rank, mods, extra, element, xp } = p;
      expect(e).toMatchObject({ name, species, rank, mods, extra, element, xp, life: e.maxLife });
      // Both sides are rounded, so each may sit half a unit off the exact product.
      const power = lm.rank === 'normal' ? 1 : fx.bossMult;
      const scales: [number, number, number][] = [
        [e.maxLife, p.maxLife, fx.lifeMult * power], [e.damage, p.damage, fx.damageMult * power],
      ];
      for (const [scaled, base, mult] of scales) {
        expect(Math.abs(scaled - base * mult), `seed ${seed} ${lm.name}`).toBeLessThanOrEqual(0.5 + 0.5 * mult);
      }
      expect(e.intervalS).toBeCloseTo(p.intervalS / fx.speedMult, 12);
    }
  }
  expect([...ranks].sort()).toEqual(['boss', 'champion', 'normal']);
});
