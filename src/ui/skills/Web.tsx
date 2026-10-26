import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { iconDataUrl } from '../PixelArt';
import type { SkillNodeVM } from './skillsView';

const VIEW_W = 1120;
const VIEW_H = 760;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.25;

interface Props {
  nodes: SkillNodeVM[];
  onNode: (id: string) => void;
  onHover: (id: string | null) => void;
  focusId: string | null;
  focusNonce: number;
  /** The accessible name; the passive web and the ascendancy tree share this component. */
  label?: string;
  /** The node whose card shows (hovered or pinned), and a renderer for that card. */
  cardId?: string | null;
  renderCard?: (node: SkillNodeVM) => ReactNode;
  /** Called when the panel background is pressed, so a pinned card can close. */
  onCloseCard?: () => void;
}

interface View { scale: number; x: number; y: number }

/** The passive web as an SVG: edges and nodes, with drag-to-pan and wheel or button zoom. */
export function Web({
  nodes, onNode, onHover, focusId, focusNonce, label = 'Passive skill web', cardId, renderCard, onCloseCard,
}: Props) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // Data URIs are built once per node set, not on every pan/zoom render.
  const iconUris = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) map.set(n.id, iconDataUrl(n.icon.grid, n.icon.palette));
    return map;
  }, [nodes]);
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: {
      x1: number; y1: number; x2: number; y2: number; side: SkillNodeVM['side']; lit: boolean; refunding: boolean;
    }[] = [];
    for (const n of nodes) {
      for (const l of n.links) {
        const m = byId.get(l);
        if (m === undefined) continue;
        const key = n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          x1: n.x, y1: n.y, x2: m.x, y2: m.y, side: n.side,
          lit: (n.allocated || n.staged) && (m.allocated || m.staged),
          refunding: n.refunding || m.refunding,
        });
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

  // Moving from a node onto its card must not dismiss the card: a short grace period bridges the gap.
  const leaveTimer = useRef<number | null>(null);
  const cancelLeave = (): void => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };
  useEffect(() => () => cancelLeave(), []);
  const enterNode = (id: string): void => {
    cancelLeave();
    onHover(id);
  };
  const leaveNode = (e: React.PointerEvent): void => {
    cancelLeave();
    // On a mouse or pen the card is read-only and clicks act on the nodes, so it closes at once. A touch tap pins
    // its card, so the grace period only matters there.
    if (e.pointerType !== 'touch') {
      onHover(null);
      return;
    }
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      onHover(null);
    }, 300);
  };

  // The hovered/pinned card floats beside its node, in the panel's own pixels.
  const cardNode = cardId === null || cardId === undefined ? undefined : byId.get(cardId);
  const [cardAt, setCardAt] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null || cardNode === undefined) {
      setCardAt(null);
      return;
    }
    const place = (): void => {
      const ctm = svg.getScreenCTM();
      if (ctm === null) return;
      const point = svg.createSVGPoint();
      point.x = view.x + cardNode.x * view.scale;
      point.y = view.y + cardNode.y * view.scale;
      const screen = point.matrixTransform(ctm);
      const rect = svg.getBoundingClientRect();
      setCardAt({ x: screen.x - rect.left, y: screen.y - rect.top, width: rect.width, height: rect.height });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [cardNode, view]);

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
    onCloseCard?.();
    drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    if (drag.current === null) return;
    const d = drag.current;
    setView((v) => ({ ...v, x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
  };
  const endDrag = (): void => { drag.current = null; };

  const cardBox = cardAt === null ? null : (() => {
    const cardW = Math.min(280, cardAt.width - 16);
    const above = cardAt.y > cardAt.height / 2;
    const available = above ? cardAt.y - 22 : cardAt.height - cardAt.y - 22;
    return {
      left: Math.min(Math.max(cardAt.x, cardW / 2 + 8), cardAt.width - cardW / 2 - 8),
      top: cardAt.y,
      maxHeight: Math.max(96, available),
      above,
    };
  })();

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
              data-allocated={e.lit || undefined}
              data-refunding={e.refunding || undefined}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            />
          ))}
          {nodes.map((n) => (
            <g
              key={n.id}
              className="gm-web__node"
              data-side={n.side}
              data-allocated={n.allocated}
              data-kind={n.kind}
              data-allocatable={n.allocatable || undefined}
              data-refundable={n.refundable || undefined}
              data-staged={n.staged || undefined}
              data-refunding={n.refunding || undefined}
              transform={`translate(${n.x} ${n.y})`}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerEnter={() => enterNode(n.id)}
              onPointerLeave={leaveNode}
              onClick={() => onNode(n.id)}
            >
              {/* the click target is at least 44 px, even for a small node */}
              <circle className="gm-web__hit" r={22} fill="transparent" />
              <circle className="gm-web__halo" r={24} />
              <image
                className="gm-web__icon"
                href={iconUris.get(n.id) ?? ''}
                x={-24}
                y={-24}
                width={48}
                height={48}
                preserveAspectRatio="none"
              />
              <title>{n.name}</title>
            </g>
          ))}
        </g>
      </svg>
      {cardNode !== undefined && renderCard !== undefined && cardBox !== null && (
        <div
          className="gm-web__card"
          data-above={cardBox.above ? 'true' : 'false'}
          style={{ left: cardBox.left, top: cardBox.top, maxHeight: cardBox.maxHeight }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerEnter={cancelLeave}
          onPointerLeave={() => onHover(null)}
        >
          {renderCard(cardNode)}
        </div>
      )}
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
