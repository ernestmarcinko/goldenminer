import type { FeatureKind } from './types';

export const BASE_DIG_POWER = 10;
export const BASE_AUTO_TICKS_PER_SECOND = 1;
export const BASE_TICKS_PER_CLICK = 1;
export const BASE_LAMP_SIGHT = 2;
export const BASE_OFFLINE_CAP_MS = 8 * 3_600_000;
export const MAX_CLICKS_PER_SECOND = 10;

export const TICKS_PER_METRE_AT_PARITY = 25;
export const HARD_ROCK_MULTIPLIER = 1.5;

export const BASE_FEATURE_CHANCES: Readonly<Record<FeatureKind, number>> = {
  goldVein: 0.12, diamondVein: 0.03, chest: 0.06, gem: 0.03, map: 0.04,
};
export const BASE_HARD_ROCK_CHANCE = 0.08;

export const GUARANTEED_FIRST_MAP_METRE = 2;
export const FINDS_LOG_LIMIT = 5000;

export const AUTOSAVE_INTERVAL_MS = 30_000;
export const OFFLINE_SUMMARY_MIN_TICKS = 300;
export const TAB_LOCK_STALE_MS = 5000;
export const TAB_HEARTBEAT_MS = 2000;

export function hardness(metre: number): number {
  return 10 + 0.13 * metre;
}
export function goldPerTick(tier: number): number {
  return 1 + Math.floor(tier / 2);
}
export function diamondChancePerTick(tier: number): number {
  return Math.min(0.2, 0.01 * tier);
}
export function goldVeinAmount(tier: number, u: number): number {
  return Math.round(6 * tier * (0.8 + 0.4 * u));
}
export function diamondVeinAmount(tier: number): number {
  return 1 + Math.floor(tier / 2);
}
