import { expect, it } from 'vitest';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { applyTicks } from '../../src/core/dig';
import { validateState } from '../../src/core/save';
import type { GameState, Stats, TickEvent } from '../../src/core/types';
import { BASE_ROLL_CHANCES, FINDS_LOG_LIMIT, goldVeinAmount } from '../../src/core/balance';
import { metreLayer } from '../../src/core/layer';
import { rollMetre } from '../../src/core/metres';

const fresh = () => newGame(1, 0);
const stats = deriveStats(fresh());

it('one tick at the surface digs a fraction of a metre', () => {
  const s = fresh();
  applyTicks(s, 1, stats);
  expect(s.progress).toBeCloseTo(10 / (10.13 * 25), 6);
});

it('digging pays no Gold or Diamonds by the tick', () => {
  let seed = 1;
  while (metreLayer(seed, 1).vein !== null) seed++;
  const s = newGame(seed, 0);
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  applyTicks(s, 10, stats);
  expect([s.gold, s.diamonds]).toEqual([0, 0]);
});

it('a gold vein pays goldVeinAmount × the Gold multiplier and says so', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 640, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, stats, events);
  expect(stats.goldMultiplier).toBe(1);
  expect(s.gold).toBe(640);
  expect(events).toContainEqual({ kind: 'gold', amount: 640 });
});

it('goldVeinAmount', () => {
  expect(goldVeinAmount(4, 0.5)).toBe(640);
  expect(goldVeinAmount(1, 0)).toBe(248);
});

// The first metre of `seed` whose seeded roll is (or isn't) empty and whose layer holds a material vein.
function veinMetre(seed: number, empty: boolean, chances: Pick<Stats, 'featureChances' | 'hardRockChance'> = BASE_ROLL_CHANCES): number {
  for (let m = 1; ; m++) {
    if ((rollMetre(seed, m, chances).feature === null) === empty && metreLayer(seed, m).vein !== null) return m;
  }
}

// Puts the face at `m`, rolled from the seed, and digs it.
function digTo(s: GameState, m: number, withStats: Stats = stats): void {
  s.deepest = m - 1;
  s.ahead = {};
  while (s.deepest < m) applyTicks(s, 1, withStats);
}

it('a material vein on an empty metre is collected and logged', () => {
  const s = newGame(11, 0);
  const m = veinMetre(11, true);
  const vein = metreLayer(11, m).vein!;
  digTo(s, m);
  expect(s.finds.at(-1)).toMatchObject({ kind: 'materialVein', material: vein.material, amount: vein.amount, depth: m });
  expect(s.bag.some((c) => c?.type === 'material' && c.material === vein.material)).toBe(true);
});

it('a metre with a seeded feature never gives a material vein', () => {
  const s = newGame(11, 0);
  const m = veinMetre(11, false);
  digTo(s, m);
  expect(s.finds.some((f) => f.depth === m && f.kind === 'materialVein')).toBe(false);
  expect(s.finds.some((f) => f.depth === m)).toBe(true);
});

it('find gear still adds bonus finds on material-vein metres', () => {
  const s = newGame(11, 0);
  expect(s.worldGen).toBe(2);
  const m = veinMetre(11, true);
  digTo(s, m, { ...stats, bonusChances: { ...stats.bonusChances, chest: 1 } });
  const at = s.finds.filter((f) => f.depth === m);
  expect(at.some((f) => f.kind === 'materialVein')).toBe(true);
  expect(at.some((f) => f.kind === 'chest' && f.bonus === true)).toBe(true);
});

it('worldGen 1 worlds get material veins too', () => {
  const s = newGame(11, 0);
  s.worldGen = 1;
  const m = veinMetre(11, true, stats);
  const vein = metreLayer(11, m).vein!;
  digTo(s, m);
  expect(s.finds.at(-1)).toMatchObject({ kind: 'materialVein', material: vein.material, amount: vein.amount, depth: m });
});

it('the face keeps its seeded features', () => {
  const s = newGame(21, 0);
  while (s.deepest < 300) applyTicks(s, 100, stats);
  const seeded = s.finds.filter((f) => !f.bonus && f.kind !== 'materialVein' && f.depth >= 3 && f.depth <= 300);
  const expected: { depth: number; kind: string }[] = [];
  for (let m = 3; m <= 300; m++) {
    const feature = rollMetre(21, m, BASE_ROLL_CHANCES).feature;
    if (feature !== null) expected.push({ depth: m, kind: feature });
  }
  expect(seeded.map((f) => ({ depth: f.depth, kind: f.kind }))).toEqual(expected);
  expect(s.finds.some((f) => f.kind === 'materialVein')).toBe(true);
});

it('the first map is found within 60 ticks', () => {
  const s = fresh();
  let ticks = 0;
  while (!s.finds.some((f) => f.kind === 'map') && ticks < 60) { applyTicks(s, 1, stats); ticks++; }
  expect(s.finds.find((f) => f.kind === 'map')).toMatchObject({ depth: 2 });
});

it('finishing a face metre consumes its roll and reveals the next', () => {
  const s = fresh();
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.ahead[1]).toBeUndefined();
  expect(Object.keys(s.ahead).map(Number).sort()).toEqual([2, 3, 4]);
});

it('veins pay out and are logged', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, stats, events);
  expect(s.finds[0]).toMatchObject({ depth: 1, kind: 'goldVein', amount: 19 });
  expect(s.gold).toBe(19);
  expect(events.filter((e) => e.kind === 'gold')).toEqual([{ kind: 'gold', amount: 19 }]);
  expect(events).toContainEqual({ kind: 'metre', depth: 1 });
});

it('hard rock takes 1.5× as long', () => {
  const ticksFor = (hard: boolean) => {
    const s = fresh();
    s.ahead[1] = { feature: null, amount: 0, hardRock: hard };
    let t = 0; while (s.deepest < 1) { applyTicks(s, 1, stats); t++; } return t;
  };
  expect(ticksFor(true) / ticksFor(false)).toBeGreaterThan(1.4);
  expect(ticksFor(true) / ticksFor(false)).toBeLessThan(1.6);
});

it('digging only works the face', () => {
  const s = fresh();
  applyTicks(s, 400, stats);
  expect(s.deepest).toBeGreaterThan(10);
  expect('depth' in s).toBe(false);
  expect(validateState(s)).toBe(true);
});

it('the finds log is capped', () => {
  const s = fresh();
  s.finds = Array.from({ length: FINDS_LOG_LIMIT }, (_, i) => ({ id: i + 1, depth: 0, kind: 'chest' as const, amount: 0, tick: i }));
  s.ahead[1] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.finds).toHaveLength(FINDS_LOG_LIMIT);
  expect(s.finds.at(-1)).toMatchObject({ kind: 'gem', depth: 1 });
});

it('an infinite or zero dig power neither hangs nor corrupts the state', () => {
  for (const digPower of [Infinity, NaN, 0]) {
    const s = fresh();
    applyTicks(s, 5, { ...stats, digPower });
    expect(s.deepest).toBe(0);
    expect(validateState(s)).toBe(true);
    applyTicks(s, 400, stats);
    applyTicks(s, 5, { ...stats, digPower });
    expect(validateState(s)).toBe(true);
  }
});

it('veins pay their yield and log what was paid', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 19, hardRock: false };
  const rich = { ...stats, goldMultiplier: 1.5 };
  while (s.deepest < 1) applyTicks(s, 1, rich);
  expect(s.finds[0]).toMatchObject({ kind: 'goldVein', amount: 29 });
  expect(s.gold).toBe(29);
});

it('a diamond vein pays its yield and says so', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'diamondVein', amount: 3, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, { ...stats, diamondMultiplier: 2 }, events);
  expect(s.diamonds).toBe(6);
  expect(events.filter((e) => e.kind === 'diamond')).toEqual([{ kind: 'diamond', amount: 6 }]);
});

it('leftover progress carries over at the next metre’s hardness', () => {
  const s = fresh();
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  s.ahead[2] = { feature: null, amount: 0, hardRock: true };
  applyTicks(s, 1, { ...stats, digPower: 1.5 * 10.13 * 25 }); // 1.5 metres of metre 1's work
  expect(s.deepest).toBe(1);
  expect(s.progress).toBeCloseTo((0.5 * 10.13) / (10.26 * 1.5), 6);
});
