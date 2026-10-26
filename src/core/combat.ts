import {
  ARMORED_TAKEN, BAND_OF_THE_DEEP_HEAL, BOSS_DROPS, CHAMPION_DROPS, CHAMPION_MAGIC_FIND, COMBAT_LOG_LIMIT, COMBAT_STEP_S,
  DROP_CHANCE, MAP_DROP_BATTLE_CHANCE, MAP_GEM_CHANCE, MAP_MATERIAL_CHANCE, PEACEMAKER_EVERY, ROOM_REGEN_TOTAL,
  RUN_LOOT_LIMIT, VAMPIRIC_HEAL, WOLF_EYE_DROPS, goldPerKill, soulsPerKill,
} from './balance';
import { deriveBattleStats, mitigate, type BattleStats } from './battle';
import { dungeonLayout } from './dungeons';
import { logDeath, trail } from './dropLog';
import { gainXp } from './levels';
import { rollGear, rollGem, rollRarity, type Gen } from './itemGen';
import { materialAmount, pickMaterial } from './layer';
import { receiveItem, receiveMaterial } from './loot';
import { mapEffects } from './mapMods';
import { monsterState, rankReward } from './monsters';
import { nextRandom } from './rng';
import type {
  CombatLine, GameState, LootNote, MapRun, MonsterState, Rank, RunOutcome, RunResult, Stats, TickEvent,
} from './types';
import { hasUnique, uniqueGen } from './uniques';

/** What a strike did: the room fights on, the room was cleared and the next one entered, or the run ended. */
type StrikeOutcome = 'fight' | 'room' | 'end';

function pushNewest<T>(list: T[], item: T, limit: number): void {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

const logLine = (run: MapRun, line: CombatLine) => pushNewest(run.log, line, COMBAT_LOG_LIMIT);

/** Keeps a drop note on the run, newest RUN_LOOT_LIMIT only. */
export function noteLoot(run: MapRun, note: LootNote): void {
  pushNewest(run.loot, note, RUN_LOOT_LIMIT);
}

/**
 * The monsters of `room`, regenerated from the seed: rooms 1..bossRoom-1 from the layout, then the boss alone. A room
 * the layout doesn't have is fought as the boss room, so the queue is never empty.
 */
function roomQueue(state: GameState, run: MapRun, room: number): MonsterState[] {
  const layout = dungeonLayout(state.seed, run.map);
  const fx = mapEffects(run.map);
  const monsters = room < run.bossRoom ? layout.rooms[room - 1] ?? [] : [];
  if (monsters.length === 0) return [monsterState(run.map.tier, layout.boss, fx)];
  return monsters.map((m) => monsterState(run.map.tier, m, fx));
}

/**
 * The run is over: it becomes the last run, the tally counts it and the miner goes back to digging. A map not cleared
 * is lost, and a death is logged with `killer`, the monster that struck last (by default the one fighting).
 */
export function endRun(state: GameState, run: MapRun, outcome: RunOutcome, events?: TickEvent[], killer?: string): void {
  const result: RunResult = {
    map: run.map, outcome, room: run.room, bossRoom: run.bossRoom, gained: { ...run.gained },
    items: run.items, seen: false,
  };
  state.lastRun = result;
  if (outcome === 'cleared') state.mapTally.cleared += 1;
  else {
    state.mapTally.lost += 1;
    trail(state, run.map.id, { event: 'lost' });
  }
  if (outcome === 'died') logDeath(state, run, killer ?? run.queue[0]?.name ?? 'a monster');
  state.activity = { kind: 'dig' };
  events?.push({ kind: 'runEnd', result });
}

/** Souls for one kill: the whole part of the expected amount, plus one more with the fractional part as its chance. */
export function soulsForKill(u: number, tier: number, rank: Rank, soulMultiplier: number): number {
  const x = soulsPerKill(tier) * rankReward(rank) * soulMultiplier;
  const whole = Math.floor(x);
  return whole + (u < x - whole ? 1 : 0);
}

/** Notes what became of a drop on the run and in the log, and counts it as an item unless it is a material stack. */
function takeDrop(run: MapRun, notes: LootNote[], isItem = true): void {
  if (isItem) run.items += 1;
  for (const n of notes) {
    noteLoot(run, n);
    logLine(run, { kind: 'drop', note: n });
  }
}

/**
 * A monster fell: its XP (levelling up heals by the max-life gained), then Souls, Gold, items, a gem chance and the
 * material chances, in that draw order (exported so the rewards can be pinned per rank). Champions guarantee an item of raised rarity, bosses guarantee BOSS_DROPS, anything may add one more.
 * The map's modifiers raise the Souls, the magic find and the drop chances, but every draw is made as on a normal map.
 */
export function onKill(state: GameState, run: MapRun, monster: MonsterState, b: BattleStats): void {
  const tier = run.map.tier;
  const fx = mapEffects(run.map);
  const more = (chance: number) => Math.min(1, chance * (1 + fx.quantity / 100));
  const levelBefore = state.level;
  const xp = Math.round(monster.xp * b.xpMultiplier);
  const levels = gainXp(state, xp);
  run.gained.xp += xp;
  let { maxLife } = b;
  if (levels > 0) {
    maxLife = deriveBattleStats(state).maxLife;
    run.life += maxLife - b.maxLife;
    run.gained.levels += levels;
    for (let l = 1; l <= levels; l++) logLine(run, { kind: 'level', level: levelBefore + l });
  }
  if (b.lifeOnKill > 0) run.life = Math.min(maxLife, run.life + Math.round(b.lifeOnKill));

  const souls = soulsForKill(nextRandom(state), tier, monster.rank, b.soulMultiplier * (1 + fx.souls / 100));
  state.souls += souls;
  run.gained.souls += souls;
  logLine(run, { kind: 'kill', monster: monster.name, xp, souls });

  const gold = goldPerKill(tier) * rankReward(monster.rank);
  state.gold += gold;
  run.gained.gold += gold;

  const guaranteed = monster.rank === 'boss' ? BOSS_DROPS : monster.rank === 'champion' ? CHAMPION_DROPS : 0;
  const count = guaranteed + (nextRandom(state) < more(DROP_CHANCE) ? 1 : 0);
  const magicFind = b.magicFindMultiplier * (1 + fx.rarity / 100);
  const origin = { kind: 'map', tier, room: run.room } as const;
  for (let i = 0; i < count; i++) {
    const set = nextRandom(state) < MAP_DROP_BATTLE_CHANCE ? 'battle' : 'mining';
    const raised = monster.rank === 'champion' && i < guaranteed;
    const item = rollGear(state, tier, set, rollRarity(state, magicFind * (raised ? CHAMPION_MAGIC_FIND : 1)));
    takeDrop(run, receiveItem(state, item, origin));
  }
  // Wolf Eye's drops come from the unique stream, so the loot stream is the same without it.
  if (monster.rank !== 'normal' && hasUnique(state, 'wolfEye')) {
    const unique = uniqueGen(state);
    for (let i = 0; i < WOLF_EYE_DROPS; i++) {
      const set = nextRandom(unique) < MAP_DROP_BATTLE_CHANCE ? 'battle' : 'mining';
      takeDrop(run, receiveItem(state, rollGear(unique, tier, set, rollRarity(unique, magicFind)), origin));
    }
  }
  if (nextRandom(state) < more(MAP_GEM_CHANCE)) takeDrop(run, receiveItem(state, rollGem(state, tier), origin));
  // Materials of the map's depth: rankReward chances, each pass drawing its material and then its amount.
  const metre = run.map.metre;
  for (let i = 0; i < rankReward(monster.rank); i++) {
    if (nextRandom(state) >= more(MAP_MATERIAL_CHANCE)) continue;
    const material = pickMaterial(metre, nextRandom(state));
    takeDrop(run, receiveMaterial(state, material, materialAmount(material, metre, nextRandom(state)), origin), false);
  }
}

/** One strike at the fighting monster; its damage and crit draw from `gen` (the unique stream for the Peacemaker's second). */
function strike(state: GameState, run: MapRun, b: BattleStats, events?: TickEvent[], gen: Gen = state): StrikeOutcome {
  const m = run.queue[0];
  if (m === undefined) return 'fight';
  let physical = b.damageMin + Math.floor(nextRandom(gen) * (b.damageMax - b.damageMin + 1));
  let elemental = b.elementalDamage;
  const crit = nextRandom(gen) < b.critChance;
  if (crit) {
    physical = Math.round(physical * b.critMultiplier);
    elemental = Math.round(elemental * b.critMultiplier);
  }
  // Armored softens only the physical part.
  if (m.mods.includes('armored')) physical = Math.max(1, Math.round(physical * ARMORED_TAKEN));
  // A hardened map softens the whole hit, after everything else.
  const amount = Math.max(1, Math.round((physical + elemental) * mapEffects(run.map).takenMult));
  m.life -= amount;
  events?.push({ kind: 'strike', amount, crit });
  logLine(run, { kind: 'hit', monster: m.name, amount, crit });
  if (crit && hasUnique(state, 'bandOfTheDeep')) {
    run.life = Math.min(b.maxLife, run.life + Math.round(BAND_OF_THE_DEEP_HEAL * b.maxLife));
  }
  if (m.life > 0) return 'fight';

  run.queue.shift();
  run.monsterCarry = 0;
  onKill(state, run, m, b);
  if (run.queue.length > 0) return 'fight';
  if (run.room >= run.bossRoom) {
    endRun(state, run, 'cleared', events);
    return 'end';
  }
  logLine(run, { kind: 'room', room: run.room });
  run.room += 1;
  const { maxLife } = deriveBattleStats(state);
  const heal = mapEffects(run.map).healMult;
  run.life = Math.min(maxLife, run.life + Math.round((maxLife * ROOM_REGEN_TOTAL * heal) / (run.bossRoom - 1)));
  run.queue = roomQueue(state, run, run.room);
  return 'room';
}

/**
 * One combat step of `dt` seconds: life regeneration, the miner's auto hits, then (unless the room fell) the fighting
 * monster's attacks. Returns the battle stats to use next, re-derived after a level-up.
 */
function combatStep(state: GameState, run: MapRun, b: BattleStats, dt: number, events?: TickEvent[]): BattleStats {
  // Regeneration heals in whole life; the fraction waits in the carry.
  run.regenCarry += b.lifeRegen * dt;
  const healed = Math.floor(run.regenCarry);
  run.regenCarry -= healed;
  if (healed > 0) run.life = Math.min(b.maxLife, run.life + healed);

  run.hitCarry += b.attacksPerSecond * dt;
  while (run.hitCarry >= 1) {
    run.hitCarry -= 1;
    const level = state.level;
    run.strikes += 1;
    let outcome = strike(state, run, b, events);
    // The Peacemaker's second strike is drawn from the unique stream and never counts as a strike of its own.
    if (outcome !== 'end' && run.strikes % PEACEMAKER_EVERY === 0 && hasUnique(state, 'peacemaker')) {
      const again = strike(state, run, state.level !== level ? deriveBattleStats(state) : b, events, uniqueGen(state));
      if (again !== 'fight') outcome = again;
    }
    if (outcome === 'end') return b;
    if (outcome === 'room') {
      run.hitCarry -= Math.floor(run.hitCarry);
      return state.level !== level ? deriveBattleStats(state) : b;   // the new room doesn't attack this step
    }
    if (state.level !== level) b = deriveBattleStats(state);
  }

  const m = run.queue[0];
  if (m === undefined) return b;
  run.monsterCarry += dt / m.intervalS;
  while (run.monsterCarry >= 1) {
    run.monsterCarry -= 1;
    const hurt = mitigate(m.damage, m.element, b);
    run.life -= hurt;
    events?.push({ kind: 'hurt', amount: hurt });
    logLine(run, { kind: 'hurt', monster: m.name, amount: hurt });
    if (m.mods.includes('vampiric')) {
      const healed = Math.min(m.maxLife, m.life + Math.round(hurt * VAMPIRIC_HEAL)) - m.life;
      m.life += healed;
      if (healed > 0) logLine(run, { kind: 'heal', monster: m.name, amount: healed });
    }
    // Kraken Leather turns the first killing blow of a run into 1 life left.
    if (run.life <= 0 && run.saved !== true && hasUnique(state, 'krakenLeather')) {
      run.life = 1;
      run.saved = true;
      logLine(run, { kind: 'saved', monster: m.name });
    }
    if (run.life <= 0) {
      endRun(state, run, 'died', events, m.name);
      return b;
    }
  }
  return b;
}

/** One tick of a map: `1 / autoTicksPerSecond` seconds of combat, fought in equal steps of at most COMBAT_STEP_S. */
export function mapTick(state: GameState, stats: Stats, events?: TickEvent[]): void {
  const dt = 1 / stats.autoTicksPerSecond;
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  const steps = Math.ceil(dt / COMBAT_STEP_S);
  let b = deriveBattleStats(state);
  for (let i = 0; i < steps && state.activity.kind === 'map'; i++) {
    b = combatStep(state, state.activity.run, b, dt / steps, events);
  }
}
