import { bandAt, tierAt } from '../../core/bands';
import type { FeatureKind, GameState } from '../../core/types';
import { bandLook, bandTitle, worldOf } from '../../core/mineLook';

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
  const top = Math.max(0, state.deepest - 50);
  const bottom = top + MINIMAP_METRES;
  const y = (d: number) => (d - top) * MINIMAP_PX_PER_METRE;

  const world = worldOf(state);
  const bands: MinimapModel['bands'] = [];
  for (let d = top; d < bottom; ) {
    const band = bandAt(d);
    const from = Math.max(band.start, top);
    const to = Math.min(band.end, bottom);
    bands.push({ name: bandTitle(world, band), y: y(from), height: (to - from) * MINIMAP_PX_PER_METRE, color: bandLook(world, band).palette[1] });
    d = band.end;
  }

  const ticks: MinimapModel['ticks'] = [];
  for (let d = Math.ceil(top / 10) * 10; d <= bottom; d += 10) ticks.push({ depth: d, y: y(d) });

  const buckets = new Map<number, { kind: FeatureKind; count: number }>();
  for (const find of state.finds) {
    if (find.kind === 'materialVein' || find.depth < top || find.depth > bottom) continue;
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
    .filter((metre) => metre <= state.deepest + lampSight)
    .flatMap((metre): MinimapModel['ahead'] => {
      const roll = state.ahead[metre];
      if (!roll) return [];
      if (roll.feature) return [{ y: y(metre - 0.5), kind: roll.feature }];
      if (roll.hardRock) return [{ y: y(metre - 0.5), kind: 'hardRock' }];
      return [];
    });

  return { top, bottom, bands, ticks, markers, ahead, youY: y(state.deepest), fogY: y(state.deepest + lampSight) };
}
