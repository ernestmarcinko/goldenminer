import { layoutAtlas, type SpriteAtlas, type SpriteName } from './atlas';
import { GRIDS, PALETTE, PALETTE_OVERRIDES } from './grids';

export function buildPlaceholderAtlas(): SpriteAtlas {
  const names = Object.keys(GRIDS) as SpriteName[];
  const sizes = {} as Record<SpriteName, { w: number; h: number }>;
  for (const n of names) {
    const rows = GRIDS[n];
    sizes[n] = { w: rows[0]?.length ?? 0, h: rows.length };
  }
  const { width, height, frames } = layoutAtlas(sizes);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');

  for (const n of names) {
    const frame = frames[n];
    const pal = { ...PALETTE, ...(PALETTE_OVERRIDES[n] ?? {}) };
    GRIDS[n].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const colour = pal[row.charAt(x)];
        if (colour === undefined) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(frame.x + x, frame.y + y, 1, 1);
      }
    });
  }

  return { imageUrl: canvas.toDataURL('image/png'), width, height, frames };
}
