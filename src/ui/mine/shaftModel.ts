import { MATERIAL_LABELS } from '../../core/itemData';
import type { Material } from '../../core/items';
import { metreLayer } from '../../core/layer';
import { worldOf, wallTile, type WallTile } from '../../core/mineLook';
import type { FeatureKind, GameState, ShaftMotion } from '../../core/types';

export const SHAFT_ROWS = 13;
export const MINER_ROW = 4;
export const SHAFT_ROW_PX = 56;

const WALL_COLUMNS = 4;

export type ShaftCell = 'surface' | 'dug' | 'face' | 'lit' | 'dark';

export interface ShaftRow {
  metre: number;
  cell: ShaftCell;
  hard: boolean;
  feature: FeatureKind | null;
  material: Material | null;               // a material vein, lit only where the roll holds no feature
  label: string | null;
  left: WallTile[];
  right: WallTile[];
}

const LABEL: Record<FeatureKind, string> = {
  goldVein: 'Gold vein',
  diamondVein: 'Diamonds',
  chest: 'Chest',
  gem: 'Gem',
  map: 'Map',
};

function aheadLabel(k: number, feature: FeatureKind | null, material: Material | null, hard: boolean): string | null {
  if (feature) return `+${k} m: ${LABEL[feature]}`;
  if (material) return `+${k} m: ${MATERIAL_LABELS[material]}`;
  return hard ? `+${k} m: harder rock` : null;
}

export function shaftModel(state: GameState, lampSight: number): { top: number; rows: ShaftRow[] } {
  const { deepest } = state;
  const world = worldOf(state);
  const top = deepest - MINER_ROW;
  const rows: ShaftRow[] = [];
  for (let i = 0; i < SHAFT_ROWS; i++) {
    const metre = top + i;
    let cell: ShaftCell;
    if (metre <= 0) cell = 'surface';
    else if (metre <= deepest) cell = 'dug';
    else if (metre === deepest + 1) cell = 'face';
    else if (metre <= deepest + lampSight) cell = 'lit';
    else cell = 'dark';

    let feature: FeatureKind | null = null;
    let material: Material | null = null;
    let hard = false;
    let label: string | null = null;
    if (cell === 'face' || cell === 'lit') {
      const roll = state.ahead[metre];
      feature = roll?.feature ?? null;
      if (roll !== undefined && feature === null) material = metreLayer(state.seed, metre).vein?.material ?? null;
      hard = roll?.hardRock ?? false;
      const k = metre - deepest;
      if (k >= 1 && k <= lampSight) label = aheadLabel(k, feature, material, hard);
    }

    const walls = (side: 0 | 1): WallTile[] =>
      cell === 'surface' ? [] : Array.from({ length: WALL_COLUMNS }, (_, c) => wallTile(world, metre, side, c));
    rows.push({ metre, cell, hard, feature, material, label, left: walls(0), right: walls(1) });
  }
  return { top, rows };
}

export function shaftShift(
  prevTop: number,
  top: number,
  motion: ShaftMotion,
  progress: number,
): { fromPx: number; toPx: number; animate: boolean } {
  if (motion === 'off') return { fromPx: 0, toPx: 0, animate: false };
  if (motion === 'smooth') {
    const px = progress === 0 ? 0 : -progress * SHAFT_ROW_PX;
    return { fromPx: px, toPx: px, animate: false };
  }
  const n = top - prevTop;
  if (n === 0 || Math.abs(n) > SHAFT_ROWS) return { fromPx: 0, toPx: 0, animate: false };
  return { fromPx: n * SHAFT_ROW_PX, toPx: 0, animate: true };
}
