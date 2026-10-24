import { FINDS_LOG_LIMIT, HARD_ROCK_MULTIPLIER, LOOT_NOTES_KEPT, TICKS_PER_METRE_AT_PARITY, hardness } from './balance';
import { metreTier } from './bands';
import { mapTick } from './combat';
import { rollChest, rollGem } from './itemGen';
import type { Material } from './items';
import { metreLayer } from './layer';
import { receiveItem, receiveMaterial } from './loot';
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
    amount = Math.round(roll.amount * stats.goldMultiplier);
    state.gold += amount;
    if (amount > 0) events?.push({ kind: 'gold', amount });
  } else if (roll.feature === 'diamondVein') {
    amount = Math.round(roll.amount * stats.diamondMultiplier);
    state.diamonds += amount;
    if (amount > 0) events?.push({ kind: 'diamond', amount });
  }
  const find: FindRecord = { id: state.nextId++, depth, kind: roll.feature, amount, tick: state.tickCount };
  if (bonus) find.bonus = true;
  const loot: LootNote[] = [];
  if (roll.feature === 'map') {
    addMap(state, tier, depth);
  } else if (roll.feature === 'chest') {
    for (const item of rollChest(state, tier)) loot.push(...receiveItem(state, item));
  } else if (roll.feature === 'gem') {
    loot.push(...receiveItem(state, rollGem(state, tier)));
  }
  if (loot.length > 0) find.loot = loot;
  logFind(state, find, events);
}

/** A material vein from the seeded layer: its material goes to the bag (or the Materials tab) and is logged. */
function collectMaterialVein(
  state: GameState, vein: { material: Material; amount: number }, depth: number, events?: TickEvent[],
): void {
  receiveMaterial(state, vein.material, vein.amount);
  const find: FindRecord = {
    id: state.nextId++, depth, kind: 'materialVein', material: vein.material, amount: vein.amount, tick: state.tickCount,
  };
  logFind(state, find, events);
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

function effectiveHardness(metre: number, roll: MetreRoll): number {
  return hardness(metre) * (roll.hardRock ? HARD_ROCK_MULTIPLIER : 1);
}

function digFace(state: GameState, stats: Stats, events?: TickEvent[]): void {
  const roll = faceRoll(state, stats);
  const m = state.deepest + 1;
  const step = stats.digPower / (effectiveHardness(m, roll) * TICKS_PER_METRE_AT_PARITY);
  if (!(step > 0) || !Number.isFinite(step)) return;
  state.progress += step;
  while (state.progress >= 1) {
    state.progress -= 1;
    const next = state.deepest + 1;
    const done = faceRoll(state, stats);
    collect(state, done, next, metreTier(next), stats, events);
    // A material vein shows only where the seeded roll left the metre empty, and find gear adds its bonus after it.
    if (done.feature === null) {
      const vein = metreLayer(state.seed, next).vein;
      if (vein !== null) collectMaterialVein(state, vein, next, events);
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
    state.progress *= effectiveHardness(next, done) / effectiveHardness(next + 1, faceRoll(state, stats));
    events?.push({ kind: 'metre', depth: next });
  }
}

export function applyTicks(state: GameState, count: number, stats: Stats, events?: TickEvent[]): void {
  for (let i = 0; i < count; i++) {
    // A running map takes the whole tick, with no digging; held loot doesn't pause it.
    if (state.activity.kind === 'map') {
      mapTick(state, stats, events);
      state.tickCount += 1;
      continue;
    }
    if (state.overflow.length > 0) {
      state.tickCount += 1;
      continue;
    }
    // Digging pays nothing by the tick and draws nothing: Gold and Diamonds come from the veins it digs into.
    digFace(state, stats, events);
    state.tickCount += 1;
  }
}
