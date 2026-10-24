import {
  DIAMOND_CHANCE_CAP, FINDS_LOG_LIMIT, HARD_ROCK_MULTIPLIER, TICKS_PER_METRE_AT_PARITY,
  diamondChancePerTick, goldPerTick, hardness,
} from './balance';
import { tierAt } from './bands';
import { fillAhead, rollGallery, rollMetre } from './metres';
import { mulberry32 } from './rng';
import type { FindRecord, GameState, MetreRoll, Stats, TickEvent } from './types';

export function collect(state: GameState, roll: MetreRoll, depth: number, stats: Stats, events?: TickEvent[]): void {
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
  state.finds.push(find);
  if (state.finds.length > FINDS_LOG_LIMIT) state.finds.splice(0, state.finds.length - FINDS_LOG_LIMIT);
  events?.push({ kind: 'find', find });
}

function faceRoll(state: GameState, stats: Stats): MetreRoll {
  const m = state.deepest + 1;
  let roll = state.ahead[m];
  if (roll === undefined) {
    roll = rollMetre(state.seed, m, stats);
    state.ahead[m] = roll;
  }
  return roll;
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
    collect(state, done, next, stats, events);
    delete state.ahead[next];
    state.deepest = next;
    state.depth = next;
    fillAhead(state, stats);
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
    collect(state, roll, state.depth, stats, events);
    events?.push({ kind: 'metre', depth: state.depth, gallery: true });
  }
}

export function applyTicks(state: GameState, count: number, stats: Stats, events?: TickEvent[]): void {
  for (let i = 0; i < count; i++) {
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
