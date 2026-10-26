import { MAX_CLICKS_PER_SECOND } from './balance';
import { applyTicks } from './dig';
import type { GameState, Stats, TickEvent } from './types';

// lastTickAt moves the same whether digging is paused or not, so paused ticks are never due again. `away` marks the ticks
// as time away from the game (Long Voyage doubles their finds).
export function advance(
  state: GameState, nowMs: number, stats: Stats, events?: TickEvent[], digPaused = false, away = false,
): number {
  const elapsed = nowMs - state.lastTickAt;
  if (elapsed < 0) {
    state.lastTickAt = nowMs;
    state.lastWallAt = nowMs;
    return 0;
  }
  // Wall-clock time is accumulated here, from the `nowMs` parameter (never Date.now()): live elapsed counts as played,
  // away/offline elapsed as away. `lastWallAt` (not the tick-aligned `lastTickAt`) measures the true wall-clock span, so
  // a long gap or a closed tab never inflates "time played" and fractional ticks are never double-counted.
  state.stats.timePlayedMs += away ? 0 : nowMs - state.lastWallAt;
  state.stats.timeAwayMs += away ? nowMs - state.lastWallAt : 0;
  state.lastWallAt = nowMs;
  if (!(stats.autoTicksPerSecond > 0) || !Number.isFinite(stats.autoTicksPerSecond)) {
    state.lastTickAt = nowMs;
    return 0;
  }
  const interval = 1000 / stats.autoTicksPerSecond;
  const capped = elapsed > stats.offlineCapMs;
  const due = Math.floor(Math.min(elapsed, stats.offlineCapMs) / interval);
  const from = state.lastTickAt;
  const tick0 = state.tickCount;
  applyTicks(state, due, stats, events, digPaused, away);
  // a death is stamped with the batch's start; it happened at the end of its own tick
  for (const d of state.deaths) if (d.tick >= tick0) d.at = from + (d.tick - tick0 + 1) * interval;
  state.lastTickAt = capped ? nowMs : state.lastTickAt + due * interval;
  return due;
}

export function clickTicks(state: GameState, stats: Stats, events?: TickEvent[]): void {
  applyTicks(state, stats.ticksPerClick, stats, events);
}

export class ClickLimiter {
  private accepted: number[] = [];

  constructor(private readonly maxPerSecond: number = MAX_CLICKS_PER_SECOND) {}

  tryClick(nowMs: number): boolean {
    let drop = 0;
    while (drop < this.accepted.length && nowMs - (this.accepted[drop] ?? 0) >= 1000) drop++;
    if (drop > 0) this.accepted.splice(0, drop);
    if (this.accepted.length >= this.maxPerSecond) return false;
    this.accepted.push(nowMs);
    return true;
  }
}
