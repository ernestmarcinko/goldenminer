import {
  FINDS_LOG_LIMIT, HARD_ROCK_MULTIPLIER, TICKS_PER_METRE_AT_PARITY,
  diamondChancePerTick, goldPerTick, hardness,
} from './balance';
import { tierAt } from './bands';
import { fillAhead, rollGallery, rollMetre } from './metres';
import { mulberry32 } from './rng';
import type { FindRecord, GameState, MetreRoll, Stats, TickEvent } from './types';

export function collect(state: GameState, roll: MetreRoll, depth: number, events?: TickEvent[]): void {
  if (roll.feature === null) return;
  if (roll.feature === 'goldVein') state.gold += roll.amount;
  else if (roll.feature === 'diamondVein') state.diamonds += roll.amount;
  const find: FindRecord = { id: state.nextId++, depth, kind: roll.feature, amount: roll.amount, tick: state.tickCount };
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

function digFace(state: GameState, stats: Stats, events?: TickEvent[]): void {
  const roll = faceRoll(state, stats);
  const m = state.deepest + 1;
  const effective = hardness(m) * (roll.hardRock ? HARD_ROCK_MULTIPLIER : 1);
  const step = stats.digPower / (effective * TICKS_PER_METRE_AT_PARITY);
  if (!(step > 0) || !Number.isFinite(step)) return;
  state.progress += step;
  while (state.progress >= 1) {
    state.progress -= 1;
    const next = state.deepest + 1;
    collect(state, faceRoll(state, stats), next, events);
    delete state.ahead[next];
    state.deepest = next;
    state.depth = next;
    fillAhead(state, stats);
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
    collect(state, roll, state.depth, events);
    events?.push({ kind: 'metre', depth: state.depth, gallery: true });
  }
}

export function applyTicks(state: GameState, count: number, stats: Stats, events?: TickEvent[]): void {
  for (let i = 0; i < count; i++) {
    const tier = tierAt(state.depth);
    const gold = goldPerTick(tier);
    state.gold += gold;
    events?.push({ kind: 'gold', amount: gold });

    const draw = mulberry32(state.rng);
    state.rng = draw.state;
    if (draw.value < diamondChancePerTick(tier)) {
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
