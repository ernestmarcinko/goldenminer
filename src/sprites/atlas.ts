import type { SpriteName } from './grids';

export type { SpriteName };

export interface AtlasFrame { x: number; y: number; w: number; h: number }

export interface SpriteAtlas {
  imageUrl: string;
  width: number;
  height: number;
  frames: Record<SpriteName, AtlasFrame>;
}

/** Shelf packing in insertion order, with 1 px of padding after each sprite and shelf. */
export function layoutAtlas(
  sizes: Record<SpriteName, { w: number; h: number }>,
  maxWidth = 256,
): { width: number; height: number; frames: Record<SpriteName, AtlasFrame> } {
  const frames = {} as Record<SpriteName, AtlasFrame>;
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let width = 0;
  for (const name of Object.keys(sizes) as SpriteName[]) {
    const size = sizes[name];
    if (x > 0 && x + size.w > maxWidth) {
      y += shelfHeight + 1;
      x = 0;
      shelfHeight = 0;
    }
    frames[name] = { x, y, w: size.w, h: size.h };
    width = Math.max(width, x + size.w);
    shelfHeight = Math.max(shelfHeight, size.h);
    x += size.w + 1;
  }
  return { width, height: y + shelfHeight, frames };
}

export function spriteStyle(atlas: SpriteAtlas, name: SpriteName, scale: number) {
  const f = atlas.frames[name];
  return {
    width: `${f.w * scale}px`,
    height: `${f.h * scale}px`,
    backgroundImage: `url("${atlas.imageUrl}")`,
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
    imageRendering: 'pixelated' as const,
  };
}
