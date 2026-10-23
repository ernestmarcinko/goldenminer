import type { FeatureKind, GameState, OfflineSummary } from './types';

export function summarize(before: GameState, after: GameState, elapsedMs: number, ticks: number): OfflineSummary {
  const finds: Record<FeatureKind, number> = { goldVein: 0, diamondVein: 0, chest: 0, gem: 0, map: 0 };
  for (const f of after.finds) {
    if (f.tick >= before.tickCount) finds[f.kind] += 1;
  }
  return {
    elapsedMs, ticks,
    gold: after.gold - before.gold,
    diamonds: after.diamonds - before.diamonds,
    metres: after.deepest - before.deepest,
    finds,
  };
}
