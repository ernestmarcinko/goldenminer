import { tryAutoMap } from './autoMap';
import { achievementBoost, checkAchievements } from './achievements';
import {
  DEEPDELVER_EVERY, FINDS_LOG_LIMIT, HARD_ROCK_MULTIPLIER, LOOT_NOTES_KEPT, MAX_DIG_POWER, MAX_ITEM_LEVEL, TICKS_PER_METRE_AT_PARITY, hardness,
} from './balance';
import { metreTier } from './bands';
import { mapTick } from './combat';
import { rollChest, rollGemOrRune, type Gen } from './itemGen';
import type { Material } from './items';
import { hazardFactor, materialAmount, metreLayer, pickMaterial } from './layer';
import { drainOverflow, receiveItem, receiveMaterial } from './loot';
import { addMap } from './maps';
import { fillAhead, metreChances, rollMetre } from './metres';
import { nextRandom } from './rng';
import { decayPremiums } from './oreMarket';
import { hasKeystone } from './passives';
import { addTime } from './telemetry';
import type { FindRecord, GameState, LootNote, MetreRoll, Stats, TickEvent } from './types';
import { hasUnique, uniqueGen } from './uniques';

/** Cartographer finds maps one tier higher; Prospector's Eye one tier lower; never past the item-level cap or below 1. */
function mapTier(state: GameState, tier: number): number {
  const adjustment = (hasKeystone(state, 'cartographer') ? 1 : 0) - (hasKeystone(state, 'prospectorsEye') ? 1 : 0);
  return Math.max(1, Math.min(MAX_ITEM_LEVEL, tier + adjustment));
}

function logFind(state: GameState, find: FindRecord, events?: TickEvent[]): void {
  state.finds.push(find);
  const stale = state.finds[state.finds.length - 1 - LOOT_NOTES_KEPT];
  if (stale !== undefined) delete stale.loot;
  if (state.finds.length > FINDS_LOG_LIMIT) state.finds.splice(0, state.finds.length - FINDS_LOG_LIMIT);
  events?.push({ kind: 'find', find });
}

/** A metre's feature: a vein pays, a chest or gem rolls from `gen` (the unique stream for a unique's second find). */
export function collect(
  state: GameState, roll: MetreRoll, depth: number, tier: number, stats: Stats, events?: TickEvent[], bonus = false,
  gen: Gen = state,
): void {
  if (roll.feature === null) return;
  let amount = roll.amount;
  const loot: LootNote[] = [];
  const origin = { kind: 'metre', metre: depth } as const;
  if (roll.feature === 'goldVein') {
    amount = Math.round(roll.amount * stats.goldMultiplier * stats.veinMultiplier * achievementBoost(state));
    state.gold += amount;
    state.stats.goldFound += amount;
    checkAchievements(state, 'gold');
    if (amount > 0) events?.push({ kind: 'gold', amount });
    // The Golddigger's material draws from the unique stream, so the loot stream is the same without it.
    if (hasUnique(state, 'golddigger')) {
      const unique = uniqueGen(state);
      const material = pickMaterial(depth, nextRandom(unique));
      loot.push(...receiveMaterial(state, material, materialAmount(material, depth, nextRandom(unique)), origin));
    }
  } else if (roll.feature === 'diamondVein') {
    amount = Math.round(roll.amount * stats.diamondMultiplier * stats.veinMultiplier * achievementBoost(state));
    state.diamonds += amount;
    state.stats.diamondsFound += amount;
    checkAchievements(state, 'diamonds');
    if (amount > 0) events?.push({ kind: 'diamond', amount });
  }
  const find: FindRecord = { id: state.nextId++, depth, kind: roll.feature, amount, tick: state.tickCount };
  if (bonus) find.bonus = true;
  if (roll.feature === 'map') {
    loot.push(...addMap(state, mapTier(state, tier), depth));
  } else if (roll.feature === 'chest') {
    state.stats.chestsOpened += 1;
    checkAchievements(state, 'chests');
    // The Gebo rune makes every chest drop one more item.
    const chests = stats.runeFlags.has('extraChest') ? 2 : 1;
    for (let c = 0; c < chests; c++) {
      for (const item of rollChest(gen, tier)) loot.push(...receiveItem(state, item, origin));
    }
  } else if (roll.feature === 'gem') {
    loot.push(...receiveItem(state, rollGemOrRune(state, tier, gen), origin));
  }
  if (loot.length > 0) find.loot = loot;
  logFind(state, find, events);
}

/** A material vein, seeded or from ore find: its amount times vein yield goes to the bag (or is held), and is logged. */
function collectMaterialVein(
  state: GameState, vein: { material: Material; amount: number }, depth: number, stats: Stats, events?: TickEvent[],
  bonus = false,
): void {
  const amount = Math.round(vein.amount * stats.veinMultiplier * achievementBoost(state));
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

/** Ticks one metre takes: its hardness, hard rock and any hazard, over dig power (raised by the achievement boost). */
function ticksForMetre(state: GameState, metre: number, roll: MetreRoll, stats: Stats): number {
  // Thurisaz makes hard rock cost no extra ticks; Kenaz makes hazards cause no slowdown.
  const hard = hardness(metre) * (roll.hardRock && !stats.runeFlags.has('ignoreHardRock') ? HARD_ROCK_MULTIPLIER : 1);
  const hazard = stats.runeFlags.has('hazardImmune')
    ? 1
    : hazardFactor(metreLayer(state.seed, metre).hazard, stats.hazardWard, stats.hazardSlow);
  const boosted = stats.digPower * achievementBoost(state);
  // The boost never bypasses the dig-power clamp; a non-finite override (a test's Infinity/NaN) is left alone so the
  // tick loop's own guard still turns it into no digging.
  const digPower = Number.isFinite(boosted) ? Math.min(MAX_DIG_POWER, boosted) : boosted;
  return hard * hazard * TICKS_PER_METRE_AT_PARITY / digPower;
}

/** Ticks the face metre needs at the current dig power and hazard ward. */
export function faceTicksPerMetre(state: GameState, stats: Stats): number {
  return ticksForMetre(state, state.deepest + 1, faceRoll(state, stats), stats);
}

/** The auto-dig rate at the face; null while digging is paused (a map runs or loot is held). */
export function digSpeed(state: GameState, stats: Stats): { metresPerMinute: number; secondsToNext: number } | null {
  if (state.activity.kind === 'map' || state.overflow.length > 0) return null;
  const m = state.deepest + 1;
  const roll = state.ahead[m] ?? rollMetre(state.seed, m, metreChances(state, stats));
  const ticks = ticksForMetre(state, m, roll, stats);
  const rate = stats.autoTicksPerSecond;
  if (!(ticks > 0) || !(rate > 0) || !Number.isFinite(ticks)) return null;
  return { metresPerMinute: 60 * rate / ticks, secondsToNext: Math.max(0, 1 - state.progress) * ticks / rate };
}

/**
 * Finishes metre `next`, whose roll is `done`: its finds, then the face moves past it. `finds` counts how often its find
 * is had: a vein pays that many times over, and a chest, gem or map is found again as a bonus from the unique stream.
 */
export function finishMetre(
  state: GameState, next: number, done: MetreRoll, stats: Stats, events?: TickEvent[], finds = 1, clicked = false,
): void {
  const tier = metreTier(next);
  const vein = done.feature === 'goldVein' || done.feature === 'diamondVein';
  collect(state, vein ? { ...done, amount: done.amount * finds } : done, next, tier, stats, events);
  if (!vein && done.feature !== null) {
    for (let i = 1; i < finds; i++) collect(state, done, next, tier, stats, events, true, uniqueGen(state));
  }
  // A material vein shows only where the seeded roll left the metre empty, ore find only where the layer left it
  // empty too, and find gear adds its bonus after them.
  if (done.feature === null) {
    const layerVein = metreLayer(state.seed, next).vein;
    if (layerVein !== null) collectMaterialVein(state, { ...layerVein, amount: layerVein.amount * finds }, next, stats, events);
    else collectOreBonus(state, next, stats, events);
    if (state.worldGen === 2) collectBonus(state, next, stats, events);
  }
  delete state.ahead[next];
  state.deepest = next;
  state.stats.metresDug += 1;
  if (clicked) state.stats.metresDugByClick += 1;
  else state.stats.metresDugAuto += 1;
  checkAchievements(state, 'depth');
  checkAchievements(state, 'dig');
  checkAchievements(state, 'handMined');
  checkAchievements(state, 'autoMined');
  fillAhead(state, stats);
  events?.push({ kind: 'metre', depth: next });
}

/** Deepdelver digs every DEEPDELVER_EVERY-th metre at once. */
export function isInstant(state: GameState, metre: number): boolean {
  return metre % DEEPDELVER_EVERY === 0 && hasUnique(state, 'deepdelver');
}

/** Finishes the instant metres at the face, each found twice (on top of time away's doubling); false if loot is held. */
function finishInstant(state: GameState, stats: Stats, events: TickEvent[] | undefined, finds: number, clicked: boolean): boolean {
  while (state.overflow.length === 0 && isInstant(state, state.deepest + 1)) {
    const next = state.deepest + 1;
    finishMetre(state, next, faceRoll(state, stats), stats, events, 2 * finds, clicked);
  }
  return state.overflow.length === 0;
}

/** `finds`: how often every metre's find is had (2 while away with Long Voyage worn). */
function digFace(state: GameState, stats: Stats, events: TickEvent[] | undefined, finds: number, clicked: boolean): void {
  // An instant metre is finished before any tick is spent on it.
  if (!finishInstant(state, stats, events, finds, clicked)) return;
  const roll = faceRoll(state, stats);
  const m = state.deepest + 1;
  const step = 1 / ticksForMetre(state, m, roll, stats);
  if (!(step > 0) || !Number.isFinite(step)) return;
  state.progress += step;
  events?.push({ kind: 'dig' });
  while (state.progress >= 1) {
    state.progress -= 1;
    const next = state.deepest + 1;
    const done = faceRoll(state, stats);
    finishMetre(state, next, done, stats, events, finds, clicked);
    if (!finishInstant(state, stats, events, finds, clicked)) {
      state.progress -= Math.floor(state.progress);
      return;
    }
    state.progress *= ticksForMetre(state, next, done, stats) / faceTicksPerMetre(state, stats);
  }
}

/**
 * Runs `count` ticks. A paused dig tick is dropped, not banked: it still counts, and nothing digs it later. `away` ticks
 * are time away from the game, whose finds Long Voyage doubles.
 */
export function applyTicks(
  state: GameState, count: number, stats: Stats, events?: TickEvent[], digPaused = false, away = false, clicked = false,
): void {
  const finds = away && hasUnique(state, 'longVoyage') ? 2 : 1;
  // Each applied tick is 1/autoTicksPerSecond seconds of simulated activity, bucketed by what the tick did. This is
  // deterministic and derived from the tick model, never wall-clock, so it reproduces from the seed.
  const dtMs = stats.autoTicksPerSecond > 0 && Number.isFinite(stats.autoTicksPerSecond)
    ? 1000 / stats.autoTicksPerSecond : 0;
  for (let i = 0; i < count; i++) {
    // A running map takes the whole tick, with no digging; neither a pause nor held loot stops it.
    if (state.activity.kind === 'map') {
      mapTick(state, stats, events);
      addTime(state.stats, 'timeCombatMs', dtMs);
      state.tickCount += 1;
      continue;
    }
    // Held loot stops digging only while it has no room, whatever freed a cell: the gate heals itself. A drain draws nothing.
    if (state.overflow.length > 0) drainOverflow(state);
    // The player's Pause holds everything new; held loot does too.
    if (state.paused || state.overflow.length > 0) {
      addTime(state.stats, 'timeIdleMs', dtMs);
      state.tickCount += 1;
      continue;
    }
    // Auto-mapping starts the next eligible queued map on any tick — live or away — so a running chain isn't tied to the
    // view or to the app being open. The player's Pause above, and the on/off switch, still gate it.
    if (tryAutoMap(state)) {
      mapTick(state, stats, events);
      addTime(state.stats, 'timeCombatMs', dtMs);
      state.tickCount += 1;
      continue;
    }
    // The view pause stops digging only: a running map or auto-map keeps going.
    if (digPaused) {
      addTime(state.stats, 'timeIdleMs', dtMs);
      state.tickCount += 1;
      continue;
    }
    // Digging pays nothing by the tick and draws nothing: Gold and Diamonds come from the veins it digs into.
    digFace(state, stats, events, finds, clicked);
    addTime(state.stats, 'timeDiggingMs', dtMs);
    state.tickCount += 1;
  }
  // A map that just ended hands the chain to the next queued map in the same pass, so the run view never blinks back
  // to digging between auto-mapped maps. The player's Pause and held loot still hold it, as they do within the loop.
  if (state.activity.kind !== 'map' && !state.paused && state.overflow.length === 0) tryAutoMap(state);
  decayPremiums(state, count);
}
