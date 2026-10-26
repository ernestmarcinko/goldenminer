import { expect, it } from 'vitest';
import fixture9 from '../fixtures/save-schema-9.txt?raw';
import { TICKS_PER_METRE_AT_PARITY, hardness } from '../../src/core/balance';
import { metreTier } from '../../src/core/bands';
import { deriveBattleStats } from '../../src/core/battle';
import { advance } from '../../src/core/clock';
import { onKill } from '../../src/core/combat';
import { applyTicks, collect, faceTicksPerMetre } from '../../src/core/dig';
import { LEGENDARIES, type LegendaryId } from '../../src/core/itemData';
import { rollLegendary } from '../../src/core/itemGen';
import { setOfSlot, type GearItem } from '../../src/core/items';
import { hazardFactor, metreLayer } from '../../src/core/layer';
import { startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, validateState } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GameState, MapRun, MonsterState, Stats, TickEvent } from '../../src/core/types';
import { UNIQUE_LINES, hasUnique } from '../../src/core/uniques';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY } from '../../src/store/storage';
import { itemLines } from '../../src/ui/character/itemView';
import { minimapModel } from '../../src/ui/mine/minimap';
import { gear, stashMap } from '../helpers/items';

type GearProps = Parameters<typeof gear>[2];

/**
 * A miner wearing the legendary `id`, set up by `setup`, and a twin whose worn copy has lost its `uniqueId`: the same
 * stats and the same streams, but no unique line.
 */
function pair(id: LegendaryId, setup?: (s: GameState) => void, props: GearProps = {}, rng = 1): [GameState, GameState] {
  const s = newGame(1, 0);
  s.rng = rng;
  const def = LEGENDARIES.find((d) => d.id === id);
  if (def === undefined) throw new Error(`no legendary ${id}`);
  s.equipped[setOfSlot(def.slot)][def.slot] = gear(s, def.slot, { rarity: 'legendary', name: def.name, uniqueId: id, ...props });
  setup?.(s);
  const twin = structuredClone(s);
  delete (twin.equipped[setOfSlot(def.slot)][def.slot] as GearItem).uniqueId;
  return [s, twin];
}

function runOf(s: GameState): MapRun {
  if (s.activity.kind !== 'map') throw new Error('no map is running');
  return s.activity.run;
}

function monster(p: Partial<MonsterState> = {}): MonsterState {
  return {
    name: 'Test Monster', species: 0, rank: 'normal', mods: [], extra: 0,
    element: 'physical', life: 10_000, maxLife: 10_000, damage: 40, intervalS: 1, xp: 10, ...p,
  };
}

// A tier-1 run whose first room is one hand-built monster.
const inMap = (p: Partial<MonsterState> = {}) => (s: GameState) => {
  expect(startMap(s, stashMap(s, 1, 2).id)).toBe('ok');
  runOf(s).queue = [monster(p)];
};

const at = (s: GameState, autoTicksPerSecond: number): Stats => ({ ...deriveStats(s), autoTicksPerSecond });
const hits = (run: MapRun) => run.log.filter((l) => l.kind === 'hit').length;

it('Deepdelver finishes every 25th metre at once and doubles its find', () => {
  const setup = (s: GameState) => {
    s.deepest = 24;
    s.ahead = { 25: { feature: 'goldVein', amount: 100, hardRock: false }, 50: { feature: 'chest', amount: 0, hardRock: false } };
  };
  const [s, twin] = pair('deepdelver', setup);
  const st = deriveStats(s);
  applyTicks(s, 1, st);
  applyTicks(twin, 1, st);
  expect(s.deepest).toBeGreaterThanOrEqual(25);
  expect(s.gold).toBe(Math.round(200 * st.goldMultiplier * st.veinMultiplier));
  expect(s.finds.find((f) => f.depth === 25)).toMatchObject({ kind: 'goldVein', amount: 200 });
  expect(s.progress).toBeCloseTo(1 / faceTicksPerMetre(s, st), 9);
  expect(twin.deepest).toBe(24);
  while (twin.deepest < 25) applyTicks(twin, 1, st);
  expect(twin.gold).toBe(100);

  for (const x of [s, twin]) while (x.deepest < 60) applyTicks(x, 1, st);
  const chests = (x: GameState) => x.finds.filter((f) => f.depth === 50 && f.kind === 'chest');
  expect(chests(s)).toHaveLength(2);
  expect(chests(s)[1]?.bonus).toBe(true);
  expect(chests(s)[0]?.bonus).toBeUndefined();
  expect(chests(twin)).toHaveLength(1);
  // every chest on a normal metre drew from the loot stream alike; the second chest at 50 m drew from the unique one
  expect(s.rng).toBe(twin.rng);
  expect(s.uniqueRng).not.toBe(twin.uniqueRng);
  expect(validateState(s)).toBe(true);
});

it('The Golddigger gives a material with every gold vein, from its own stream', () => {
  const [s, twin] = pair('golddigger');
  const st = deriveStats(s);
  const vein = { feature: 'goldVein', amount: 100, hardRock: false } as const;
  collect(s, vein, 220, metreTier(220), st);
  collect(twin, vein, 220, metreTier(220), st);
  const find = s.finds[s.finds.length - 1];
  expect(find?.loot).toHaveLength(1);
  expect(find?.loot?.[0]).toMatchObject({ rarity: 'material', outcome: 'bag' });
  expect(s.bag.some((c) => c?.type === 'material')).toBe(true);
  expect(twin.finds[twin.finds.length - 1]?.loot).toBeUndefined();
  expect(twin.bag.some((c) => c?.type === 'material')).toBe(false);
  expect(s.gold).toBe(twin.gold);
  expect(s.rng).toBe(twin.rng);
  expect(s.uniqueRng).not.toBe(twin.uniqueRng);
});

it('Black Lantern halves the hazard slowdown and lights hazards ahead', () => {
  expect(hazardFactor('gas', 0, 0.5)).toBe(1.5);
  expect(hazardFactor('unstable', 50, 0.5)).toBeCloseTo(1.15, 9);
  expect(hazardFactor('gas', 0)).toBe(2);

  const [s, twin] = pair('blackLantern');
  expect(deriveStats(s)).toMatchObject({ hazardSight: 30, hazardSlow: 0.5 });
  expect(deriveStats(twin)).toMatchObject({ hazardSight: 0, hazardSlow: 1 });

  // a face 20 m above a hazard, with another hazard between 31 and 40 m past the face
  const hazard = (m: number) => metreLayer(s.seed, m).hazard !== null;
  let face = 400;
  const farHazard = () => Array.from({ length: 10 }, (_, i) => face + 31 + i).some(hazard);
  while (!hazard(face + 20) || !farHazard()) face++;
  s.deepest = face;
  s.ahead = { [face + 20]: { feature: 'chest', amount: 0, hardRock: false } };
  const model = minimapModel(s, 25, face - 50, deriveStats(s).hazardSight);
  const y = (m: number) => (m - 0.5) * 6;
  const lit = model.ahead.filter((h) => h.lantern === true);
  expect(model.ahead).toContainEqual(expect.objectContaining({ y: y(face + 20), kind: 'chest' }));
  expect(lit).toContainEqual(expect.objectContaining({ y: y(face + 20), kind: metreLayer(s.seed, face + 20).hazard }));
  expect(lit.every((h) => h.y <= y(face + 30))).toBe(true);
  expect(minimapModel(s, 25, face - 50).ahead.some((h) => h.lantern === true)).toBe(false);

  // the gas metre's cost, with and without the lantern
  let gas = 400;
  while (metreLayer(s.seed, gas).hazard !== 'gas') gas++;
  for (const x of [s, twin]) {
    x.deepest = gas - 1;
    x.ahead = { [gas]: { feature: null, amount: 0, hardRock: false } };
  }
  const st = deriveStats(s);
  const plain = hardness(gas) * TICKS_PER_METRE_AT_PARITY / st.digPower;
  expect(faceTicksPerMetre(s, st)).toBeCloseTo(plain * 1.5, 6);
  expect(faceTicksPerMetre(twin, deriveStats(twin))).toBeCloseTo(plain * 2, 6);
});

it('Long Voyage doubles the offline cap and the finds of time away', () => {
  const props: GearProps = { implicit: { stat: 'offlineCap', value: 0 }, affixes: [{ stat: 'offlineCap', value: 120, tier: 0 }] };
  const setup = (s: GameState) => {
    s.ahead = { 1: { feature: 'goldVein', amount: 100, hardRock: false } };
  };
  const [s, twin] = pair('longVoyage', setup, props);
  expect(deriveStats(s).offlineCapMs).toBe(2 * 10 * 3_600_000);
  expect(deriveStats(twin).offlineCapMs).toBe(10 * 3_600_000);

  const veinAt1 = (x: GameState) => x.finds.find((f) => f.depth === 1)?.amount;
  const away = structuredClone(s);
  const live = structuredClone(s);
  advance(away, 100_000, deriveStats(away), undefined, false, true);
  advance(live, 100_000, deriveStats(live), undefined, false, false);
  advance(twin, 100_000, deriveStats(twin), undefined, false, true);
  expect(veinAt1(away)).toBe(200);
  expect(veinAt1(live)).toBe(100);
  expect(veinAt1(twin)).toBe(100);
  expect(away.rng).toBe(twin.rng);

  // a load is time away
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, encodeSave(s, 0));
  const store = new GameStore({ storage, storageAvailable: true, now: () => 100_000, newSeed: () => 7 });
  store.load();
  expect(veinAt1(store.state)).toBe(200);
});

it('Band of the Deep heals 2 % of max life on a crit', () => {
  // the first rng whose first strike crits
  const firstStrike = (x: GameState) => {
    const events: TickEvent[] = [];
    const st = at(x, 20);
    while (!events.some((e) => e.kind === 'strike')) applyTicks(x, 1, st, events);
    return events.find((e) => e.kind === 'strike');
  };
  let rng = 1;
  const setup = (s: GameState) => {
    inMap({ intervalS: 1e9, life: 1e6, maxLife: 1e6 })(s);
    runOf(s).life = 50;
  };
  for (; rng < 500; rng++) {
    const [probe] = pair('bandOfTheDeep', setup, {}, rng);
    const strike = firstStrike(probe);
    if (strike?.kind === 'strike' && strike.crit) break;
  }
  expect(rng).toBeLessThan(500);
  const [s, twin] = pair('bandOfTheDeep', setup, {}, rng);
  const { maxLife } = deriveBattleStats(s);
  firstStrike(s);
  firstStrike(twin);
  expect(runOf(twin).life).toBe(50);
  expect(runOf(s).life).toBe(50 + Math.round(0.02 * maxLife));
  expect(s.rng).toBe(twin.rng);
});

it('Wolf Eye adds one drop to champions and bosses, from its own stream', () => {
  for (const rank of ['champion', 'boss'] as const) {
    const [s, twin] = pair('wolfEye', inMap());
    onKill(s, runOf(s), monster({ rank }), deriveBattleStats(s));
    onKill(twin, runOf(twin), monster({ rank }), deriveBattleStats(twin));
    expect(runOf(s).items).toBe(runOf(twin).items + 1);
    expect(s.rng).toBe(twin.rng);
    expect(s.uniqueRng).not.toBe(twin.uniqueRng);
  }
  const [s, twin] = pair('wolfEye', inMap());
  onKill(s, runOf(s), monster(), deriveBattleStats(s));
  onKill(twin, runOf(twin), monster(), deriveBattleStats(twin));
  expect(runOf(s).items).toBe(runOf(twin).items);
  expect(s.uniqueRng).toBe(twin.uniqueRng);
});

it('Kraken Leather leaves 1 life once per map', () => {
  const [s, twin] = pair('krakenLeather', (s) => {
    inMap({ life: 1e6, maxLife: 1e6, damage: 400 })(s);
    runOf(s).life = 1;
  });
  const st = at(s, 1);
  applyTicks(twin, 1, st);
  expect(twin.lastRun?.outcome).toBe('died');

  const run = runOf(s);
  applyTicks(s, 1, st);
  expect(s.activity.kind).toBe('map');
  expect(run.life).toBe(1);
  expect(run.saved).toBe(true);
  expect(run.log[run.log.length - 1]).toEqual({ kind: 'saved', monster: 'Test Monster' });
  expect(validateState(s)).toBe(true);
  applyTicks(s, 1, st);
  expect(s.activity.kind).toBe('dig');
  expect(s.lastRun?.outcome).toBe('died');
});

it('The Peacemaker strikes twice on every 5th hit, from its own stream', () => {
  const [s, twin] = pair('peacemaker', inMap({ life: 1e6, maxLife: 1e6, intervalS: 60 }));   // it never attacks within the test
  const st = at(s, 20);
  for (const x of [s, twin]) while (runOf(x).strikes < 5) applyTicks(x, 1, st);
  expect([runOf(s).strikes, runOf(twin).strikes]).toEqual([5, 5]);
  expect(hits(runOf(twin))).toBe(5);
  expect(hits(runOf(s))).toBe(6);
  expect(runOf(s).queue[0]?.life).toBeLessThan(runOf(twin).queue[0]?.life ?? 0);
  expect(s.rng).toBe(twin.rng);
  expect(s.uniqueRng).not.toBe(twin.uniqueRng);

  const r = decodeSave(encodeSave(s, 0));
  if (!r.ok) throw new Error(`save rejected: ${r.reason}`);
  expect(runOf(r.state).strikes).toBe(5);
});

it('the fixture\'s worn legendaries act from the first tick', () => {
  const r = decodeSave(fixture9.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(hasUnique(s, 'deepdelver')).toBe(true);
  expect(hasUnique(s, 'peacemaker')).toBe(true);
  expect(hasUnique(s, 'blackLantern')).toBe(false);
  const pick = s.equipped.mining.pickaxe;
  if (pick === undefined) throw new Error('no pickaxe worn');
  expect(itemLines(pick).at(-1)).toEqual({ text: UNIQUE_LINES.deepdelver, tone: 'special' });
  expect(UNIQUE_LINES.deepdelver).toBe('Every 25th metre is dug at once, and its find is doubled.');
  // its run plays on with the Peacemaker counting strikes, and stays a valid save
  const run = runOf(s);
  const st = deriveStats(s);
  for (let t = 0; t < 2_000 && s.activity.kind === 'map'; t++) applyTicks(s, 1, st);
  expect(run.strikes).toBeGreaterThan(0);
  expect(validateState(s)).toBe(true);
});

it('every unique has its spec line', () => {
  expect(UNIQUE_LINES).toEqual({
    deepdelver: 'Every 25th metre is dug at once, and its find is doubled.',
    golddigger: 'Gold veins also give a material of the band.',
    blackLantern: 'Hazards ahead show on the minimap, and hazards slow you by half as much.',
    longVoyage: 'The offline cap is doubled, and catch-up finds are doubled.',
    bandOfTheDeep: 'Critical hits heal 2 % of your life.',
    wolfEye: 'Champions and bosses drop one more item.',
    krakenLeather: 'Once per map, a killing blow leaves you at 1 life instead.',
    peacemaker: 'Every 5th hit strikes twice.',
  });
});

it('rollLegendary gives any of the legendaries, rolled for its own slot', () => {
  const gen = { rng: 5, nextId: 1 };
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const item = rollLegendary(gen, 5);
    const def = LEGENDARIES.find((d) => d.id === item.uniqueId);
    expect([item.rarity, item.slot, item.name]).toEqual(['legendary', def?.slot, def?.name]);
    seen.add(item.uniqueId ?? '');
  }
  expect(seen.size).toBe(LEGENDARIES.length);
});
