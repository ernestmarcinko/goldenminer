import type { Slot } from '../../core/items';
import type { DropEntry, DropOrigin, GameState, TrailStep } from '../../core/types';
import { gainedText } from '../character/itemActions';
import { SLOT_LABELS, type ViewLine } from '../character/itemView';
import { formatNumber } from '../format';
import { mapModLines, roomWords, runMapLine } from '../run/runView';

export function originText(o: DropOrigin): string {
  switch (o.kind) {
    case 'metre': return `${formatNumber(o.metre)} m`;
    case 'map': return `Tier ${formatNumber(o.tier)} map, room ${formatNumber(o.room)}`;
    case 'merchant': return 'Merchant';
  }
}

const paid = (s: TrailStep): string => {
  if (s.gold !== undefined) return ` (+${formatNumber(s.gold)} Gold)`;
  const got = gainedText(s.materials ?? {});
  return got === '' ? '' : ` (${got})`;
};

export function stepText(e: DropEntry, s: TrailStep): string {
  switch (s.event) {
    case 'bag': return 'to bag';
    case 'held': return 'held (bag full)';
    case 'filterSold': return `loot filter sold${paid(s)}`;
    case 'filterSalvaged': return `loot filter salvaged${paid(s)}`;
    case 'stashed': return e.kind === 'material' ? 'to Materials tab' : 'stashed';
    case 'toBag': return 'moved to bag';
    case 'equipped': return 'equipped';
    case 'sold': return `sold${paid(s)}`;
    case 'salvaged': return `salvaged${paid(s)}`;
    case 'crafted': return e.kind === 'map' ? 'enchanted' : 'crafted';
    case 'upgraded': return 'upgraded with Souls';
    case 'run': return 'run';
    case 'lost': return 'lost';
  }
}

const isStack = (e: DropEntry): boolean => e.kind === 'gem' || e.kind === 'material';

/** A gem or material find by its count: "+3 Iron ore". */
const stackName = (e: DropEntry): string => `+${formatNumber(e.count)} ${e.name}`;

// After a stack's arrow, "to bag" reads as "bag".
const stackSteps = (e: DropEntry): string => e.trail.map((s) => stepText(e, s).replace(/^to /, '')).join(' → ');

/** What became of a find, step by step; a stack leads with its count: "+3 Iron ore → bag". */
export function trailText(e: DropEntry): string {
  if (isStack(e)) return `${stackName(e)} → ${stackSteps(e)}`;
  return e.trail.map((s) => stepText(e, s)).join(' → ');
}

/** Gear's rarity and slot ("rare gloves"); a map's name already says its tier, and a stack has no kind. */
function kindText(e: DropEntry): string {
  switch (e.kind) {
    case 'gear': return `${e.rarity} ${SLOT_LABELS[e.base as Slot].toLowerCase()}`;   // a gear entry's base is its slot
    case 'map':
    case 'gem':
    case 'material': return '';
  }
}

/** `stack` rows (gems and materials) read inline; the others put their trail under the name. */
export interface DropRow { id: number; origin: string; name: string; kind: string; tone: string; trail: string; stack: boolean }

/** The drop log, newest first. A stack's row has its count in the name and its one step after an arrow. */
export function dropRows(state: GameState): DropRow[] {
  return state.drops.map((e): DropRow => {
    const stack = isStack(e);
    return {
      id: e.id, origin: originText(e.origin), name: stack ? stackName(e) : e.name, kind: kindText(e),
      tone: e.kind === 'map' && e.rarity === 'normal' ? 'map' : e.rarity,
      trail: stack ? `→ ${stackSteps(e)}` : trailText(e), stack,
    };
  }).reverse();
}

export interface DeathRow { id: number; when: string; map: string; mods: ViewLine[]; line: string; lost: string }

/** The death log, newest first. */
export function deathRows(state: GameState): DeathRow[] {
  return state.deaths.map((d): DeathRow => ({
    id: d.id, when: new Date(d.at).toLocaleString(), map: runMapLine(state.seed, d.map), mods: mapModLines(d.map),
    line: `Fell in ${roomWords(d.room, d.bossRoom)} to ${d.killer}.`, lost: 'Lost: the map.',
  })).reverse();
}
