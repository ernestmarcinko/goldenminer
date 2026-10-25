import { expect, it, vi } from 'vitest';
import { DROP_CHANCE, MATERIAL_TABLE, MAX_HELD, soulsPerKill } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { clickHit, onKill, soulsForKill } from '../../src/core/combat';
import { applyTicks } from '../../src/core/dig';
import { startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { isGear, setOfSlot, type MapMod, type Material } from '../../src/core/items';
import { mapEffects } from '../../src/core/mapMods';
import { pickMaterial } from '../../src/core/layer';
import { nextRandom } from '../../src/core/rng';
import { deriveStats } from '../../src/core/stats';
import { summarize } from '../../src/core/summary';
import { validateState } from '../../src/core/save';
import type { GameState, LootNote, MapRun, MonsterState, Rank } from '../../src/core/types';
import { gear, stashMap } from '../helpers/items';

// Spies that call through: which rarity multiplier each item rolled with, and how many gems were rolled.
const spy = vi.hoisted(() => ({ rarityArgs: [] as number[], gems: 0 }));
vi.mock('../../src/core/itemGen', async (importActual) => {
  const actual = await importActual<typeof import('../../src/core/itemGen')>();
  return {
    ...actual,
    rollRarity: (state: Parameters<typeof actual.rollRarity>[0], magicFind?: number) => {
      spy.rarityArgs.push(magicFind ?? 1);
      return actual.rollRarity(state, magicFind);
    },
    rollGem: (...args: Parameters<typeof actual.rollGem>) => { spy.gems += 1; return actual.rollGem(...args); },
  };
});

it('souls per kill round by chance', () => {
  expect(soulsForKill(0.5, 4, 'normal', 1)).toBe(1);
  expect(soulsForKill(0.4, 2, 'normal', 1)).toBe(1);
  expect(soulsForKill(0.6, 2, 'normal', 1)).toBe(0);
  expect(soulsForKill(0, 1, 'boss', 2)).toBe(3);
  expect(soulsForKill(0.1, 1, 'champion', 1)).toBe(1);   // 0.75: floor 0, 0.1 < 0.75 -> 1
});

// Clicks, then ticks only while the map still runs: a tick after the final click would dig a metre and pay its Gold.
function fight(s: GameState, clicks = true): void {
  const stats = deriveStats(s);
  while (s.activity.kind === 'map') {
    if (clicks) clickHit(s);
    if (s.activity.kind === 'map') applyTicks(s, 1, stats);
  }
}

function clearTier1(seed: number) {
  const s = newGame(seed, 0);
  startMap(s, stashMap(s, 1, 2).id);
  fight(s);
  return s;
}

it('a cleared tier-1 map pays Souls, 40 Gold and at least the boss and champion drops', () => {
  const s = clearTier1(1);
  expect(s.lastRun?.outcome).toBe('cleared');
  expect(s.lastRun?.gained.gold).toBe(40);   // 12 normals x 2, 1 champion x 6, the boss x 10
  expect(s.gold).toBe(40);
  expect(s.lastRun?.gained.souls).toBe(s.souls);
  expect(s.lastRun?.items).toBeGreaterThanOrEqual(3);
});

it('a full bag holds map drops but the fight goes on', () => {
  const s = newGame(1, 0);
  s.bag = s.bag.map((_, i) => gear(s, i % 2 ? 'weapon' : 'pickaxe'));
  s.stash.general = s.stash.general.map(() => gear(s, 'weapon'));
  startMap(s, stashMap(s, 1, 2).id);
  fight(s);
  expect(s.lastRun?.outcome).toBe('cleared');
  expect(s.overflow.length).toBeGreaterThanOrEqual(3);
  const gold = s.gold;
  applyTicks(s, 10, deriveStats(s));
  expect(s.gold).toBe(gold);
});

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

// A started run (seed `seed`, a tier-1 map with no modifiers unless `map` says otherwise), and a hand-built monster of
// `rank` ready to fall.
function kill(
  seed: number, rank: Rank, prepare?: (s: GameState) => void,
  map: { tier: number; metre: number; mods?: MapMod[] } = { tier: 1, metre: 2 },
) {
  const s = newGame(seed, 0);
  prepare?.(s);
  startMap(s, stashMap(s, map.tier, map.metre).id);
  const run = runOf(s);
  if (map.mods !== undefined) Object.assign(run.map, { rarity: 'rare', mods: map.mods });
  const m: MonsterState = {
    name: 'Test Monster', species: 0, rank, mods: [], extra: 0, element: 'physical',
    life: 0, maxLife: 10, damage: 1, intervalS: 1, xp: 10,
  };
  const b = deriveBattleStats(s);
  spy.rarityArgs.length = 0;
  spy.gems = 0;
  // The draws the kill will make, read ahead on a copy: Souls, then the extra-item chance.
  const ahead = { rng: s.rng };
  nextRandom(ahead);
  const chancePasses = nextRandom(ahead) < 0.15;
  onKill(s, run, m, b);
  return { s, run, b, chancePasses };
}

const dropLines = (run: MapRun) => run.log.filter((l) => l.kind === 'drop').length;

const GUARANTEED: Record<Rank, number> = { normal: 0, champion: 1, boss: 2 };

it('each rank drops its guaranteed items plus one more when the chance draw passes', () => {
  for (const rank of ['normal', 'champion', 'boss'] as const) {
    const seen = { pass: 0, miss: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const { run, chancePasses } = kill(seed, rank);
      seen[chancePasses ? 'pass' : 'miss'] += 1;
      // Gem and material notes are on the run too: items rolled with a rarity draw are counted by the spy.
      expect(spy.rarityArgs.length, `${rank} seed ${seed}`).toBe(GUARANTEED[rank] + (chancePasses ? 1 : 0));
      const items = run.loot.filter((n) => n.rarity !== 'material');
      expect(items.length, `${rank} seed ${seed}`).toBe(spy.rarityArgs.length + spy.gems);
    }
    expect(seen.pass, rank).toBeGreaterThan(0);
    expect(seen.miss, rank).toBeGreaterThan(0);
  }
});

it('only a champion\'s guaranteed item rolls with the champion magic-find boost', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const champion = kill(seed, 'champion');
    const mf = champion.b.magicFindMultiplier;
    expect(spy.rarityArgs[0], `champion seed ${seed}`).toBe(mf * 3);
    expect(spy.rarityArgs.slice(1), `champion seed ${seed}`).toEqual(spy.rarityArgs.length > 1 ? [mf] : []);
    kill(seed, 'boss');
    expect(spy.rarityArgs.every((a) => a === mf), `boss seed ${seed}`).toBe(true);
    kill(seed, 'normal');
    expect(spy.rarityArgs.every((a) => a === mf), `normal seed ${seed}`).toBe(true);
  }
});

it('about 80% of map gear is battle gear, and gems land in the bag', () => {
  let battle = 0;
  let mining = 0;
  let gems = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { s } = kill(seed, 'boss');
    for (const c of s.bag) {
      if (c === null || c.type === 'material') continue;
      if (!isGear(c)) gems++;
      else if (setOfSlot(c.slot) === 'battle') battle++;
      else mining++;
    }
  }
  const share = battle / (battle + mining);
  expect(share).toBeGreaterThan(0.75);
  expect(share).toBeLessThan(0.85);
  expect(gems).toBeGreaterThan(0);
});

it('a gem drop is noted on the run and in the log like an item', () => {
  let found = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const { run } = kill(seed, 'normal');
    if (spy.gems > 0) {
      found++;
      expect(run.loot.some((n) => n.rarity === 'gem'), `seed ${seed}`).toBe(true);
    }
    expect(dropLines(run), `seed ${seed}`).toBe(run.loot.length);
  }
  expect(found).toBeGreaterThan(0);
});

const materialsOf = (run: MapRun) => run.loot.filter((n) => n.rarity === 'material').map((n) => n.base as Material);

it('map kills drop materials of the map\'s depth', () => {
  const deep = new Set<Material>();
  const shallow = new Set<Material>();
  for (let seed = 1; seed <= 400; seed++) {
    for (const m of materialsOf(kill(seed, 'boss', undefined, { tier: 7, metre: 1100 }).run)) deep.add(m);
    for (const m of materialsOf(kill(seed, 'boss', undefined, { tier: 1, metre: 20 }).run)) shallow.add(m);
  }
  // Starsteel, obsidian and void crystal weigh about 18 of 344 at 1100 m: some 26 of the ~500 drops are expected.
  expect([...deep].some((m) => MATERIAL_TABLE[m].from >= 450)).toBe(true);
  expect(pickMaterial(1100, 0.9999)).toBe('voidCrystal');
  expect(shallow.size).toBeGreaterThan(0);
  expect([...shallow].every((m) => m === 'copper' || m === 'tin')).toBe(true);
});

it('normal kills roll one material chance', () => {
  let dropped = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    if (materialsOf(kill(seed, 'normal').run).length > 0) dropped++;
  }
  expect(Math.abs(dropped / 2000 - 0.25)).toBeLessThan(0.03);
});

it('bosses roll the material chance five times', () => {
  let drops = 0;
  const kills = 800;
  for (let seed = 1; seed <= kills; seed++) drops += materialsOf(kill(seed, 'boss').run).length;
  // 5 passes x 0.25 = 1.25 a kill (about 1,000 drops, sd about 27); a single pass would give about 200.
  expect(Math.abs(drops / kills - 5 * 0.25)).toBeLessThan(0.1);
});

it('a material drop is noted on the run but not counted as an item', () => {
  let sawMaterial = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const { run } = kill(seed, 'boss');
    sawMaterial += materialsOf(run).length;
    expect(run.items, `seed ${seed}`).toBe(spy.rarityArgs.length + spy.gems);
    expect(run.loot.length, `seed ${seed}`).toBe(run.items + materialsOf(run).length);
    expect(dropLines(run), `seed ${seed}`).toBe(run.loot.length);
  }
  expect(sawMaterial).toBeGreaterThan(0);
});

it('with MAX_HELD items already held, a further drop is sold and nothing more is held', () => {
  const { s, run } = kill(1, 'boss', (g) => {
    g.bag = g.bag.map((_, i) => gear(g, i % 2 ? 'weapon' : 'pickaxe'));
    g.stash.general = g.stash.general.map(() => gear(g, 'weapon'));
    for (let i = 0; i < MAX_HELD; i++) g.overflow.push(gear(g, 'weapon'));
  });
  expect(s.overflow).toHaveLength(MAX_HELD);
  expect(run.loot.some((n) => n.outcome === 'sold')).toBe(true);
  expect(run.loot.some((n) => n.outcome === 'held')).toBe(false);
});

it('the offline summary reports maps, levels and Souls as differences from a non-zero start', () => {
  const before = newGame(1, 0);
  before.souls = 7;
  before.level = 2;
  before.mapTally = { cleared: 3, lost: 1 };
  const after = structuredClone(before);
  startMap(after, stashMap(after, 1, 2).id);
  fight(after);
  expect(after.lastRun?.outcome).toBe('cleared');
  const sum = summarize(before, after, 600_000, 600, 28_800_000);
  expect(sum.maps).toEqual({ cleared: 1, lost: 0 });
  expect(sum.souls).toBe(after.souls - 7);
  expect(sum.souls).toBeGreaterThan(0);
  expect(sum.levels).toBe(after.level - 2);
});

it('the offline summary counts a lost map', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  startMap(after, stashMap(after, 4, 2).id);
  fight(after, false);
  expect(after.lastRun?.outcome).toBe('died');
  expect(summarize(before, after, 600_000, 600, 28_800_000).maps).toEqual({ cleared: 0, lost: 1 });
});

it('the offline summary notices the bag holding map drops', () => {
  const before = newGame(1, 0);
  const after = structuredClone(before);
  after.bag = after.bag.map((_, i) => gear(after, i % 2 ? 'weapon' : 'pickaxe'));
  after.stash.general = after.stash.general.map(() => gear(after, 'weapon'));
  startMap(after, stashMap(after, 1, 2).id);
  fight(after);
  expect(after.overflow.length).toBeGreaterThan(0);
  expect(summarize(before, after, 600_000, 600, 28_800_000).bagStopped).toBe(true);
});

// Modifiers worth 200 in all: 100% more item quantity and Souls, 60% more magic find.
const RICH = {
  tier: 1, metre: 2, mods: [{ kind: 'monsterLife', tier: 1, value: 120 }, { kind: 'monsterDamage', tier: 1, value: 80 }] as MapMod[],
};

// Worth 2,000 in all: 1,000% more quantity puts the item and material chances at 1.
const CAPPED = { tier: 1, metre: 2, mods: [{ kind: 'monsterLife', tier: 1, value: 2000 }] as MapMod[] };

it('the enchanted test maps pay what the next tests assume', () => {
  const fx = mapEffects({ id: 1, type: 'map', rarity: 'rare', ...RICH });
  expect(fx).toMatchObject({ quantity: 100, rarity: 60, souls: 100 });
  expect(mapEffects({ id: 1, type: 'map', rarity: 'rare', ...CAPPED }).quantity).toBe(1000);
});

it('item quantity raises the drop chance of every kill', () => {
  let dropped = 0;
  const kills = 4000;
  for (let seed = 1; seed <= kills; seed++) {
    kill(seed, 'normal', undefined, RICH);
    dropped += spy.rarityArgs.length;
  }
  expect(Math.abs(dropped / kills - Math.min(1, 2 * DROP_CHANCE))).toBeLessThan(0.02);
});

it('a map\'s magic find multiplies the miner\'s', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { b } = kill(seed, 'champion', undefined, RICH);
    expect(spy.rarityArgs[0], `seed ${seed}`).toBeCloseTo(b.magicFindMultiplier * 1.6 * 3);
    for (const a of spy.rarityArgs.slice(1)) expect(a, `seed ${seed}`).toBeCloseTo(b.magicFindMultiplier * 1.6);
  }
});

it('a map\'s Souls bonus multiplies the Souls of every kill', () => {
  let souls = 0;
  const kills = 4000;
  for (let seed = 1; seed <= kills; seed++) souls += kill(seed, 'normal', undefined, RICH).run.gained.souls;
  const plain = soulsPerKill(1);   // a naked miner's Souls a tier-1 kill
  expect(Math.abs(souls / kills / (2 * plain) - 1)).toBeLessThan(0.05);
});

it('a map\'s rewards change the thresholds, never the draws', () => {
  // Every kill draws Souls, the item chance, each item, the gem chance and the material chances, even a chance raised
  // to 1. Where an enchanted kill drops just what the plain kill drops, both leave the rng in the same place.
  const drops = (run: MapRun) => JSON.stringify([run.loot, spy.rarityArgs.length, spy.gems]);
  // A capped map rarely drops just what a plain one does, so it takes more kills to find enough of them.
  for (const [map, kills, least] of [[RICH, 2000, 1000], [CAPPED, 10_000, 50]] as const) {
    let same = 0;
    for (let seed = 1; seed <= kills; seed++) {
      const plain = kill(seed, 'normal');
      const plainDrops = drops(plain.run);
      const enchanted = kill(seed, 'normal', undefined, map);
      if (drops(enchanted.run) !== plainDrops) continue;
      expect(enchanted.s.rng, `seed ${seed}`).toBe(plain.s.rng);
      same++;
    }
    expect(same).toBeGreaterThan(least);
  }
});

it('a long map run with a full bag loses nothing silently', () => {
  const s = newGame(5, 0);
  startMap(s, stashMap(s, 4, 327).id);
  s.bag = s.bag.map((_, i) => gear(s, i % 2 ? 'weapon' : 'pickaxe'));
  const run = runOf(s);
  const gold = s.gold;
  const notes: LootNote[] = [];
  for (let i = 0; i < 2000; i++) {
    const m: MonsterState = {
      name: 'Test Monster', species: 0, rank: i % 10 === 0 ? 'champion' : 'normal', mods: [], extra: 0,
      element: 'physical', life: 0, maxLife: 10, damage: 1, intervalS: 1, xp: 10,
    };
    run.loot.length = 0;
    onKill(s, run, m, deriveBattleStats(s));
    notes.push(...run.loot);
  }
  expect(s.overflow).toHaveLength(MAX_HELD);
  expect(notes.slice(0, MAX_HELD).every((n) => n.outcome === 'held')).toBe(true);
  expect(notes.length).toBeGreaterThan(MAX_HELD * 3);
  const after = notes.slice(MAX_HELD);
  expect(after.every((n) => (n.rarity === 'material' ? n.outcome === 'stash' : n.outcome === 'sold'))).toBe(true);
  expect(after.some((n) => n.rarity === 'material')).toBe(true);
  const sold = notes.filter((n) => n.outcome === 'sold').reduce((sum, n) => sum + n.value, 0);
  expect(s.gold - gold).toBe(sold + run.gained.gold);
  expect(validateState(s)).toBe(true);
});
