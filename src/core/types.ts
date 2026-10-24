export type FeatureKind = 'goldVein' | 'diamondVein' | 'chest' | 'gem' | 'map';
export interface MetreRoll { feature: FeatureKind | null; amount: number; hardRock: boolean }
export interface FindRecord { depth: number; kind: FeatureKind; amount: number; tick: number }
export interface GameState {
  seed: number; rng: number; tickCount: number; lastTickAt: number;
  gold: number; diamonds: number;
  depth: number; deepest: number;          // whole metres; 0 = surface; depth <= deepest
  progress: number;                        // 0..1 toward metre deepest+1 (the dig face)
  galleryProgress: number;                 // 0..1 toward the next gallery find roll (depth < deepest)
  ahead: Record<number, MetreRoll>;        // pre-rolled metres deepest+1 .. deepest+lampSight
  finds: FindRecord[];                     // notable finds, oldest first, at most FINDS_LOG_LIMIT
}
export interface Stats {
  digPower: number; autoTicksPerSecond: number; ticksPerClick: number; lampSight: number;
  offlineCapMs: number; featureChances: Record<FeatureKind, number>; hardRockChance: number;
}
export type TickEvent =
  | { kind: 'gold'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'metre'; depth: number; gallery: boolean }
  | { kind: 'find'; find: FindRecord };
export interface OfflineSummary {
  elapsedMs: number; ticks: number; gold: number; diamonds: number; metres: number;
  finds: Record<FeatureKind, number>;
}
