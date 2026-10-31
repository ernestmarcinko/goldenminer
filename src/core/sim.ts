import { ascendancyPoints } from './ascendancy';
import { ascend } from './ascend';
import { earnedCount } from './achievements';
import { autoMapQueueSize, autoMapping, queueForAutoMap, unqueueForAutoMap } from './autoMap';
import { LEVEL_CAP, STOCK_SIZE } from './balance';
import { armorReduction, deriveBattleStats, type BattleStats } from './battle';
import { firstEmpty } from './cells';
import { clickTicks } from './clock';
import { applyTicks } from './dig';
import { gateWall, isGateTier, type Wall } from './gates';
import { BATTLE_SLOTS, isGear, setOfSlot } from './items';
import type { BattleSlot, GearItem, MapItem, Rarity } from './items';
import { NO_MAP_EFFECTS } from './mapMods';
import { putMap, startMap } from './maps';
import { monsterState } from './monsters';
import { newGame } from './newGame';
import { PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, canAllocate, pointsToSpend } from './passives';
import { allocate } from './respec';
import { speciesOf } from './species';
import { deriveStats } from './stats';
import { buyStock, stockAt, stockPrice } from './trader';
import type { GameState, TickEvent } from './types';

/**
 * How the reference player picks battle gear: `defenceAware` scores it against the next gate's wall and keeps a spare
 * a slot for the other wall; `rawPower` scores damage and life alone and keeps no spare.
 */
export type GearPolicy = 'defenceAware' | 'rawPower';

export interface SimOptions {
  seed?: number; days?: number; clickRate?: number;
  /** The first run stops after this many minutes, when given, instead of after `days`. */
  minutes?: number;
  /** The share of each 15-minute check-in spent playing; the rest is inventory and reading, with digging paused. */
  activeEfficiency?: number;
  /** How the reference player picks gear; `defenceAware` by default. */
  policy?: GearPolicy;
}

/**
 * A gate of the first run, in days (-1 if not yet): when it became the frontier's target (whether or not a gate map was
 * in hand), when it was first attempted and when cleared, and the runs it took.
 */
export interface GateRecord {
  tier: number; reachedDay: number; firstAttemptDay: number; clearedDay: number; attempts: number;
}

export interface SimReport {
  firstMapSec: number; autoMapLevel: number; autoMapDay: number; capDay: number;
  deepestAtCap: number; frontierTierAtCap: number; frontierTierAfterDay: number;
  ascensionPointsAtCap: number;
  /** The level bonus a second run earns at the cap: the points above the depth term (0 if the second cap wasn't reached). */
  levelBonusSecondRun: number;
  /** The day each level was first reached, for reading the curve. */
  levelDays: Record<number, number>;
  clears: Record<number, number>; losses: Record<number, number>;
  /** Every gate reached in the first run, in tier order. */
  gates: GateRecord[];
  /** The achievements earned at the end of the first day, -1 if the run was shorter. */
  achievementsAtDay1: number;
  /** The achievements earned when level 100 was first reached, -1 if it wasn't. */
  achievementsAtCap: number;
  /** The achievements earned when each level was first reached. */
  achievementsAtLevel: Record<number, number>;
  /** Days into the second run to reach level 100 (-1 if it wasn't). */
  secondCapDay: number;
}

const MINUTES_PER_DAY = 1440;
// 08:00, 13:00, 19:00 and 23:00, each fifteen minutes of active play.
const CHECK_IN_STARTS = [480, 780, 1140, 1380] as const;
const CHECK_IN_MINUTES = 15;
const MINUTE_TICKS = 60;
const MAX_FRONTIER = 100;
const SURVEYOR_ID = 'surveyor';
// How many maps the reference player queues for its time away: the best few it farms, not the whole stash.
const AWAY_QUEUE_MAPS = 30;
const RARITY_SCORE: Readonly<Record<Rarity, number>> = { normal: 1, magic: 1.5, rare: 2, legendary: 2.5 };
/**
 * How much the power score must rise over the last failed attempt's before a gate is tried again, as a share (0.03 is
 * 3 %). Small, since the gate step itself is the wall: the reference player retries most check-ins once a farmed
 * level, item or achievement has moved the score at all.
 */
export const GATE_RETRY_MARGIN = 0.03;
/** A gate not retried for this many check-ins (a day) since its last attempt is retried whatever the score. */
const GATE_RETRY_FALLBACK_CHECK_INS = 4;

function gearScore(item: GearItem): number {
  return item.ilvl * RARITY_SCORE[item.rarity];
}

const otherWall = (wall: Wall): Wall => (wall === 'physical' ? 'elemental' : 'physical');

/** The first gate tier above `tier`. */
function gateAfter(tier: number): number {
  let next = Math.max(0, Math.floor(tier)) + 1;
  while (!isGateTier(next)) next++;
  return next;
}

/** What gear is scored against: a wall, and the hit of a normal monster of the gate tier it stands at. */
interface PowerTarget { wall: Wall; hit: number }

/** The hit of a normal monster of `tier`, averaged over its species, with `wall` as its damage type. */
function powerTarget(tier: number, wall: Wall): PowerTarget {
  const species = speciesOf(tier);
  let sum = 0;
  species.forEach((_, i) => {
    sum += monsterState(tier, { species: i, rank: 'normal', name: '', mods: [], extra: 0 }, NO_MAP_EFFECTS, wall).damage;
  });
  return { wall, hit: species.length > 0 ? sum / species.length : 1 };
}

/**
 * The power score: damage per second times effective life. Effective life is the life that takes the target's hit
 * after armour (a physical wall) or resistance (an elemental one), in raw hits; `rawPower` reads the raw life alone.
 */
function powerScore(b: BattleStats, level: number, policy: GearPolicy, target: PowerTarget): number {
  const dps = ((b.damageMin + b.damageMax) / 2 + b.elementalDamage)
    * (1 + b.critChance * (b.critMultiplier - 1)) * b.attacksPerSecond;
  if (policy === 'rawPower') return dps * b.maxLife;
  const raw = target.hit;
  const taken = target.wall === 'physical'
    ? raw * (1 - armorReduction(b.armor, level, raw))
    : raw * (1 - b.resistAll / 100);
  return dps * b.maxLife * (raw / Math.max(taken, raw * 1e-6));
}

/** The power score as worn now. */
function currentScore(state: GameState, policy: GearPolicy, target: PowerTarget): number {
  return powerScore(deriveBattleStats(state), state.level, policy, target);
}

/** The power scores against each target with `item` worn in `slot` (the rest as worn), leaving the state as it was. */
function scoresWearing(
  state: GameState, slot: BattleSlot, item: GearItem, policy: GearPolicy, targets: readonly PowerTarget[],
): number[] {
  const worn = state.equipped.battle[slot];
  state.equipped.battle[slot] = item;
  const b = deriveBattleStats(state);
  if (worn === undefined) delete state.equipped.battle[slot];
  else state.equipped.battle[slot] = worn;
  return targets.map((target) => powerScore(b, state.level, policy, target));
}

/** A gate's two targets: its own wall, which the worn gear is fitted to, and the other, kept for by the spares. */
interface GateTargets { wall: PowerTarget; other: PowerTarget }

function gateTargets(seed: number, tier: number): GateTargets {
  const wall = gateWall(seed, tier) ?? 'physical';
  return { wall: powerTarget(tier, wall), other: powerTarget(tier, otherWall(wall)) };
}

/**
 * Per battle slot, gathers the worn piece, the spare in the General stash and any in the bag, and wears the one that
 * scores best against the gate's wall. `defenceAware` keeps the best of the rest against the other wall as the slot's
 * spare in the General stash; everything else is dropped.
 */
function fitBattleGear(state: GameState, policy: GearPolicy, gate: GateTargets): void {
  const targets = [gate.wall, gate.other];
  for (const slot of BATTLE_SLOTS) {
    const candidates: GearItem[] = [];
    const worn = state.equipped.battle[slot];
    if (worn !== undefined) candidates.push(worn);
    for (let i = 0; i < state.stash.general.length; i++) {
      const spare = state.stash.general[i];
      if (spare?.slot !== slot) continue;
      candidates.push(spare);
      state.stash.general[i] = null;
    }
    for (let i = 0; i < state.bag.length; i++) {
      const item = state.bag[i];
      if (item?.type !== 'gear' || item.slot !== slot) continue;
      candidates.push(item);
      state.bag[i] = null;
    }
    const scored = candidates.map((item) => ({ item, scores: scoresWearing(state, slot, item, policy, targets) }));
    // Ties keep the earlier candidate: the worn piece, then the spare, then the bag in order.
    let best: (typeof scored)[number] | undefined;
    for (const c of scored) if (best === undefined || (c.scores[0] ?? 0) > (best.scores[0] ?? 0)) best = c;
    if (best === undefined) continue;
    state.equipped.battle[slot] = best.item;
    if (policy !== 'defenceAware') continue;
    let spare: (typeof scored)[number] | undefined;
    for (const c of scored) {
      if (c !== best && (spare === undefined || (c.scores[1] ?? 0) > (spare.scores[1] ?? 0))) spare = c;
    }
    const cell = firstEmpty(state.stash.general);
    if (spare !== undefined && cell >= 0) state.stash.general[cell] = spare.item;
  }
}

/**
 * The defence-aware swap before a gate: per battle slot, wears whichever of the worn piece, its spare and any in the
 * bag scores best against `wall` at gate `tier` (the first gate by default), and keeps the best of the rest against the
 * other wall as the spare in the General stash. Everything else in the bag is dropped.
 */
export function chooseGear(state: GameState, wall: Wall, tier: number = gateAfter(0)): void {
  fitBattleGear(state, 'defenceAware', { wall: powerTarget(tier, wall), other: powerTarget(tier, otherWall(wall)) });
  state.bag.fill(null);
}

/**
 * The reference player's bag policy: maps to their stash, the best mining drop worn per slot (by item level times
 * rarity), battle drops fitted by the gear policy against the next gate's wall, and everything else dropped.
 * Held loot is dropped too, so the bag never stalls the dig. `refit` fits the battle gear even with none in the bag.
 */
function settleInventory(state: GameState, policy: GearPolicy, gate: GateTargets, refit: boolean): void {
  let battle = refit;
  for (let i = 0; i < state.bag.length; i++) {
    const item = state.bag[i];
    if (item === undefined || item === null) continue;
    if (item.type === 'map') {
      putMap(state, item);
      state.bag[i] = null;
      continue;
    }
    if (!isGear(item)) continue;
    const set = setOfSlot(item.slot);
    if (set === 'battle') {
      battle = true;
      continue;
    }
    const worn = state.equipped[set][item.slot];
    if (worn === undefined || gearScore(item) > gearScore(worn)) state.equipped[set][item.slot] = item;
    state.bag[i] = null;
  }
  if (battle) fitBattleGear(state, policy, gate);
  state.bag.fill(null);
  state.overflow.length = 0;
}

/**
 * The merchant at a check-in: buys, in stock order, each battle piece it can afford that raises the power score
 * against the next gate's wall, and fits it at once. Gold otherwise accumulates.
 */
function shopTrader(state: GameState, policy: GearPolicy, gate: GateTargets): void {
  const target = gate.wall;
  for (let i = 0; i < STOCK_SIZE; i++) {
    const item = stockAt(state, i);
    if (item === undefined || item.type !== 'gear' || setOfSlot(item.slot) !== 'battle') continue;
    if (state.gold < stockPrice(item)) continue;
    const slot = item.slot as BattleSlot;
    const [withIt = 0] = scoresWearing(state, slot, item, policy, [target]);
    if (withIt <= currentScore(state, policy, target)) continue;
    if (buyStock(state, i).result !== 'ok') continue;
    fitBattleGear(state, policy, gate);
    state.bag.fill(null);
  }
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

/**
 * The number of nodes on the shortest path from the start to Surveyor, excluding the start. Read off the web rather
 * than hard-coded, so re-laying out the tree keeps the reference run pacing itself to Surveyor's real depth.
 */
function surveyorPathLength(): number {
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
  if (!parent.has(SURVEYOR_ID)) return 0;
  let count = 0;
  let current: string | null | undefined = SURVEYOR_ID;
  while (current !== null && current !== undefined) {
    count++;
    current = parent.get(current);
  }
  return count - 1;
}

interface PassivePolicy { nextSide: 'battle' | 'mining'; lastPathLevel: number }

/** The level the reference player plans to take Surveyor at, and the level they start saving the path for it. */
const SURVEYOR_LEVEL = 30;
const SURVEYOR_PATH = surveyorPathLength();

/**
 * Spends every point. From the level that leaves one point per level-up for the path to Surveyor, it takes one path
 * node a level, so Surveyor lands at about level 30; the rest of each level's points alternate the first allocatable
 * battle node and the first allocatable mining node. Returns whether Surveyor is allocated.
 */
function spendPassives(state: GameState, policy: PassivePolicy): boolean {
  let surveyorAllocated = state.passives.allocated.includes(SURVEYOR_ID);
  let spent = true;
  while (pointsToSpend(state) > 0 && spent) {
    spent = false;
    const path = SURVEYOR_LEVEL - SURVEYOR_PATH + 1;
    if (state.level >= path && !state.passives.allocated.includes(SURVEYOR_ID) && policy.lastPathLevel < state.level) {
      const next = nextSurveyorNode(state);
      if (next !== undefined && allocate(state, next) === 'ok') {
        policy.lastPathLevel = state.level;
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

/** The first stashed map of `tier`, or undefined if there is none. */
function stashedMap(state: GameState, tier: number): MapItem | undefined {
  return state.stash.maps[tier]?.[0];
}

/**
 * Sets the auto-map queue the way a player leaves it at a check-in: the best AWAY_QUEUE_MAPS maps the miner farms,
 * highest tier first from `top` down (the frontier, or the two tiers below a gate while held there). Everything else,
 * older and lower stock included, goes back to the stash, and a gate map is never queued: gate attempts are run by hand.
 */
function queueBestMaps(state: GameState, top: number): void {
  for (const map of [...state.autoMap.queue]) unqueueForAutoMap(state, map.id);
  if (!autoMapping(state)) return;
  const size = Math.min(AWAY_QUEUE_MAPS, autoMapQueueSize(state));
  for (let tier = Math.floor(top); tier >= 1 && state.autoMap.queue.length < size; tier--) {
    for (const map of [...(state.stash.maps[tier] ?? [])]) {
      if (state.autoMap.queue.length >= size) break;
      queueForAutoMap(state, map.id);
    }
  }
}

/** The gate the run stands at: its record, and the scores of the attempt running and of the last failed one. */
interface GateProgress { record: GateRecord; attemptScore: number; lastFailScore: number; lastCheckIn: number }

/**
 * Plays one run of the reference schedule headlessly through the real tick, map and passive functions: four fifteen-
 * minute check-ins a day (65 % of each spent playing), offline digging capped per gap, battle gear fitted by the gear
 * policy and bought from the merchant at each check-in, and points spent towards Surveyor so it lands at level 30.
 * Below a gate it runs the best map short of it; at the gate it attempts it, then farms below it and retries once a
 * check-in once its power score has risen by GATE_RETRY_MARGIN, or a day after its last attempt whatever the score.
 * `state` is mutated in place and must be a fresh run.
 */
function simulateRun(state: GameState, totalMinutes: number, settings: RunSettings): RunMeasurements {
  const { clickRate, activeMinutes, policy } = settings;
  const passivePolicy: PassivePolicy = { nextSide: 'battle', lastPathLevel: -1 };

  let frontier = 1;
  let firstMapSec = -1;
  let autoMapLevel = -1;
  let autoMapDay = -1;
  let capDay = -1;
  let capMinute = -1;
  let deepestAtCap = -1;
  let frontierTierAtCap = -1;
  let achievementsAtDay1 = -1;
  let achievementsAtCap = -1;
  const levelDays: Record<number, number> = { 1: 0 };
  const achievementsAtLevel: Record<number, number> = { 1: earnedCount(state) };
  const clears: Record<number, number> = {};
  const losses: Record<number, number> = {};
  const gates: GateRecord[] = [];

  // The next gate, and its progress once the frontier has reached it.
  let gateTier = gateAfter(0);
  let targets = gateTargets(state.seed, gateTier);
  let gate: GateProgress | undefined;
  let fittedFor = -1;

  let inAwayGap = false;
  let awayGapTicks = 0;
  let minute = 0;

  while (minute < totalMinutes) {
    minute += 1;

    // Settle last minute's finds before the next one: wear the best drop, stash the maps, spend the points, queue
    // what auto-mapping can run short of the gate.
    settleInventory(state, policy, targets, fittedFor !== gateTier);
    fittedFor = gateTier;
    if (spendPassives(state, passivePolicy) && autoMapLevel < 0) {
      autoMapLevel = state.level;
      autoMapDay = minute / MINUTES_PER_DAY;
    }
    // At a check-in the player sets the queue for the time away: the frontier's maps, or the farm below a gate.
    const minuteOfDay = (minute - 1) % MINUTES_PER_DAY;
    const checkIn = CHECK_IN_STARTS.findIndex((start) => minuteOfDay >= start && minuteOfDay < start + CHECK_IN_MINUTES);
    const inCheckIn = checkIn >= 0;
    if (inCheckIn) queueBestMaps(state, Math.min(frontier, gateTier - 1));
    if (autoMapping(state)) state.autoMap.on = true;   // kept on, re-armed after a gate attempt's pause
    if (gate === undefined && frontier >= gateTier) {
      const record: GateRecord = {
        tier: gateTier, reachedDay: minute / MINUTES_PER_DAY, firstAttemptDay: -1, clearedDay: -1, attempts: 0,
      };
      gate = { record, attemptScore: 0, lastFailScore: 0, lastCheckIn: -1 };
      gates.push(gate.record);
    }

    const active = inCheckIn && minuteOfDay < (CHECK_IN_STARTS[checkIn] ?? 0) + activeMinutes;
    const events: TickEvent[] = [];

    if (!inCheckIn) {
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
    } else if (active) {
      inAwayGap = false;
      if (minuteOfDay === CHECK_IN_STARTS[checkIn]) shopTrader(state, policy, targets);   // a look at the merchant first
      const checkInId = Math.floor((minute - 1) / MINUTES_PER_DAY) * CHECK_IN_STARTS.length + checkIn;
      // A gate map in hand, dug or dropped, is run once a check-in: first when reached, then again once the score
      // has risen by the margin, or a day after the last attempt whatever the score, so a plateau never locks the gate.
      const gateMap = stashedMap(state, gateTier);
      const due = gate !== undefined && gateMap !== undefined && gate.lastCheckIn !== checkInId
        && (gate.record.attempts === 0
          || checkInId >= gate.lastCheckIn + GATE_RETRY_FALLBACK_CHECK_INS
          || currentScore(state, policy, targets.wall) >= gate.lastFailScore * (1 + GATE_RETRY_MARGIN));
      if (due && gate !== undefined && gateMap !== undefined) {
        if (state.activity.kind === 'map') {
          state.autoMap.on = false;   // let the running map end, then try the gate rather than the next queued map
        } else {
          // Swap to the gear for this gate's wall, then run it.
          fitBattleGear(state, policy, targets);
          gate.attemptScore = currentScore(state, policy, targets.wall);
          if (startMap(state, gateMap.id) === 'ok') {
            gate.record.attempts += 1;
            if (gate.record.firstAttemptDay < 0) gate.record.firstAttemptDay = minute / MINUTES_PER_DAY;
            gate.lastCheckIn = checkInId;
          }
        }
      }
      const stats = deriveStats(state);
      if (state.activity.kind !== 'map') {
        // Short of the gate, the best map up to one past the frontier; at the gate, farm the tiers below it.
        const map = bestAvailableMap(state, Math.min(MAX_FRONTIER, frontier + 1, gateTier - 1));
        if (map !== undefined) startMap(state, map.id);
      }
      const running = state.activity.kind === 'map';
      applyTicks(state, MINUTE_TICKS, stats, events, false, false);
      if (!running) {
        const clicks = Math.max(0, Math.round(clickRate * 60));
        for (let i = 0; i < clicks; i++) clickTicks(state, stats, events);
      }
    } else {
      // The rest of the check-in is inventory and reading: the game is on another view, so digging waits.
      inAwayGap = false;
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
        if (gate !== undefined && map.tier === gateTier) {
          gate.record.clearedDay = minute / MINUTES_PER_DAY;
          gate = undefined;
          gateTier = gateAfter(gateTier);
          targets = gateTargets(state.seed, gateTier);
        }
      } else if (outcome === 'died') {
        losses[map.tier] = (losses[map.tier] ?? 0) + 1;
        if (gate !== undefined && map.tier === gateTier) gate.lastFailScore = gate.attemptScore;
      }
    }
    // The find log is the source of truth if a map was logged outside this minute's event batch.
    if (firstMapSec < 0 && state.finds.some((find) => find.kind === 'map')) firstMapSec = minute * 60;
    for (let level = 2; level <= state.level; level++) {
      if (levelDays[level] !== undefined) continue;
      levelDays[level] = minute / MINUTES_PER_DAY;
      achievementsAtLevel[level] = earnedCount(state);
    }
    if (minute === MINUTES_PER_DAY) achievementsAtDay1 = earnedCount(state);

    if (capMinute < 0 && state.level >= LEVEL_CAP) {
      capMinute = minute;
      capDay = minute / MINUTES_PER_DAY;
      deepestAtCap = state.deepest;
      frontierTierAtCap = frontier;
      achievementsAtCap = earnedCount(state);
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
    levelDays,
    clears,
    losses,
    capReached: capMinute >= 0,
    gates,
    achievementsAtDay1,
    achievementsAtCap,
    achievementsAtLevel,
  };
}

interface RunSettings { dayMinutes: number; clickRate: number; activeMinutes: number; policy: GearPolicy }

/** A fresh reference world played through its first run, which stops after `minutes` or the cap's extra day of `days`. */
function playFirstRun(options: SimOptions): { state: GameState; first: RunMeasurements; settings: RunSettings } {
  const settings: RunSettings = {
    dayMinutes: Math.max(0, Math.round((options.days ?? 24) * MINUTES_PER_DAY)),
    clickRate: options.clickRate ?? 2,
    activeMinutes: Math.max(0, Math.min(CHECK_IN_MINUTES, Math.round(CHECK_IN_MINUTES * (options.activeEfficiency ?? 0.65)))),
    policy: options.policy ?? 'defenceAware',
  };
  const state = newGame(options.seed ?? 12345, 0);
  state.autoMap.on = true;   // the reference player turns auto-mapping on
  const minutes = options.minutes === undefined ? settings.dayMinutes : Math.max(0, Math.round(options.minutes));
  const first = simulateRun(state, minutes, settings);
  return { state, first, settings };
}

/** The reference world as its first run left it: after `minutes` (or the run's usual end), for reading what it holds. */
export function playReference(options: SimOptions): GameState {
  return playFirstRun(options).state;
}

interface RunMeasurements {
  firstMapSec: number; autoMapLevel: number; autoMapDay: number; capDay: number;
  deepestAtCap: number; frontierTierAtCap: number; frontierTierAfterDay: number;
  levelDays: Record<number, number>; clears: Record<number, number>; losses: Record<number, number>;
  capReached: boolean; gates: GateRecord[];
  achievementsAtDay1: number; achievementsAtCap: number; achievementsAtLevel: Record<number, number>;
}

/**
 * Plays the reference schedule headlessly: four fifteen-minute check-ins a day, offline digging between, gear fitted by
 * the gear policy, gates attempted and farmed below, and points spent towards Surveyor. The first run reaches the
 * level cap; then a second run, after ascending, measures the level bonus. Pure and deterministic for a given seed and
 * options.
 */
export function runReference(options: SimOptions = {}): SimReport {
  const { state, first, settings } = playFirstRun(options);

  let levelBonusSecondRun = 0;
  let secondCapDay = -1;
  if (first.capReached) {
    ascend(state);
    const second = simulateRun(state, settings.dayMinutes, settings);
    secondCapDay = second.capDay;
    if (second.capReached) {
      levelBonusSecondRun = ascendancyPoints(second.deepestAtCap, LEVEL_CAP, 1)
        - ascendancyPoints(second.deepestAtCap, LEVEL_CAP, 0);
    }
  }

  return {
    firstMapSec: first.firstMapSec,
    autoMapLevel: first.autoMapLevel,
    autoMapDay: first.autoMapDay,
    capDay: first.capDay,
    deepestAtCap: first.deepestAtCap,
    frontierTierAtCap: first.frontierTierAtCap,
    frontierTierAfterDay: first.frontierTierAfterDay,
    ascensionPointsAtCap: ascendancyPoints(first.deepestAtCap, LEVEL_CAP, 0),
    levelBonusSecondRun,
    levelDays: first.levelDays,
    clears: first.clears,
    losses: first.losses,
    gates: first.gates,
    achievementsAtDay1: first.achievementsAtDay1,
    achievementsAtCap: first.achievementsAtCap,
    achievementsAtLevel: first.achievementsAtLevel,
    secondCapDay,
  };
}
