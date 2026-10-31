import { iconDataUrl } from '../PixelArt';

/** A composed pixel icon as a plain HTML `<img>`, for the node cards. */
export function NodeIcon({ icon, size }: {
  icon: { grid: string[]; palette: Record<string, string> };
  size: number;
}) {
  return (
    <img
      src={iconDataUrl(icon.grid, icon.palette)}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      alt=""
    />
  );
}
