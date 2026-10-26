import { ascendancyPoints } from './ascendancy';
import { autoMapMaxTier, autoMapping, queueForAutoMap } from './autoMap';
import { LEVEL_CAP } from './balance';
import { clickTicks } from './clock';
import { applyTicks } from './dig';
import { isGear, setOfSlot } from './items';
import type { GearItem, MapItem, Rarity } from './items';
import { putMap, startMap } from './maps';
import { newGame } from './newGame';
import { PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, canAllocate, pointsToSpend } from './passives';
import { allocate } from './respec';
import { deriveStats } from './stats';
import type { GameState, TickEvent } from './types';

export interface SimOptions { seed?: number; days?: number; clickRate?: number }

export interface SimReport {
  firstMapSec: number; autoMapLevel: number; autoMapDay: number; capDay: number;
  deepestAtCap: number; frontierTierAtCap: number; frontierTierAfterDay: number;
  ascensionPointsAtCap: number;
  clears: Record<number, number>; losses: Record<number, number>;
}

const MINUTES_PER_DAY = 1440;
// 08:00, 13:00, 19:00 and 23:00, each fifteen minutes of active play.
const CHECK_IN_STARTS = [480, 780, 1140, 1380] as const;
const CHECK_IN_MINUTES = 15;
const MINUTE_TICKS = 60;
const MAX_FRONTIER = 20;
const SURVEYOR_ID = 'surveyor';
const RARITY_SCORE: Readonly<Record<Rarity, number>> = { normal: 1, magic: 1.5, rare: 2, legendary: 2.5 };

function gearScore(item: GearItem): number {
  return item.ilvl * RARITY_SCORE[item.rarity];
}

/**
 * The reference player's bag policy: maps to their stash, the best drop worn per set and slot (by item level times
 * rarity), and everything else dropped (sold; the run never spends Gold). Held loot is dropped too, so the bag never
 * stalls the dig.
 */
function settleInventory(state: GameState): void {
  for (let i = 0; i < state.bag.length; i++) {
    const item = state.bag[i];
    if (item?.type === 'map') {
      putMap(state, item);
      state.bag[i] = null;
    }
  }
  for (let i = 0; i < state.bag.length; i++) {
    const item = state.bag[i];
    if (item === undefined || item === null || !isGear(item)) continue;
    const set = setOfSlot(item.slot);
    const worn = state.equipped[set][item.slot];
    if (worn === undefined || gearScore(item) > gearScore(worn)) state.equipped[set][item.slot] = item;
    state.bag[i] = null;
  }
  state.bag.fill(null);
  state.overflow.length = 0;
}

/**
 * The shortest path from the start to Surveyor over the web's links, then the first node on it not yet allocated:
 * the next point to spend on the way there, or undefined if the whole path is allocated.
 */
function nextSurveyorNode(state: GameState): string | undefined {
  const parent = new Map<string, string | null>();
  parent.set(START_NODE_ID, null);
  const queue: string[] = [START_NODE_ID];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || id === SURVEYOR_ID) break;
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node === undefined) continue;
    for (const link of node.links) {
      if (parent.has(link)) continue;
      parent.set(link, id);
      queue.push(link);
    }
  }
  if (!parent.has(SURVEYOR_ID)) return undefined;
  const path: string[] = [];
  let current: string | null | undefined = SURVEYOR_ID;
  while (current !== null && current !== undefined) {
    path.push(current);
    current = parent.get(current);
  }
  path.reverse();
  return path.find((id) => id !== START_NODE_ID && !state.passives.allocated.includes(id));
}

interface PassivePolicy { nextSide: 'battle' | 'mining' }

/**
 * Spends every point: at level 30, along the path to Surveyor first; otherwise alternating the first allocatable
 * battle node and the first allocatable mining node. Returns whether Surveyor is allocated after the spend.
 */
function spendPassives(state: GameState, policy: PassivePolicy): boolean {
  let surveyorAllocated = state.passives.allocated.includes(SURVEYOR_ID);
  let spent = true;
  while (pointsToSpend(state) > 0 && spent) {
    spent = false;
    if (state.level >= 30 && !state.passives.allocated.includes(SURVEYOR_ID)) {
      const next = nextSurveyorNode(state);
      if (next !== undefined && allocate(state, next) === 'ok') {
        if (next === SURVEYOR_ID) surveyorAllocated = true;
        spent = true;
        continue;
      }
    }
    const sides: readonly ('battle' | 'mining')[] = policy.nextSide === 'battle'
      ? ['battle', 'mining'] : ['mining', 'battle'];
    for (const side of sides) {
      const node = PASSIVE_NODES.find((n) => n.side === side && canAllocate(state, n.id));
      if (node === undefined) continue;
      if (allocate(state, node.id) === 'ok') {
        policy.nextSide = side === 'battle' ? 'mining' : 'battle';
        spent = true;
        break;
      }
    }
  }
  return surveyorAllocated;
}

/** The highest-tier map in the stash at or below `maxTier`, or undefined if there is none. */
function bestAvailableMap(state: GameState, maxTier: number): MapItem | undefined {
  let best: MapItem | undefined;
  let bestTier = 0;
  for (const [key, list] of Object.entries(state.stash.maps)) {
    const tier = Number(key);
    if (tier > maxTier || tier <= bestTier) continue;
    const map = list[0];
    if (map === undefined) continue;
    best = map;
    bestTier = tier;
  }
  return best;
}

/** Queues every stashed map auto-mapping can reach, which is idempotent for maps already queued. */
function queueStashedMaps(state: GameState): void {
  if (!autoMapping(state)) return;
  const maxTier = autoMapMaxTier(state);
  for (const [key, list] of Object.entries(state.stash.maps)) {
    if (Number(key) > maxTier) continue;
    for (const map of list) queueForAutoMap(state, map.id);
  }
}

/**
 * Plays the reference week headlessly through the real tick, map and passive functions: four fifteen-minute check-ins
 * a day, offline digging capped per gap, the best drop worn, and points spent towards Surveyor at level 30. Pure and
 * deterministic for a given seed and options.
 */
export function runReference(options: SimOptions = {}): SimReport {
  const seed = options.seed ?? 12345;
  const days = options.days ?? 8;
  const clickRate = options.clickRate ?? 2;
  const totalMinutes = Math.max(0, Math.round(days * MINUTES_PER_DAY));
  const state = newGame(seed, 0);
  const passivePolicy: PassivePolicy = { nextSide: 'battle' };

  let frontier = 1;
  let firstMapSec = -1;
  let autoMapLevel = -1;
  let autoMapDay = -1;
  let capDay = -1;
  let capMinute = -1;
  let deepestAtCap = -1;
  let frontierTierAtCap = -1;
  const clears: Record<number, number> = {};
  const losses: Record<number, number> = {};

  let inAwayGap = false;
  let awayGapTicks = 0;
  let minute = 0;

  while (minute < totalMinutes) {
    minute += 1;

    // Settle last minute's finds before the next one: wear the best drop, stash the maps, spend the points, queue
    // what auto-mapping can run.
    settleInventory(state);
    if (spendPassives(state, passivePolicy) && autoMapLevel < 0) {
      autoMapLevel = state.level;
      autoMapDay = minute / MINUTES_PER_DAY;
    }
    queueStashedMaps(state);

    const minuteOfDay = (minute - 1) % MINUTES_PER_DAY;
    const active = CHECK_IN_STARTS.some((start) => minuteOfDay >= start && minuteOfDay < start + CHECK_IN_MINUTES);
    const events: TickEvent[] = [];

    if (!active) {
      if (!inAwayGap) {
        inAwayGap = true;
        awayGapTicks = 0;
      }
      const stats = deriveStats(state);
      const capTicks = Math.floor((stats.offlineCapMs / 1000) * stats.autoTicksPerSecond);
      const ticks = Math.max(0, Math.min(MINUTE_TICKS, capTicks - awayGapTicks));
      if (ticks > 0) {
        applyTicks(state, ticks, stats, events, state.paused, true);
        awayGapTicks += ticks;
      }
    } else {
      inAwayGap = false;
      const stats = deriveStats(state);
      if (state.activity.kind !== 'map') {
        const map = bestAvailableMap(state, Math.min(MAX_FRONTIER, frontier + 1));
        if (map !== undefined) startMap(state, map.id);
      }
      const running = state.activity.kind === 'map';
      applyTicks(state, MINUTE_TICKS, stats, events, false, false);
      if (!running) {
        const clicks = Math.max(0, Math.round(clickRate * 60));
        for (let i = 0; i < clicks; i++) clickTicks(state, stats, events);
      }
    }

    // Every runEnd is counted: away auto-mapping can finish several maps in one minute, where state.lastRun would keep
    // only the last.
    for (const event of events) {
      if (event.kind === 'find' && event.find.kind === 'map' && firstMapSec < 0) firstMapSec = minute * 60;
      if (event.kind !== 'runEnd') continue;
      const { map, outcome } = event.result;
      if (outcome === 'cleared') {
        clears[map.tier] = (clears[map.tier] ?? 0) + 1;
        frontier = Math.min(MAX_FRONTIER, Math.max(frontier, map.tier + 1));
      } else if (outcome === 'died') {
        losses[map.tier] = (losses[map.tier] ?? 0) + 1;
      }
    }
    // The find log is the source of truth if a map was logged outside this minute's event batch.
    if (firstMapSec < 0 && state.finds.some((find) => find.kind === 'map')) firstMapSec = minute * 60;

    if (capMinute < 0 && state.level >= LEVEL_CAP) {
      capMinute = minute;
      capDay = minute / MINUTES_PER_DAY;
      deepestAtCap = state.deepest;
      frontierTierAtCap = frontier;
    }
    // The wall after the cap: one more day, or the end of the requested run if that comes first.
    if (capMinute >= 0 && minute >= Math.min(totalMinutes, capMinute + MINUTES_PER_DAY)) break;
  }

  return {
    firstMapSec,
    autoMapLevel,
    autoMapDay,
    capDay,
    deepestAtCap,
    frontierTierAtCap,
    frontierTierAfterDay: frontier,
    ascensionPointsAtCap: ascendancyPoints(deepestAtCap),
    clears,
    losses,
  };
}
