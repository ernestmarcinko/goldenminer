import { useEffect, useMemo, useRef, useState } from 'react';
import type { SkillNodeVM } from './skillsView';

const VIEW_W = 1120;
const VIEW_H = 760;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.25;

const NODE_SIZE: Readonly<Record<SkillNodeVM['kind'], number>> = { start: 44, keystone: 40, notable: 32, small: 20 };

interface Props {
  nodes: SkillNodeVM[];
  onNode: (id: string) => void;
  onHover: (id: string | null) => void;
  focusId: string | null;
  focusNonce: number;
  /** The accessible name; the passive web and the ascendancy tree share this component. */
  label?: string;
}

interface View { scale: number; x: number; y: number }

/** The passive web as an SVG: edges and nodes, with drag-to-pan and wheel or button zoom. */
export function Web({ nodes, onNode, onHover, focusId, focusNonce, label = 'Passive skill web' }: Props) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      x1: number; y1: number; x2: number; y2: number; side: SkillNodeVM['side']; allocated: boolean;
    }[] = [];
    for (const n of nodes) {
      for (const l of n.links) {
        const m = byId.get(l);
        if (m === undefined) continue;
        const key = n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x1: n.x, y1: n.y, x2: m.x, y2: m.y, side: n.side, allocated: n.allocated && m.allocated });
      }
    }
    return out;
  }, [nodes, byId]);

  // The whole web's fit, used by the Fit button and as the zoom-out reference.
  const fit = useMemo((): View => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(VIEW_W / (maxX - minX), VIEW_H / (maxY - minY))));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { scale, x: VIEW_W / 2 - cx * scale, y: VIEW_H / 2 - cy * scale };
  }, [nodes]);

  // Start zoomed in on the miner: the whole passive web is unreadable when fitted, while a small tree starts fitted.
  const start = nodes.find((n) => n.kind === 'start');
  const initialScale = Math.max(1, fit.scale);
  const initial = useMemo((): View => {
    const x = start?.x ?? 0;
    const y = start?.y ?? 0;
    return { scale: initialScale, x: VIEW_W / 2 - x * initialScale, y: VIEW_H / 2 - y * initialScale };
  }, [start?.x, start?.y, initialScale]);

  const [view, setView] = useState<View>(initial);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Search centres the focused node at the current scale.
  useEffect(() => {
    const n = focusId === null ? undefined : byId.get(focusId);
    if (n === undefined) return;
    setView((v) => ({ x: VIEW_W / 2 - n.x * v.scale, y: VIEW_H / 2 - n.y * v.scale, scale: v.scale }));
  }, [focusNonce, focusId, byId]);

  /** Zooms by `factor` keeping the view-box point (`px`, `py`) under the same screen spot. */
  const zoomAt = (px: number, py: number, factor: number): void => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  const onWheel = (e: React.WheelEvent): void => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    zoomAt(px, py, e.deltaY < 0 ? 1.12 : 1 / 1.12);
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
    <div className="gm-web">
      <svg
        ref={svgRef}
        className="gm-web__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={label}
        onWheel={onWheel}
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
              data-allocated={e.allocated || undefined}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            />
          ))}
          {nodes.map((n) => {
            const size = NODE_SIZE[n.kind];
            const r = size / 2;
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
                {n.allocated && <circle className="gm-web__core" r={Math.max(3, Math.round(size * 0.16))} />}
                <title>{n.name}</title>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="gm-web__controls">
        <button
          type="button" className="gm-web__zoom" aria-label="Zoom in" title="Zoom in"
          onClick={() => zoomAt(VIEW_W / 2, VIEW_H / 2, ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button" className="gm-web__zoom" aria-label="Zoom out" title="Zoom out"
          onClick={() => zoomAt(VIEW_W / 2, VIEW_H / 2, 1 / ZOOM_STEP)}
        >
          −
        </button>
        <button
          type="button" className="gm-web__zoom gm-web__zoom--fit" aria-label="Fit the whole tree" title="Fit the whole tree"
          onClick={() => setView(fit)}
        >
          Fit
        </button>
      </div>
    </div>
  );
}
