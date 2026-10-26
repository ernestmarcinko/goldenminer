import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, type AchievementDef } from '../../core/achievements';

/** One achievement family: its label, how many achievements it holds, and the smallest and largest thresholds. */
export interface AchievementFamilyRow {
  family: string;
  label: string;
  count: number;
  min: number;
  max: number;
}

export function achievementFamilies(): AchievementFamilyRow[] {
  const byFamily = new Map<string, AchievementDef[]>();
  for (const a of ACHIEVEMENTS) {
    const list = byFamily.get(a.family);
    if (list === undefined) byFamily.set(a.family, [a]);
    else list.push(a);
  }
  const rows: AchievementFamilyRow[] = [];
  for (const a of ACHIEVEMENTS) {
    const list = byFamily.get(a.family);
    if (list === undefined) continue;
    byFamily.delete(a.family);
    const values = list.map((x) => x.value);
    rows.push({
      family: a.family,
      label: FAMILY_LABELS[a.family] ?? a.family,
      count: list.length,
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }
  return rows;
}

/** How many achievements exist in all. */
export function achievementTotal(): number {
  return ACHIEVEMENTS.length;
}

/** The permanent global boost per earned achievement, in percent. */
export function achievementBoostPercent(): number {
  return ACHIEVEMENT_BOOST * 100;
}
