import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, earnedCount } from '../../core/achievements';
import type { GameState } from '../../core/types';

/** One achievement as the tab lists it: its name and description, and whether it is earned. */
export interface AchievementVM {
  id: string;
  name: string;
  desc: string;
  value: number;
  earned: boolean;
}

/** A family's group: its label, its progress and its achievements in threshold order. */
export interface FamilyVM {
  family: string;
  label: string;
  earned: number;
  total: number;
  achievements: AchievementVM[];
}

/** The whole table grouped by family, every achievement in its table order, marked earned or not. */
export function achievementVMs(state: GameState): FamilyVM[] {
  const earned = new Set(state.achievements.earned);
  const byFamily = new Map<string, AchievementVM[]>();
  for (const a of ACHIEVEMENTS) {
    const vm: AchievementVM = { id: a.id, name: a.name, desc: a.desc, value: a.value, earned: earned.has(a.id) };
    const list = byFamily.get(a.family);
    if (list === undefined) byFamily.set(a.family, [vm]);
    else list.push(vm);
  }
  return [...byFamily.entries()].map(([family, achievements]) => ({
    family,
    label: FAMILY_LABELS[family] ?? family,
    earned: achievements.reduce((n, a) => n + (a.earned ? 1 : 0), 0),
    total: achievements.length,
    achievements,
  }));
}

/** The current global boost as a percentage, for the header line. */
export function achievementBoostPercent(state: GameState): number {
  return ACHIEVEMENT_BOOST * earnedCount(state) * 100;
}
