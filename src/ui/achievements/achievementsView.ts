import {
  ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS, achievementIcon, earnedCount, type AchievementKind,
} from '../../core/achievements';
import type { IconGlyphId } from '../../core/skillIcons';
import type { GameState } from '../../core/types';

/** What an unearned secret shows in place of its name and description. */
export const HIDDEN_NAME = '???';
export const HIDDEN_DESC = 'A secret. Keep playing.';

/**
 * One achievement as the tab lists it: its icon, name and description, and whether it is earned. An unearned secret
 * is masked here, at the source: its name, description, id and icon are replaced, so nothing downstream can leak them.
 */
export interface AchievementVM {
  id: string;
  kind: AchievementKind;
  name: string;
  desc: string;
  value: number;
  earned: boolean;
  /** True for a secret that is still unearned; the badge wears a "?" and no family icon. */
  hidden: boolean;
  /** The family's glyph, or null for an unearned secret. */
  icon: IconGlyphId | null;
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

/** One of the tab's four groups (Milestones, Feats, Collections, Secrets): its families and its overall progress. */
export interface KindGroupVM {
  kind: AchievementKind;
  label: string;
  earned: number;
  total: number;
  families: FamilyVM[];
}

/** The groups in the order the tab shows them. */
const KIND_GROUPS: readonly { kind: AchievementKind; label: string }[] = [
  { kind: 'ladder', label: 'Milestones' },
  { kind: 'feat', label: 'Feats' },
  { kind: 'collection', label: 'Collections' },
  { kind: 'hidden', label: 'Secrets' },
];

/** The whole table grouped by kind, then by family, every achievement in its table order, marked earned or not. */
export function achievementVMs(state: GameState): KindGroupVM[] {
  const earned = new Set(state.achievements.earned);
  const byKind = new Map<AchievementKind, Map<string, AchievementVM[]>>();
  let hiddenIndex = 0;
  for (const a of ACHIEVEMENTS) {
    const isEarned = earned.has(a.id);
    const masked = a.kind === 'hidden' && !isEarned;
    const vm: AchievementVM = masked
      ? { id: `secret.${hiddenIndex}`, kind: a.kind, name: HIDDEN_NAME, desc: HIDDEN_DESC, value: 1, earned: false, hidden: true, icon: null }
      : { id: a.id, kind: a.kind, name: a.name, desc: a.desc, value: a.value, earned: isEarned, hidden: false, icon: achievementIcon(a) };
    if (a.kind === 'hidden') hiddenIndex += 1;
    let families = byKind.get(a.kind);
    if (families === undefined) {
      families = new Map();
      byKind.set(a.kind, families);
    }
    const list = families.get(a.family);
    if (list === undefined) families.set(a.family, [vm]);
    else list.push(vm);
  }
  return KIND_GROUPS.map(({ kind, label }) => {
    const families = [...(byKind.get(kind) ?? new Map<string, AchievementVM[]>()).entries()].map(([family, achievements]): FamilyVM => ({
      family,
      label: FAMILY_LABELS[family] ?? family,
      icon: achievements.find((a) => a.icon !== null)?.icon ?? 'star',
      earned: achievements.reduce((n, a) => n + (a.earned ? 1 : 0), 0),
      total: achievements.length,
      achievements,
    }));
    return {
      kind,
      label,
      earned: families.reduce((n, f) => n + f.earned, 0),
      total: families.reduce((n, f) => n + f.total, 0),
      families,
    };
  });
}

/** The current global boost as a percentage, for the header line. */
export function achievementBoostPercent(state: GameState): number {
  return ACHIEVEMENT_BOOST * earnedCount(state) * 100;
}
