import { MAP_MOD_CAPS, MAP_MOD_TIERS } from '../../core/balance';
import { MAP_MOD_KINDS, MAP_SPECIALS, type MapModKind, type MapSpecial } from '../../core/items';
import { MAP_MOD_LABELS, MAP_SPECIAL_TEXT, mapModRange } from '../../core/mapMods';

/** How many tiers the map-modifier table lists (a window, not a cap). */
export const MAP_MOD_TIERS_SHOWN = 10;

export interface MapModRow {
  kind: MapModKind;
  label: string;
  base: number;
  step: number;
  /** The summed cap, for the two modifiers that are capped once summed; undefined when uncapped. */
  cap: number | undefined;
  tiers: readonly { lo: number; hi: number }[];
}

export function mapModRows(): MapModRow[] {
  return MAP_MOD_KINDS.map((kind) => {
    const def = MAP_MOD_TIERS[kind];
    const tiers: { lo: number; hi: number }[] = [];
    for (let tier = 1; tier <= MAP_MOD_TIERS_SHOWN; tier++) tiers.push(mapModRange(kind, tier));
    return { kind, label: MAP_MOD_LABELS[kind], base: def.base, step: def.step, cap: MAP_MOD_CAPS[kind], tiers };
  });
}

export interface MapSpecialRow {
  special: MapSpecial;
  text: string;
}

export function mapSpecialRows(): MapSpecialRow[] {
  return MAP_SPECIALS.map((special) => ({ special, text: MAP_SPECIAL_TEXT[special] }));
}
