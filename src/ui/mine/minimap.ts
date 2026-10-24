import { bandAt, tierAt } from '../../core/bands';
import type { FeatureKind, GameState } from '../../core/types';
import { bandPalette } from './sceneTiles';

export const MINIMAP_METRES = 88;
export const MINIMAP_PX_PER_METRE = 6;

export interface MinimapMarker { y: number; kind: FeatureKind; count: number; label: string }
export interface MinimapModel {
  top: number;
  bottom: number;
  bands: { name: string; y: number; height: number; color: string }[];
  ticks: { depth: number; y: number }[];
  markers: MinimapMarker[];
  ahead: { y: number; kind: FeatureKind | 'hardRock' }[];
  youY: number;
  fogY: number;
}

const PRIORITY: readonly FeatureKind[] = ['map', 'chest', 'gem', 'diamondVein', 'goldVein'];
const BUCKET_METRES = 4;

function labelFor(kind: FeatureKind, depth: number): string {
  switch (kind) {
    case 'map': return `Map T${tierAt(depth)}`;
    case 'chest': return 'Chest';
    case 'gem': return 'Gem';
    case 'diamondVein': return 'Diamonds';
    case 'goldVein': return 'Gold vein';
  }
}

export function minimapModel(state: GameState, lampSight: number): MinimapModel {
  const top = Math.max(0, state.depth - 50);
  const bottom = top + MINIMAP_METRES;
  const y = (d: number) => (d - top) * MINIMAP_PX_PER_METRE;

  const bands: MinimapModel['bands'] = [];
  for (let d = top; d < bottom; ) {
    const band = bandAt(d);
    const from = Math.max(band.start, top);
    const to = Math.min(band.end, bottom);
    bands.push({ name: band.name, y: y(from), height: (to - from) * MINIMAP_PX_PER_METRE, color: bandPalette(band.tier)[1] });
    d = band.end;
  }

  const ticks: MinimapModel['ticks'] = [];
  for (let d = Math.ceil(top / 10) * 10; d <= bottom; d += 10) ticks.push({ depth: d, y: y(d) });

  const buckets = new Map<number, { kind: FeatureKind; count: number }>();
  for (const find of state.finds) {
    if (find.depth < top || find.depth > bottom) continue;
    const key = Math.floor(find.depth / BUCKET_METRES);
    const entry = buckets.get(key);
    if (!entry) {
      buckets.set(key, { kind: find.kind, count: 1 });
    } else {
      entry.count += 1;
      if (PRIORITY.indexOf(find.kind) < PRIORITY.indexOf(entry.kind)) entry.kind = find.kind;
    }
  }
  const markers: MinimapMarker[] = [...buckets.entries()].map(([key, { kind, count }]) => {
    const mid = key * BUCKET_METRES + BUCKET_METRES / 2;
    return { y: y(mid), kind, count, label: labelFor(kind, mid) + (count > 1 ? ` ×${count}` : '') };
  });
  markers.sort((a, b) => a.y - b.y);

  const ahead = Object.keys(state.ahead)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((metre): MinimapModel['ahead'] => {
      const roll = state.ahead[metre];
      if (!roll) return [];
      if (roll.feature) return [{ y: y(metre - 0.5), kind: roll.feature }];
      if (roll.hardRock) return [{ y: y(metre - 0.5), kind: 'hardRock' }];
      return [];
    });

  return { top, bottom, bands, ticks, markers, ahead, youY: y(state.depth), fogY: y(state.deepest + lampSight) };
}

export function depthAtY(model: MinimapModel, y: number, deepest: number): number {
  const d = Math.round(model.top + y / MINIMAP_PX_PER_METRE);
  return Math.min(Math.max(d, 0), deepest);
}

export function depthForKey(key: string, depth: number, deepest: number): number | null {
  let target: number;
  switch (key) {
    case 'ArrowUp': target = depth - 1; break;
    case 'ArrowDown': target = depth + 1; break;
    case 'PageUp': target = depth - 10; break;
    case 'PageDown': target = depth + 10; break;
    case 'Home': target = 0; break;
    case 'End': target = deepest; break;
    default: return null;
  }
  return Math.min(Math.max(target, 0), deepest);
}

export function depthForClick(
  model: MinimapModel,
  click: { detail: number; clientX: number; clientY: number; stripTop: number },
  deepest: number,
): number | null {
  if (click.detail === 0 || (click.clientX === 0 && click.clientY === 0)) return null;
  return depthAtY(model, click.clientY - click.stripTop, deepest);
}
