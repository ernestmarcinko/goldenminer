import { expect, it } from 'vitest';
import { achievementBoost } from '../../src/core/achievements';
import { newGame } from '../../src/core/newGame';
import { deriveStats } from '../../src/core/stats';
import { applyTicks, digSpeed, faceTicksPerMetre } from '../../src/core/dig';
import { clickTicks } from '../../src/core/clock';
import { drainOverflow } from '../../src/core/loot';
import { startMap } from '../../src/core/maps';
import { digClearing } from '../helpers/dig';
import { gear, stashMap } from '../helpers/items';
import { validateState } from '../../src/core/save';
import type { GameState, Stats, TickEvent } from '../../src/core/types';
import type { MapItem } from '../../src/core/items';
import { BASE_ROLL_CHANCES, FINDS_LOG_LIMIT, RUNE_DROP_CHANCE, TICKS_PER_METRE_AT_PARITY, goldVeinAmount, hardness } from '../../src/core/balance';
import { metreLayer } from '../../src/core/layer';
import { rollMetre } from '../../src/core/metres';
import { nextRandom } from '../../src/core/rng';

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
  while (s.deepest < 300) digClearing(s, 100, stats);
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

it('Thurisaz makes hard rock cost no extra ticks', () => {
  const ticksFor = (hard: boolean, st: Stats) => {
    const s = newGame(1, 0);
    s.ahead[1] = { feature: null, amount: 0, hardRock: hard };
    let t = 0; while (s.deepest < 1) { applyTicks(s, 1, st); t++; } return t;
  };
  const s = newGame(1, 0);
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 1, gems: [{ rune: 'thurisaz' }] });
  const st = deriveStats(s);
  expect(st.runeFlags.has('ignoreHardRock')).toBe(true);
  expect(ticksFor(true, st)).toBe(ticksFor(false, st));
});

it('Kenaz removes hazard slowdown', () => {
  const s = newGame(1, 0);
  const m = firstMetre(1, (mm) => metreLayer(1, mm).hazard === 'gas');
  s.deepest = m - 1;
  s.ahead = { [m]: { feature: null, amount: 0, hardRock: false } };
  const base = deriveStats(s);
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 1, gems: [{ rune: 'kenaz' }] });
  const kenaz = deriveStats(s);
  expect(kenaz.runeFlags.has('hazardImmune')).toBe(true);
  const plain = hardness(m) * TICKS_PER_METRE_AT_PARITY / base.digPower;
  expect(faceTicksPerMetre(s, base)).toBeCloseTo(plain * 2);
  expect(faceTicksPerMetre(s, kenaz)).toBeCloseTo(plain);
});

it('Gebo makes a chest roll twice', () => {
  const s = newGame(1, 0);
  s.equipped.mining.lamp = gear(s, 'lamp', { sockets: 1, gems: [{ rune: 'gebo' }] });
  const st = deriveStats(s);
  expect(st.runeFlags.has('extraChest')).toBe(true);
  s.ahead[1] = { feature: 'chest', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, st);
  const loot = s.finds.find((f) => f.kind === 'chest')?.loot ?? [];
  expect([2, 4]).toContain(loot.length);   // two chest rolls, each 1 or 2 items
});

it('a gem feature can drop a rune instead', () => {
  let drop = 0;
  for (let r = 0; r < 100_000; r++) {
    if (nextRandom({ rng: r }) < RUNE_DROP_CHANCE) { drop = r; break; }
  }
  const s = newGame(1, 0);
  s.runeRng = drop;
  s.ahead[1] = { feature: 'gem', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, deriveStats(s));
  expect(s.finds.at(-1)?.loot?.[0]).toMatchObject({ rarity: 'rune' });
  expect(s.stats.gems).toBe(0);   // a rune is not a gem
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

/** The first metre from 301 down where the seeded layer satisfies `pred`. */
function firstMetre(seed: number, pred: (metre: number) => boolean): number {
  for (let m = 301; ; m++) if (pred(m)) return m;
}

it('a gas pocket doubles the ticks a metre needs; hazard ward shrinks that', () => {
  const s = newGame(1, 0);
  const m = firstMetre(1, (mm) => metreLayer(1, mm).hazard === 'gas');
  s.deepest = m - 1;
  s.ahead = { [m]: { feature: null, amount: 0, hardRock: false } };
  const base = deriveStats(s);
  const plain = hardness(m) * TICKS_PER_METRE_AT_PARITY / base.digPower;
  expect(faceTicksPerMetre(s, base)).toBeCloseTo(plain * 2);
  expect(faceTicksPerMetre(s, { ...base, hazardWard: 50 })).toBeCloseTo(plain * 1.5);
});

it('digSpeed reports the face rate and the time to the next metre', () => {
  const s = newGame(1, 0);
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  s.progress = 0.5;
  const st = { ...deriveStats(s), digPower: 10, autoTicksPerSecond: 1, hazardWard: 0 };
  const speed = digSpeed(s, st)!;
  expect(speed.metresPerMinute).toBeCloseTo(60 / 25.325, 3);
  expect(speed.secondsToNext).toBeCloseTo(12.6625, 3);
  s.overflow.push(gear(s, 'boots'));
  expect(digSpeed(s, st)).toBeNull();
});

it('digSpeed is null while a map runs', () => {
  const s = newGame(1, 0);
  s.activity = { kind: 'map' } as typeof s.activity;
  expect(digSpeed(s, deriveStats(s))).toBeNull();
});

it('a hazard slows the metre it sits on and the carried progress follows', () => {
  const s = newGame(1, 0);
  const m = firstMetre(1, (mm) => metreLayer(1, mm).hazard === 'gas' && metreLayer(1, mm - 1).hazard === null);
  s.deepest = m - 2;
  s.ahead = {
    [m - 1]: { feature: null, amount: 0, hardRock: false },
    [m]: { feature: null, amount: 0, hardRock: false },
  };
  const st = { ...deriveStats(s), digPower: 10, hazardWard: 0, bonusChances: { chest: 0, gem: 0, map: 0 } };
  const clear = hardness(m - 1) * TICKS_PER_METRE_AT_PARITY / 10;
  expect(faceTicksPerMetre(s, st)).toBeCloseTo(clear);
  s.progress = 0.999;
  applyTicks(s, 1, st);
  expect(s.deepest).toBe(m - 1);
  const leftover = 0.999 + 1 / clear - 1;
  const gas = hardness(m) * TICKS_PER_METRE_AT_PARITY / 10 * 2;
  expect(faceTicksPerMetre(s, st)).toBeCloseTo(gas / achievementBoost(s));   // the depth achievements raise dig power
  expect(s.progress).toBeCloseTo(leftover * clear / gas, 9);
});

it('vein yield raises every vein: Gold and material', () => {
  const s = fresh();
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'veinYield', value: 20 }] });
  const rich = deriveStats(s);
  s.ahead[1] = { feature: 'goldVein', amount: 640, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, rich);
  expect(s.gold).toBe(768);
  expect(s.finds[0]).toMatchObject({ kind: 'goldVein', amount: 768 });

  let m = 1;
  while (!(rollMetre(11, m, BASE_ROLL_CHANCES).feature === null && metreLayer(11, m).vein?.material === 'copper' && metreLayer(11, m).vein?.amount === 4)) m++;
  const t = newGame(11, 0);
  t.equipped.mining.boots = gear(t, 'boots', { affixes: [{ stat: 'veinYield', value: 20 }] });
  digTo(t, m, deriveStats(t));
  expect(t.finds.at(-1)).toMatchObject({ kind: 'materialVein', material: 'copper', amount: 5, depth: m });
  expect(t.bag.find((c) => c?.type === 'material' && c.material === 'copper')).toMatchObject({ count: 5 });
});

it('vein yield raises a diamond vein too, on top of Diamond yield', () => {
  const s = fresh();
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'veinYield', value: 50 }] });
  const st = deriveStats(s);
  expect(st.veinMultiplier).toBeCloseTo(1.5);
  s.ahead[1] = { feature: 'diamondVein', amount: 3, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, { ...st, diamondMultiplier: 2 }, events);
  expect(s.diamonds).toBe(9);   // 3 × 2 × 1.5
  expect(events.filter((e) => e.kind === 'diamond')).toEqual([{ kind: 'diamond', amount: 9 }]);
});

/** Whether the seed left metre `m` empty of everything: no seeded feature and no layer vein. */
const emptyMetre = (seed: number, m: number) => rollMetre(seed, m, BASE_ROLL_CHANCES).feature === null && metreLayer(seed, m).vein === null;

it('ore find adds bonus material veins on metres the seed left empty, at its chance', () => {
  const s = newGame(31, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'oreFind', value: 100 }] });
  // thousands of metres of finds would fill the bag and hold digging, so each tick clears them
  const st = deriveStats(s);
  expect(st.oreBonusChance).toBeCloseTo(0.3);
  const fast = { ...st, digPower: 1e6 };
  let last = 3;   // one past the 2,000th empty metre from metre 3
  for (let seen = 0; seen < 2000; last++) if (emptyMetre(31, last)) seen++;
  while (s.deepest < last) digClearing(s, 1, fast);
  const bonusAt = new Set(s.finds.filter((f) => f.kind === 'materialVein' && f.bonus === true).map((f) => f.depth));
  let hit = 0;
  for (let m = 3; m < last; m++) {
    if (emptyMetre(31, m)) { if (bonusAt.has(m)) hit++; } else expect(bonusAt.has(m), `metre ${m}`).toBe(false);
  }
  expect(Math.abs(hit / 2000 - 0.3)).toBeLessThan(0.03);
  for (const f of s.finds.filter((x) => x.kind === 'materialVein' && x.bonus === true)) {
    expect(f.amount).toBeGreaterThan(0);
    expect(f.material).toBeDefined();
  }
});

it('a sure ore find still never touches a metre with a feature or a layer vein', () => {
  const s = newGame(11, 0);
  const sure = { ...stats, oreBonusChance: 1, digPower: 1e6 };
  while (s.deepest < 600) digClearing(s, 1, sure);
  for (let m = 3; m <= 600; m++) {
    const bonus = s.finds.filter((f) => f.depth === m && f.kind === 'materialVein' && f.bonus === true);
    expect(bonus, `metre ${m}`).toHaveLength(emptyMetre(11, m) ? 1 : 0);
  }
});

it('without ore find, digging draws exactly what it drew before ore find existed', () => {
  // Pinned before ore find was added: seed 21, chest find 50, dug a tick at a time to 400 m. The RNG stream is what
  // matters; the tick count moved when the achievement boost changed the dig speed, without touching the stream. It
  // moved again when the auto-mined metre achievements earned their boost mid-dig, and the final draw re-aligned when a
  // chest's legendary came from the tier-gated list. Plan 34's harder ladders earn far fewer achievements on the way
  // down, so the slower dig takes more ticks (24735 before).
  const s = newGame(21, 0);
  s.equipped.mining.boots = gear(s, 'boots', { affixes: [{ stat: 'chestFind', value: 50 }] });
  const st = deriveStats(s);
  expect(st.oreBonusChance).toBe(0);
  while (s.deepest < 400) digClearing(s, 1, st);
  expect([s.rng, s.deepest, s.finds.length, s.tickCount]).toEqual([1288775494, 400, 201, 37568]);
  expect(s.finds.some((f) => f.kind === 'materialVein' && f.bonus === true)).toBe(false);
});

it('a paused dig tick digs nothing and still counts, and held loot does the same', () => {
  const paused = fresh();
  applyTicks(paused, 10, stats, [], true);
  expect([paused.deepest, paused.progress, paused.tickCount]).toEqual([0, 0, 10]);
  const held = fresh();
  held.bag = held.bag.map(() => gear(held, 'boots'));
  held.overflow.push(gear(held, 'boots'));
  applyTicks(held, 10, stats, [], false);
  expect([held.deepest, held.progress, held.tickCount]).toEqual([0, 0, 10]);
});

it('a dig tick first lets held loot into a freed cell, whatever freed it, and digs once none is held', () => {
  const s = fresh();
  s.bag = s.bag.map(() => gear(s, 'boots'));
  const first = gear(s, 'gloves');
  const second = gear(s, 'helm');
  s.overflow.push(first, second);
  const idAt = (i: number) => s.bag[i]?.id;
  // freed behind the store's back, with no drain: the tick itself drains, oldest first, and draws nothing
  s.bag[5] = null;
  const rng = s.rng;
  applyTicks(s, 1, stats, [], false);
  expect([idAt(5), s.overflow.map((i) => i.id), s.progress, s.rng]).toEqual([first.id, [second.id], 0, rng]);
  s.bag[9] = null;
  applyTicks(s, 1, stats, [], false);
  expect([idAt(9), s.overflow]).toEqual([second.id, []]);
  expect(s.progress).toBeGreaterThan(0);
});

it('digging stops while finds are held and resumes when the bag has room', () => {
  const s = fresh();
  s.bag = s.bag.map(() => gear(s, 'boots'));
  s.ahead[1] = { feature: 'map', amount: 0, hardRock: false };
  while (s.deepest < 1) applyTicks(s, 1, stats);
  expect(s.finds.at(-1)?.loot?.map((n) => [n.base, n.outcome])).toEqual([['map', 'held']]);
  expect(s.overflow).toEqual([expect.objectContaining({ type: 'map', tier: 1, metre: 1 })]);
  expect(s.stash.maps).toEqual({});
  const before = { deepest: s.deepest, progress: s.progress, ticks: s.tickCount };
  applyTicks(s, 200, stats);
  expect([s.deepest, s.progress, s.tickCount]).toEqual([before.deepest, before.progress, before.ticks + 200]);
  expect(digSpeed(s, stats)).toBeNull();
  s.bag[33] = null;
  drainOverflow(s);
  expect([s.overflow, s.bag.findIndex((c) => c?.type === 'map')]).toEqual([[], 33]);
  applyTicks(s, 1, stats);
  expect(s.progress).toBeGreaterThan(before.progress);
});

it('Cartographer finds maps one tier higher, without touching the loot stream', () => {
  const mapOf = (s: GameState) => s.bag.find((c): c is MapItem => c?.type === 'map');
  const plain = newGame(3, 0);
  plain.ahead[1] = { feature: 'map', amount: 0, hardRock: false };
  const carto = newGame(3, 0);
  carto.ahead[1] = { feature: 'map', amount: 0, hardRock: false };
  carto.passives.allocated = ['cartographer'];
  while (plain.deepest < 1) applyTicks(plain, 1, deriveStats(plain));
  while (carto.deepest < 1) applyTicks(carto, 1, deriveStats(carto));
  expect(mapOf(plain)?.tier).toBe(1);
  expect(mapOf(carto)?.tier).toBe(2);
  expect(plain.rng).toBe(carto.rng);
  expect(plain.finds[0]?.kind).toBe('map');
  expect(carto.finds[0]?.kind).toBe('map');
});

it('every digging tick emits exactly one dig event', () => {
  const s = fresh();
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  const events: TickEvent[] = [];
  applyTicks(s, 20, stats, events);   // fewer than the ~25 ticks the first metre takes, so no find
  expect(s.deepest).toBe(0);
  expect(events.filter((e) => e.kind === 'dig')).toHaveLength(20);
});

it('a metre-completing tick emits its dig event alongside its metre and find events', () => {
  const s = fresh();
  s.ahead[1] = { feature: 'goldVein', amount: 7, hardRock: false };
  const events: TickEvent[] = [];
  while (s.deepest < 1) applyTicks(s, 1, stats, events);
  const digs = events.filter((e) => e.kind === 'dig');
  expect(digs.length).toBeGreaterThan(0);
  expect(events.some((e) => e.kind === 'metre' && e.depth === 1)).toBe(true);
  expect(events).toContainEqual({ kind: 'gold', amount: 7 });
});

it('clickTicks emits one dig event per tick it digs', () => {
  const s = fresh();
  s.ahead[1] = { feature: null, amount: 0, hardRock: false };
  const events: TickEvent[] = [];
  clickTicks(s, stats, events);
  expect(events.filter((e) => e.kind === 'dig')).toHaveLength(stats.ticksPerClick);
});

it('map, paused and held-loot ticks emit no dig event', () => {
  const mapS = fresh();
  startMap(mapS, stashMap(mapS, 1, 2).id);
  const mapEvents: TickEvent[] = [];
  applyTicks(mapS, 5, stats, mapEvents);
  expect(mapEvents.filter((e) => e.kind === 'dig')).toHaveLength(0);

  const pausedS = fresh();
  const pausedEvents: TickEvent[] = [];
  applyTicks(pausedS, 5, stats, pausedEvents, true);
  expect(pausedEvents.filter((e) => e.kind === 'dig')).toHaveLength(0);

  const heldS = fresh();
  heldS.bag = heldS.bag.map(() => gear(heldS, 'boots'));
  heldS.overflow.push(gear(heldS, 'boots'));
  const heldEvents: TickEvent[] = [];
  applyTicks(heldS, 5, stats, heldEvents);
  expect(heldEvents.filter((e) => e.kind === 'dig')).toHaveLength(0);
});

it('collecting dig events leaves the state byte-identical to a run without them', () => {
  const withEvents = fresh();
  const without = fresh();
  withEvents.ahead[1] = { feature: null, amount: 0, hardRock: false };
  without.ahead[1] = { feature: null, amount: 0, hardRock: false };
  const events: TickEvent[] = [];
  applyTicks(withEvents, 20, stats, events);
  applyTicks(without, 20, stats);
  expect(events.filter((e) => e.kind === 'dig')).toHaveLength(20);
  expect(withEvents).toEqual(without);
});
