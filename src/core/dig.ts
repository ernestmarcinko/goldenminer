import { FINDS_LOG_LIMIT, HARD_ROCK_MULTIPLIER, LOOT_NOTES_KEPT, TICKS_PER_METRE_AT_PARITY, hardness } from './balance';
import { metreTier } from './bands';
import { mapTick } from './combat';
import { rollChest, rollGem } from './itemGen';
import type { Material } from './items';
import { hazardFactor, materialAmount, metreLayer, pickMaterial } from './layer';
import { drainOverflow, receiveItem, receiveMaterial } from './loot';
import { addMap } from './maps';
import { fillAhead, metreChances, rollMetre } from './metres';
import { nextRandom } from './rng';
import type { FindRecord, GameState, LootNote, MetreRoll, Stats, TickEvent } from './types';

function logFind(state: GameState, find: FindRecord, events?: TickEvent[]): void {
  state.finds.push(find);
  const stale = state.finds[state.finds.length - 1 - LOOT_NOTES_KEPT];
  if (stale !== undefined) delete stale.loot;
  if (state.finds.length > FINDS_LOG_LIMIT) state.finds.splice(0, state.finds.length - FINDS_LOG_LIMIT);
  events?.push({ kind: 'find', find });
}

export function collect(
  state: GameState, roll: MetreRoll, depth: number, tier: number, stats: Stats, events?: TickEvent[], bonus = false,
): void {
  if (roll.feature === null) return;
  let amount = roll.amount;
  if (roll.feature === 'goldVein') {
    amount = Math.round(roll.amount * stats.goldMultiplier * stats.veinMultiplier);
    state.gold += amount;
    if (amount > 0) events?.push({ kind: 'gold', amount });
  } else if (roll.feature === 'diamondVein') {
    amount = Math.round(roll.amount * stats.diamondMultiplier * stats.veinMultiplier);
    state.diamonds += amount;
    if (amount > 0) events?.push({ kind: 'diamond', amount });
  }
  const find: FindRecord = { id: state.nextId++, depth, kind: roll.feature, amount, tick: state.tickCount };
  if (bonus) find.bonus = true;
  const loot: LootNote[] = [];
  const origin = { kind: 'metre', metre: depth } as const;
  if (roll.feature === 'map') {
    loot.push(...addMap(state, tier, depth));
  } else if (roll.feature === 'chest') {
    for (const item of rollChest(state, tier)) loot.push(...receiveItem(state, item, origin));
  } else if (roll.feature === 'gem') {
    loot.push(...receiveItem(state, rollGem(state, tier), origin));
  }
  if (loot.length > 0) find.loot = loot;
  logFind(state, find, events);
}

/** A material vein, seeded or from ore find: its amount times vein yield goes to the bag (or is held), and is logged. */
function collectMaterialVein(
  state: GameState, vein: { material: Material; amount: number }, depth: number, stats: Stats, events?: TickEvent[],
  bonus = false,
): void {
  const amount = Math.round(vein.amount * stats.veinMultiplier);
  receiveMaterial(state, vein.material, amount, { kind: 'metre', metre: depth });
  const find: FindRecord = {
    id: state.nextId++, depth, kind: 'materialVein', material: vein.material, amount, tick: state.tickCount,
  };
  if (bonus) find.bonus = true;
  logFind(state, find, events);
}

// Ore find adds a material vein where the seed left a metre empty of everything. It draws only when the miner has
// ore find, so without it the loot stream is the same as before ore find existed.
function collectOreBonus(state: GameState, depth: number, stats: Stats, events?: TickEvent[]): void {
  if (!(stats.oreBonusChance > 0) || nextRandom(state) >= stats.oreBonusChance) return;
  const material = pickMaterial(depth, nextRandom(state));
  const amount = materialAmount(material, depth, nextRandom(state));
  collectMaterialVein(state, { material, amount }, depth, stats, events, true);
}

function faceRoll(state: GameState, stats: Stats): MetreRoll {
  const m = state.deepest + 1;
  let roll = state.ahead[m];
  if (roll === undefined) {
    roll = rollMetre(state.seed, m, metreChances(state, stats));
    state.ahead[m] = roll;
  }
  return roll;
}

const BONUS_KINDS = ['chest', 'gem', 'map'] as const;

// Find gear adds finds on metres the seed left empty; the draw comes from the player's own loot stream.
function collectBonus(state: GameState, depth: number, stats: Stats, events?: TickEvent[]): void {
  const { chest, gem, map } = stats.bonusChances;
  if (chest + gem + map <= 0) return;
  const u = nextRandom(state);
  let cumulative = 0;
  for (const kind of BONUS_KINDS) {
    cumulative += stats.bonusChances[kind];
    if (u < cumulative) {
      collect(state, { feature: kind, amount: 0, hardRock: false }, depth, metreTier(depth), stats, events, true);
      return;
    }
  }
}

/** Ticks one metre takes: its hardness, hard rock and any hazard, over dig power. */
function ticksForMetre(seed: number, metre: number, roll: MetreRoll, stats: Stats): number {
  const hard = hardness(metre) * (roll.hardRock ? HARD_ROCK_MULTIPLIER : 1);
  return hard * hazardFactor(metreLayer(seed, metre).hazard, stats.hazardWard) * TICKS_PER_METRE_AT_PARITY / stats.digPower;
}

/** Ticks the face metre needs at the current dig power and hazard ward. */
export function faceTicksPerMetre(state: GameState, stats: Stats): number {
  return ticksForMetre(state.seed, state.deepest + 1, faceRoll(state, stats), stats);
}

/** The auto-dig rate at the face; null while digging is paused (a map runs or loot is held). */
export function digSpeed(state: GameState, stats: Stats): { metresPerMinute: number; secondsToNext: number } | null {
  if (state.activity.kind === 'map' || state.overflow.length > 0) return null;
  const m = state.deepest + 1;
  const roll = state.ahead[m] ?? rollMetre(state.seed, m, metreChances(state, stats));
  const ticks = ticksForMetre(state.seed, m, roll, stats);
  const rate = stats.autoTicksPerSecond;
  if (!(ticks > 0) || !(rate > 0) || !Number.isFinite(ticks)) return null;
  return { metresPerMinute: 60 * rate / ticks, secondsToNext: Math.max(0, 1 - state.progress) * ticks / rate };
}

function digFace(state: GameState, stats: Stats, events?: TickEvent[]): void {
  const roll = faceRoll(state, stats);
  const m = state.deepest + 1;
  const step = 1 / ticksForMetre(state.seed, m, roll, stats);
  if (!(step > 0) || !Number.isFinite(step)) return;
  state.progress += step;
  while (state.progress >= 1) {
    state.progress -= 1;
    const next = state.deepest + 1;
    const done = faceRoll(state, stats);
    collect(state, done, next, metreTier(next), stats, events);
    // A material vein shows only where the seeded roll left the metre empty, ore find only where the layer left it
    // empty too, and find gear adds its bonus after them.
    if (done.feature === null) {
      const vein = metreLayer(state.seed, next).vein;
      if (vein !== null) collectMaterialVein(state, vein, next, stats, events);
      else collectOreBonus(state, next, stats, events);
      if (state.worldGen === 2) collectBonus(state, next, stats, events);
    }
    delete state.ahead[next];
    state.deepest = next;
    fillAhead(state, stats);
    if (state.overflow.length > 0) {
      state.progress -= Math.floor(state.progress);
      events?.push({ kind: 'metre', depth: next });
      return;
    }
    state.progress *= ticksForMetre(state.seed, next, done, stats) / faceTicksPerMetre(state, stats);
    events?.push({ kind: 'metre', depth: next });
  }
}

/** Runs `count` ticks. A paused dig tick is dropped, not banked: it still counts, and nothing digs it later. */
export function applyTicks(state: GameState, count: number, stats: Stats, events?: TickEvent[], digPaused = false): void {
  for (let i = 0; i < count; i++) {
    // A running map takes the whole tick, with no digging; neither a pause nor held loot stops it.
    if (state.activity.kind === 'map') {
      mapTick(state, stats, events);
      state.tickCount += 1;
      continue;
    }
    // Held loot stops digging only while it has no room, whatever freed a cell: the gate heals itself. A drain draws nothing.
    if (state.overflow.length > 0) drainOverflow(state);
    if (digPaused || state.overflow.length > 0) {
      state.tickCount += 1;
      continue;
    }
    // Digging pays nothing by the tick and draws nothing: Gold and Diamonds come from the veins it digs into.
    digFace(state, stats, events);
    state.tickCount += 1;
  }
}
