import { useEffect, useMemo, useRef, useState } from 'react';
import type { SkillNodeVM } from './skillsView';

const VIEW_W = 1120;
const VIEW_H = 760;

const NODE_SIZE: Readonly<Record<SkillNodeVM['kind'], number>> = { start: 44, keystone: 40, notable: 32, small: 20 };

interface Props {
  nodes: SkillNodeVM[];
  onNode: (id: string) => void;
  onHover: (id: string | null) => void;
  focusId: string | null;
  focusNonce: number;
}

/** The passive web as an SVG: edges and nodes, with drag-to-pan and wheel zoom. */
export function Web({ nodes, onNode, onHover, focusId, focusNonce }: Props) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: { x1: number; y1: number; x2: number; y2: number; side: SkillNodeVM['side'] }[] = [];
    for (const n of nodes) {
      for (const l of n.links) {
        const m = byId.get(l);
        if (m === undefined) continue;
        const key = n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x1: n.x, y1: n.y, x2: m.x, y2: m.y, side: n.side });
      }
    }
    return out;
  }, [nodes, byId]);

  // The view: the scale and offset that fit the whole web, and the player's pans and zooms.
  const fit = useMemo(() => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const scale = Math.min(VIEW_W / (maxX - minX), VIEW_H / (maxY - minY));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { scale, x: VIEW_W / 2 - cx * scale, y: VIEW_H / 2 - cy * scale };
  }, [nodes]);

  const [view, setView] = useState(fit);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Search centres the focused node.
  useEffect(() => {
    const n = focusId === null ? undefined : byId.get(focusId);
    if (n === undefined) return;
    setView((v) => ({ x: VIEW_W / 2 - n.x * v.scale, y: VIEW_H / 2 - n.y * v.scale, scale: v.scale }));
  }, [focusNonce, focusId, byId]);

  const onWheel = (e: React.WheelEvent): void => {
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => {
      const scale = Math.min(3, Math.max(0.2, v.scale * factor));
      return { ...v, scale };
    });
  };
  const onPointerDown = (e: React.PointerEvent): void => {
    drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    if (drag.current === null) return;
    const d = drag.current;
    setView((v) => ({ ...v, x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
  };
  const endDrag = (): void => { drag.current = null; };

  return (
    <div className="gm-web" onWheel={onWheel}>
      <svg
        className="gm-web__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="Passive skill web"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {edges.map((e, i) => (
            <line
              key={i}
              className="gm-web__edge"
              data-side={e.side}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            />
          ))}
          {nodes.map((n) => {
            const size = NODE_SIZE[n.kind];
            const r = size / 2;
            const radius = n.kind === 'keystone' ? '8px' : undefined;
            return (
              <g
                key={n.id}
                className="gm-web__node"
                data-side={n.side}
                data-allocated={n.allocated}
                data-kind={n.kind}
                data-allocatable={n.allocatable || undefined}
                data-refundable={n.refundable || undefined}
                transform={`translate(${n.x} ${n.y})`}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerEnter={() => onHover(n.id)}
                onPointerLeave={() => onHover(null)}
                onClick={() => onNode(n.id)}
              >
                {/* the click target is at least 44 px, even for a small node */}
                <circle className="gm-web__hit" r={22} fill="transparent" />
                {n.kind === 'keystone' ? (
                  <rect className="gm-web__shape" x={-r} y={-r} width={size} height={size} rx={8} />
                ) : (
                  <circle className="gm-web__shape" r={r} />
                )}
                <title>{n.name}</title>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
