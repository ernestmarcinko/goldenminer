import { describe, expect, it } from 'vitest';
import { GEM_GRADE_LABELS, GEM_LABELS, MATERIAL_LABELS } from '../../src/core/itemData';
import { GEM_GRADES, GEM_TYPES, MATERIALS } from '../../src/core/items';
import { newGame } from '../../src/core/newGame';
import { formatDuration, formatNumber } from '../../src/ui/format';
import { statsVMs } from '../../src/ui/stats/statsView';

describe('the stats tab view model', () => {
  it('groups every counter into the five catalogue categories with every per-ore and per-gem row', () => {
    const s = newGame(1, 0);
    const groups = statsVMs(s);
    expect(groups.map((g) => g.id)).toEqual(['distance', 'currency', 'finds', 'combat', 'progression']);
    const labels = groups.flatMap((g) => g.rows.map((r) => r.label));
    for (const m of MATERIALS) {
      expect(labels).toContain(`${MATERIAL_LABELS[m]} found`);
      expect(labels).toContain(`${MATERIAL_LABELS[m]} traded`);
    }
    for (const t of GEM_TYPES) {
      for (const g of GEM_GRADES) expect(labels).toContain(`${GEM_GRADE_LABELS[g]} ${GEM_LABELS[t]}`);
    }
  });

  it('formats times with formatDuration, counts with formatNumber, and reads ascensions/achievements from elsewhere', () => {
    const s = newGame(1, 0);
    s.stats.timePlayedMs = 3_600_000 + 30 * 60_000;
    s.stats.goldFound = 12_345_678;
    s.lifetime.ascensions = 3;
    s.achievements.earned = ['depth.1000', 'dig.1000'];
    const rows = statsVMs(s).flatMap((g) => g.rows);
    const row = (label: string): string | undefined => rows.find((r) => r.label === label)?.value;
    expect(row('Time played')).toBe(formatDuration(s.stats.timePlayedMs));
    expect(row('Gold found')).toBe(formatNumber(12_345_678));
    expect(row('Ascensions')).toBe('3');
    expect(row('Achievements earned')).toBe('2');
  });

  it('never mutates state', () => {
    const s = newGame(1, 0);
    const before = JSON.stringify(s);
    statsVMs(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});
