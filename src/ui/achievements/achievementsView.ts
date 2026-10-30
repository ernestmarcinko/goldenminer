import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, achievementIcon, earnedCount } from '../../core/achievements';
import type { IconGlyphId } from '../../core/skillIcons';
import type { GameState } from '../../core/types';

/** One achievement as the tab lists it: its icon, name and description, and whether it is earned. */
export interface AchievementVM {
  id: string;
  name: string;
  desc: string;
  value: number;
  earned: boolean;
  icon: IconGlyphId;
}

/** A family's group: its label, its shared icon, its progress and its achievements in threshold order. */
export interface FamilyVM {
  family: string;
  label: string;
  icon: IconGlyphId;
  earned: number;
  total: number;
  achievements: AchievementVM[];
}

/** The whole table grouped by family, every achievement in its table order, marked earned or not. */
export function achievementVMs(state: GameState): FamilyVM[] {
  const earned = new Set(state.achievements.earned);
  const byFamily = new Map<string, AchievementVM[]>();
  for (const a of ACHIEVEMENTS) {
    const vm: AchievementVM = {
      id: a.id, name: a.name, desc: a.desc, value: a.value, earned: earned.has(a.id), icon: achievementIcon(a),
    };
    const list = byFamily.get(a.family);
    if (list === undefined) byFamily.set(a.family, [vm]);
    else list.push(vm);
  }
  return [...byFamily.entries()].map(([family, achievements]) => {
    const first = achievements[0];
    return {
      family,
      label: FAMILY_LABELS[family] ?? family,
      icon: first?.icon ?? 'star',
      earned: achievements.reduce((n, a) => n + (a.earned ? 1 : 0), 0),
      total: achievements.length,
      achievements,
    };
  });
}

/** The current global boost as a percentage, for the header line. */
export function achievementBoostPercent(state: GameState): number {
  return ACHIEVEMENT_BOOST * earnedCount(state) * 100;
}
