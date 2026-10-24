import { ARMORED_TAKEN, COMBAT_LOG_LIMIT, COMBAT_STEP_S, ROOM_REGEN, RUN_LOOT_LIMIT, VAMPIRIC_HEAL } from './balance';
import { deriveBattleStats, mitigate, type BattleStats } from './battle';
import { dungeonLayout } from './dungeons';
import { gainXp } from './levels';
import { monsterState } from './monsters';
import { nextRandom } from './rng';
import type {
  CombatLine, GameState, LootNote, MapRun, MonsterState, RunOutcome, RunResult, Stats, TickEvent,
} from './types';

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

/** The monsters of `room`, regenerated from the seed: rooms 1..bossRoom-1 from the layout, then the boss alone. */
function roomQueue(state: GameState, run: MapRun, room: number): MonsterState[] {
  const layout = dungeonLayout(state.seed, run.map);
  if (room >= run.bossRoom) return [monsterState(run.map.tier, layout.boss)];
  return (layout.rooms[room - 1] ?? []).map((m) => monsterState(run.map.tier, m));
}

/** The run is over: it becomes the last run, the tally counts it and the miner goes back to digging. */
export function endRun(state: GameState, run: MapRun, outcome: RunOutcome, events?: TickEvent[]): void {
  const result: RunResult = {
    map: run.map, outcome, room: run.room, bossRoom: run.bossRoom, gained: { ...run.gained },
    items: run.loot.length, seen: false,
  };
  state.lastRun = result;
  if (outcome === 'cleared') state.mapTally.cleared += 1;
  else state.mapTally.lost += 1;
  state.activity = { kind: 'dig' };
  events?.push({ kind: 'runEnd', result });
}

/** A monster fell: its XP (levelling up heals by the max-life gained). Task 5 adds Souls, Gold and drops here. */
function onKill(state: GameState, run: MapRun, monster: MonsterState, b: BattleStats, _events?: TickEvent[]): void {
  const levelBefore = state.level;
  const levels = gainXp(state, monster.xp);
  run.gained.xp += monster.xp;
  if (levels > 0) {
    run.life += deriveBattleStats(state).maxLife - b.maxLife;
    run.gained.levels += levels;
    for (let l = 1; l <= levels; l++) logLine(run, { kind: 'level', level: levelBefore + l });
  }
  logLine(run, { kind: 'kill', monster: monster.name, xp: monster.xp, souls: 0 });
}

function strike(state: GameState, run: MapRun, b: BattleStats, click: boolean, events?: TickEvent[]): StrikeOutcome {
  const m = run.queue[0];
  if (m === undefined) return 'fight';
  let amount = b.damageMin + Math.floor(nextRandom(state) * (b.damageMax - b.damageMin + 1));
  const crit = nextRandom(state) < b.critChance;
  if (crit) amount = Math.round(amount * b.critMultiplier);
  if (m.mods.includes('armored')) amount = Math.max(1, Math.round(amount * ARMORED_TAKEN));
  m.life -= amount;
  events?.push({ kind: 'strike', amount, crit, click });
  logLine(run, { kind: 'hit', monster: m.name, amount, crit, click });
  if (m.life > 0) return 'fight';

  run.queue.shift();
  run.monsterCarry = 0;
  onKill(state, run, m, b, events);
  if (run.queue.length > 0) return 'fight';
  if (run.room >= run.bossRoom) {
    endRun(state, run, 'cleared', events);
    return 'end';
  }
  logLine(run, { kind: 'room', room: run.room });
  run.room += 1;
  const { maxLife } = deriveBattleStats(state);
  run.life = Math.min(maxLife, run.life + Math.round(maxLife * ROOM_REGEN));
  run.queue = roomQueue(state, run, run.room);
  return 'room';
}

/**
 * One combat step of `dt` seconds: the miner's auto hits, then (unless the room fell) the fighting monster's attacks.
 * Returns the battle stats to use next, re-derived after a level-up.
 */
function combatStep(state: GameState, run: MapRun, b: BattleStats, dt: number, events?: TickEvent[]): BattleStats {
  run.hitCarry += b.attacksPerSecond * dt;
  while (run.hitCarry >= 1) {
    run.hitCarry -= 1;
    const level = state.level;
    const outcome = strike(state, run, b, false, events);
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
    if (run.life <= 0) {
      endRun(state, run, 'died', events);
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

/** One click strike, at once; a room it clears advances straight away. Does nothing outside a map. */
export function clickHit(state: GameState, events?: TickEvent[]): void {
  if (state.activity.kind !== 'map') return;
  strike(state, state.activity.run, deriveBattleStats(state), true, events);
}
