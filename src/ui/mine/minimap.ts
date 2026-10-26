import { bandAt, tierAt } from '../../core/bands';
import { MATERIAL_LABELS } from '../../core/itemData';
import type { Material } from '../../core/items';
import { metreLayer } from '../../core/layer';
import type { FeatureKind, FindKind, GameState, Hazard } from '../../core/types';
import { bandLook, bandTitle, worldOf } from '../../core/mineLook';
import type { SpriteName } from '../../sprites/atlas';
import { baseSprite } from '../character/itemView';
import { findMaterial } from './findMaterial';

export const MINIMAP_METRES = 88;
export const MINIMAP_PX_PER_METRE = 6;

/** Metres drawn above and below the visible window, so a scroll never shows a gap before the next frame. */
const MARGIN_METRES = 10;
/**
 * Where the window's top sits while following: 50 m above the dig face. The scroll height ends lampSight + 2 m past the
 * face, so the browser clamps the scroll and the face usually rests near the bottom (about 90% down), not at 50/88 = 57%.
 */
const FOLLOW_OFFSET_METRES = 50;

export type AheadKind = FeatureKind | 'materialVein' | 'hardRock' | Hazard;
export interface MinimapMarker { y: number; kind: FindKind; count: number; label: string; icon: SpriteName }
/** `lantern`: a hazard Black Lantern shows, past the lamp or beside the metre's own hint. */
export interface MinimapHint { y: number; kind: AheadKind; label: string; icon?: SpriteName; lantern?: true }
export interface MinimapModel {
  top: number;
  bottom: number;
  height: number;
  bands: { name: string; y: number; height: number; color: string }[];
  ticks: { depth: number; y: number }[];
  markers: MinimapMarker[];
  ahead: MinimapHint[];
  youY: number;
  /** The "You" tag sits under its line when the face is too near the top of the strip for the tag to fit above it. */
  youTagBelow: boolean;
  fogY: number;
}

const PRIORITY: readonly FindKind[] = ['map', 'chest', 'gem', 'diamondVein', 'goldVein', 'materialVein'];
const BUCKET_METRES = 4;
/** The height the "You" tag needs above its line: its box plus the gap. */
const YOU_TAG_ROOM_PX = 26;

const FEATURE_ICONS: Readonly<Record<FeatureKind, SpriteName>> = {
  map: 'map', chest: 'chest', gem: 'gem', diamondVein: 'diamond', goldVein: 'coin',
};
const HAZARD_LABELS: Readonly<Record<Hazard, string>> = { gas: 'gas pocket', unstable: 'unstable rock' };

function featureLabel(kind: FeatureKind, depth: number): string {
  switch (kind) {
    case 'map': return `Map T${tierAt(depth)}`;
    case 'chest': return 'Chest';
    case 'gem': return 'Gem';
    case 'diamondVein': return 'Diamonds';
    case 'goldVein': return 'Gold vein';
  }
}

function y(depth: number): number {
  return depth * MINIMAP_PX_PER_METRE;
}

/** The window's top metre that keeps the dig face in view while following. */
export function followTop(deepest: number): number {
  return Math.max(0, deepest - FOLLOW_OFFSET_METRES);
}

/** Whether the dig face lies inside the window scrolled to `scrollTop` pixels. */
export function isFollowing(scrollTop: number, deepest: number): boolean {
  const face = y(deepest);
  return face >= scrollTop && face <= scrollTop + MINIMAP_METRES * MINIMAP_PX_PER_METRE;
}

/**
 * Lamp hints, most telling first: a rolled feature, then a material vein (only where no feature is rolled,
 * as digging works), then a hazard, then harder rock. One hint per metre.
 */
function hint(state: GameState, metre: number): MinimapHint | null {
  const roll = state.ahead[metre];
  if (!roll) return null;
  const at = y(metre - 0.5);
  if (roll.feature) return { y: at, kind: roll.feature, label: featureLabel(roll.feature, metre), icon: FEATURE_ICONS[roll.feature] };
  const layer = metreLayer(state.seed, metre);
  if (layer.vein) {
    const { material } = layer.vein;
    return { y: at, kind: 'materialVein', label: MATERIAL_LABELS[material], icon: baseSprite(material) };
  }
  if (layer.hazard) return { y: at, kind: layer.hazard, label: HAZARD_LABELS[layer.hazard] };
  if (roll.hardRock) return { y: at, kind: 'hardRock', label: 'harder rock' };
  return null;
}

/**
 * Everything the minimap draws for the window whose top metre is `top`. Every `y` is absolute, measured from
 * the surface, and only the window plus a small margin is filled in. Hazards up to `hazardSight` metres past the face
 * (Black Lantern) are hints of their own, after the lamp's.
 */
export function minimapModel(state: GameState, lampSight: number, top: number, hazardSight = 0): MinimapModel {
  const bottom = top + MINIMAP_METRES;
  const from = Math.max(0, top - MARGIN_METRES);
  const to = bottom + MARGIN_METRES;

  const world = worldOf(state);
  const bands: MinimapModel['bands'] = [];
  for (let d = from; d < to; ) {
    const band = bandAt(d);
    const start = Math.max(band.start, from);
    const end = Math.min(band.end, to);
    bands.push({ name: bandTitle(world, band), y: y(start), height: y(end - start), color: bandLook(world, band).palette[1] });
    d = band.end;
  }

  const ticks: MinimapModel['ticks'] = [];
  for (let d = Math.ceil(from / 10) * 10; d <= to; d += 10) ticks.push({ depth: d, y: y(d) });

  const buckets = new Map<number, { kind: FindKind; material?: Material; count: number }>();
  for (const find of state.finds) {
    if (find.depth < from || find.depth > to) continue;
    const key = Math.floor(find.depth / BUCKET_METRES);
    const entry = buckets.get(key);
    if (!entry) {
      buckets.set(key, { kind: find.kind, material: find.material, count: 1 });
    } else {
      entry.count += 1;
      if (PRIORITY.indexOf(find.kind) < PRIORITY.indexOf(entry.kind)) {
        entry.kind = find.kind;
        entry.material = find.material;
      }
    }
  }
  const markers: MinimapMarker[] = [...buckets.entries()].map(([key, { kind, material, count }]) => {
    const mid = key * BUCKET_METRES + BUCKET_METRES / 2;
    const label = kind === 'materialVein' ? MATERIAL_LABELS[findMaterial({ kind, material })] : featureLabel(kind, mid);
    const icon = kind === 'materialVein' ? baseSprite(findMaterial({ kind, material })) : FEATURE_ICONS[kind];
    return { y: y(mid), kind, count, label: label + (count > 1 ? ` ×${count}` : ''), icon };
  });
  markers.sort((a, b) => a.y - b.y);

  const ahead: MinimapHint[] = [];
  const last = Math.min(state.deepest + lampSight, to);
  for (let metre = Math.max(state.deepest + 1, from); metre <= last; metre++) {
    const h = hint(state, metre);
    if (h) ahead.push(h);
  }
  const lanternLast = Math.min(state.deepest + hazardSight, to);
  for (let metre = Math.max(state.deepest + 1, from); metre <= lanternLast; metre++) {
    const { hazard } = metreLayer(state.seed, metre);
    if (hazard === null) continue;
    const at = y(metre - 0.5);
    // a lamp hint that already shows this hazard is enough
    if (ahead.some((h) => h.y === at && h.kind === hazard)) continue;
    ahead.push({ y: at, kind: hazard, label: HAZARD_LABELS[hazard], lantern: true });
  }

  return {
    top, bottom, height: y(state.deepest + Math.max(lampSight, hazardSight) + 2), bands, ticks, markers, ahead,
    youY: y(state.deepest), youTagBelow: y(state.deepest) < YOU_TAG_ROOM_PX, fogY: y(state.deepest + lampSight),
  };
}
