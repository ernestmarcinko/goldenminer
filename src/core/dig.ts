import {
  DIAMOND_CHANCE_CAP, FINDS_LOG_LIMIT, HARD_ROCK_MULTIPLIER, LOOT_NOTES_KEPT, TICKS_PER_METRE_AT_PARITY,
  diamondChancePerTick, goldPerTick, hardness,
} from './balance';
import { metreTier, tierAt } from './bands';
import { mapTick } from './combat';
import { rollChest, rollGem } from './itemGen';
import { receiveItem } from './loot';
import { addMap } from './maps';
import { fillAhead, metreChances, rollGallery, rollMetre } from './metres';
import { mulberry32, nextRandom } from './rng';
import type { FindRecord, GameState, LootNote, MetreRoll, Stats, TickEvent } from './types';

export function collect(
  state: GameState, roll: MetreRoll, depth: number, tier: number, stats: Stats, events?: TickEvent[], bonus = false,
): void {
  if (roll.feature === null) return;
  let amount = roll.amount;
  if (roll.feature === 'goldVein') {
    amount = Math.round(roll.amount * stats.goldMultiplier);
    state.gold += amount;
  } else if (roll.feature === 'diamondVein') {
    amount = Math.round(roll.amount * stats.diamondMultiplier);
    state.diamonds += amount;
  }
  const find: FindRecord = { id: state.nextId++, depth, kind: roll.feature, amount, tick: state.tickCount };
  if (bonus) find.bonus = true;
  const loot: LootNote[] = [];
  if (roll.feature === 'map') {
    addMap(state, tier, depth);
  } else if (roll.feature === 'chest') {
    for (const item of rollChest(state, tier)) loot.push(...receiveItem(state, item, 'mining'));
  } else if (roll.feature === 'gem') {
    loot.push(...receiveItem(state, rollGem(state, tier), 'mining'));
  }
  if (loot.length > 0) find.loot = loot;
  state.finds.push(find);
  const stale = state.finds[state.finds.length - 1 - LOOT_NOTES_KEPT];
  if (stale !== undefined) delete stale.loot;
  if (state.finds.length > FINDS_LOG_LIMIT) state.finds.splice(0, state.finds.length - FINDS_LOG_LIMIT);
  events?.push({ kind: 'find', find });
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
    if (state.worldGen === 2 && done.feature === null) collectBonus(state, next, stats, events);
    delete state.ahead[next];
    state.deepest = next;
    state.depth = next;
    fillAhead(state, stats);
    if (state.overflow.length > 0) {
      state.progress -= Math.floor(state.progress);
      events?.push({ kind: 'metre', depth: next, gallery: false });
      return;
    }
    state.progress *= effectiveHardness(next, done) / effectiveHardness(next + 1, faceRoll(state, stats));
    events?.push({ kind: 'metre', depth: next, gallery: false });
  }
}

function digGallery(state: GameState, stats: Stats, events?: TickEvent[]): void {
  const step = stats.digPower / (hardness(state.depth + 1) * TICKS_PER_METRE_AT_PARITY);
  if (!(step > 0) || !Number.isFinite(step)) return;
  state.galleryProgress += step;
  while (state.galleryProgress >= 1) {
    state.galleryProgress -= 1;
    const roll = rollGallery(state, state.depth, stats);
    collect(state, roll, state.depth, tierAt(state.depth), stats, events);
    events?.push({ kind: 'metre', depth: state.depth, gallery: true });
    if (state.overflow.length > 0) {
      state.galleryProgress -= Math.floor(state.galleryProgress);
      return;
    }
  }
}

export function applyTicks(state: GameState, count: number, stats: Stats, events?: TickEvent[]): void {
  for (let i = 0; i < count; i++) {
    // A running map takes the whole tick: no digging, no Gold, no Diamond draw; held loot doesn't pause it.
    if (state.activity.kind === 'map') {
      mapTick(state, stats, events);
      state.tickCount += 1;
      continue;
    }
    if (state.overflow.length > 0) {
      state.tickCount += 1;
      continue;
    }
    const tier = tierAt(state.depth);
    const pay = goldPerTick(tier) * stats.goldMultiplier + state.goldCarry;
    const whole = Math.floor(pay);
    state.goldCarry = pay - whole;
    state.gold += whole;
    if (whole > 0) events?.push({ kind: 'gold', amount: whole });

    const draw = mulberry32(state.rng);
    state.rng = draw.state;
    if (draw.value < Math.min(DIAMOND_CHANCE_CAP, diamondChancePerTick(tier) * stats.diamondMultiplier)) {
      state.diamonds += 1;
      events?.push({ kind: 'diamond', amount: 1 });
    }

    if (state.depth === state.deepest) digFace(state, stats, events);
    else digGallery(state, stats, events);

    state.tickCount += 1;
  }
}

export function moveTo(state: GameState, depth: number): boolean {
  if (!Number.isInteger(depth) || depth < 0 || depth > state.deepest) return false;
  if (depth === state.depth) return true;
  state.depth = depth;
  state.galleryProgress = 0;
  return true;
}
