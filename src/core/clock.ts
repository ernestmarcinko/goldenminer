import { MAX_CLICKS_PER_SECOND } from './balance';
import { applyTicks } from './dig';
import type { GameState, Stats, TickEvent } from './types';

// lastTickAt moves the same whether digging is paused or not, so paused ticks are never due again.
export function advance(state: GameState, nowMs: number, stats: Stats, events?: TickEvent[], digPaused = false): number {
  const elapsed = nowMs - state.lastTickAt;
  if (elapsed < 0) {
    state.lastTickAt = nowMs;
    return 0;
  }
  if (!(stats.autoTicksPerSecond > 0) || !Number.isFinite(stats.autoTicksPerSecond)) {
    state.lastTickAt = nowMs;
    return 0;
  }
  const interval = 1000 / stats.autoTicksPerSecond;
  const capped = elapsed > stats.offlineCapMs;
  const due = Math.floor(Math.min(elapsed, stats.offlineCapMs) / interval);
  applyTicks(state, due, stats, events, digPaused);
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
