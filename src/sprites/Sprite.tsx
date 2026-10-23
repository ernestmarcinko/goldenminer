import { useAtlas } from './AtlasContext';
import { spriteStyle, type SpriteName } from './atlas';

export function Sprite({ name, scale, label }: { name: SpriteName; scale: number; label?: string }) {
  const atlas = useAtlas();
  if (import.meta.env.DEV && (!Number.isInteger(scale) || scale <= 0)) {
    throw new Error(`Sprite scale must be a positive integer, got ${scale}`);
  }
  const a11y = label !== undefined ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return <span {...a11y} style={{ display: 'inline-block', ...spriteStyle(atlas, name, scale) }} />;
}
