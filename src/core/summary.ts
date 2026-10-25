import { FIND_KINDS, type FindKind, type GameState, type OfflineSummary } from './types';

export function summarize(before: GameState, after: GameState, elapsedMs: number, ticks: number, capMs: number): OfflineSummary {
  const finds = Object.fromEntries(FIND_KINDS.map((k) => [k, 0])) as Record<FindKind, number>;
  for (const f of after.finds) {
    if (f.tick >= before.tickCount) finds[f.kind] += 1;
  }
  return {
    elapsedMs, ticks, capMs,
    gold: after.gold - before.gold,
    diamonds: after.diamonds - before.diamonds,
    metres: after.deepest - before.deepest,
    souls: after.souls - before.souls,
    levels: after.level - before.level,
    maps: { cleared: after.mapTally.cleared - before.mapTally.cleared, lost: after.mapTally.lost - before.mapTally.lost },
    finds,
    items: {
      kept: after.lootTally.kept - before.lootTally.kept,
      sold: after.lootTally.sold - before.lootTally.sold,
      salvaged: after.lootTally.salvaged - before.lootTally.salvaged,
    },
    bagStopped: after.overflow.length > 0,
    paused: after.paused,
  };
}
