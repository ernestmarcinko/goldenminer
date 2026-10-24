import { useLayoutEffect, useRef } from 'react';

const CACHE_LIMIT = 256;
const drawn = new Map<string, HTMLCanvasElement>();

function filled(grid: readonly string[], x: number, y: number): boolean {
  const c = grid[y]?.[x];
  return c !== undefined && c !== '.';
}

/** The grid drawn once at 1 px per cell, cached by its grid, palette and aura. */
function image(grid: readonly string[], palette: Record<string, string>, aura: string | undefined): HTMLCanvasElement {
  const key = `${grid.join('/')}|${JSON.stringify(palette)}|${aura ?? ''}`;
  const hit = drawn.get(key);
  if (hit) return hit;
  const width = grid[0]?.length ?? 0;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = grid.length;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        const colour = c === undefined || c === '.' ? undefined : palette[c];
        if (colour !== undefined) {
          ctx.fillStyle = colour;
          ctx.fillRect(x, y, 1, 1);
        } else if (aura !== undefined && !filled(grid, x, y)
            && (filled(grid, x - 1, y) || filled(grid, x + 1, y) || filled(grid, x, y - 1) || filled(grid, x, y + 1))) {
          ctx.fillStyle = aura;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    });
  }
  if (drawn.size >= CACHE_LIMIT) {
    const oldest = drawn.keys().next().value;
    if (oldest !== undefined) drawn.delete(oldest);
  }
  drawn.set(key, canvas);
  return canvas;
}

/** Production draws a bad scale at the nearest whole size, at least 1, rather than blurring it. */
export function pixelScale(scale: number): number {
  return Number.isFinite(scale) ? Math.max(1, Math.round(scale)) : 1;
}

/** A code-drawn pixel grid (generated monsters) on a canvas at an integer scale. */
export function PixelArt({ grid, palette, scale, aura, label }: {
  grid: readonly string[]; palette: Record<string, string>; scale: number; aura?: string | null; label?: string;
}) {
  if (import.meta.env.DEV && (!Number.isInteger(scale) || scale <= 0)) {
    throw new Error(`PixelArt scale must be a positive integer, got ${scale}`);
  }
  const px = pixelScale(scale);
  const ref = useRef<HTMLCanvasElement>(null);
  const width = (grid[0]?.length ?? 0) * px;
  const height = grid.length * px;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image(grid, palette, aura ?? undefined), 0, 0, width, height);
  }, [grid, palette, aura, width, height]);
  const a11y = label !== undefined ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return <canvas ref={ref} {...a11y} width={width} height={height} style={{ display: 'block', imageRendering: 'pixelated' }} />;
}
