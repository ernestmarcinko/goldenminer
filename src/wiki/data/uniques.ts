import { LEGENDARIES, STAT_NAMES } from '../../core/itemData';
import type { LegendaryId } from '../../core/itemData';
import type { Slot, StatKey } from '../../core/items';
import { UNIQUE_LINES } from '../../core/uniques';

/** A legendary's hand-written line: a scaled roll or a fixed value (tier 0, never rolled). */
export interface UniqueLineRow {
  stat: StatKey;
  statName: string;
  kind: 'scale' | 'fixed';
  value: number;
}

export interface UniqueRow {
  id: LegendaryId;
  name: string;
  slot: Slot;
  slotLabel: string;
  tier: number;
  /** The unique line, as its card shows it; empty for a stat-only legendary. */
  effect: string;
  lines: UniqueLineRow[];
}

const SLOT_LABELS: Readonly<Record<Slot, string>> = {
  pickaxe: 'Pickaxe', lamp: 'Lamp helm', gloves: 'Gloves', boots: 'Boots',
  weapon: 'Weapon', armor: 'Armor', helm: 'Helm', ring: 'Ring', amulet: 'Amulet',
};

export function uniqueRows(): UniqueRow[] {
  return LEGENDARIES.map((def) => ({
    id: def.id,
    name: def.name,
    slot: def.slot,
    slotLabel: SLOT_LABELS[def.slot],
    tier: def.tier,
    effect: UNIQUE_LINES[def.id] ?? '',
    lines: def.lines.map((line) => ({
      stat: line.stat,
      statName: STAT_NAMES[line.stat],
      kind: 'scale' in line ? 'scale' : 'fixed',
      value: 'scale' in line ? line.scale : line.fixed,
    })),
  }));
}
