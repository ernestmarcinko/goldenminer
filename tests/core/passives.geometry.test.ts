import { expect, it } from 'vitest';
import { PASSIVE_NODE_BY_ID, PASSIVE_NODES } from '../../src/core/passives';

interface Pt { x: number; y: number }

function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const cross = (o: Pt, p: Pt, q: Pt): number => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const ccw = cross(a, c, d);
  const ddw = cross(b, c, d);
  const ea = cross(c, a, b);
  const eb = cross(d, a, b);
  const eps = 1e-9;
  const onSeg = (p: Pt, q: Pt, r: Pt): boolean =>
    Math.min(q.x, r.x) - eps <= p.x && p.x <= Math.max(q.x, r.x) + eps &&
    Math.min(q.y, r.y) - eps <= p.y && p.y <= Math.max(q.y, r.y) + eps;
  if (((ccw > 0 && ddw < 0) || (ccw < 0 && ddw > 0)) && ((ea > 0 && eb < 0) || (ea < 0 && eb > 0))) return true;
  if (Math.abs(ccw) < eps && onSeg(c, a, b)) return true;
  if (Math.abs(ddw) < eps && onSeg(d, a, b)) return true;
  if (Math.abs(ea) < eps && onSeg(a, c, d)) return true;
  if (Math.abs(eb) < eps && onSeg(b, c, d)) return true;
  return false;
}

function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

it('the web is planar: no crossing edges, no overlapping nodes, no edge through a node', () => {
  const byId = PASSIVE_NODE_BY_ID;
  const nodes = PASSIVE_NODES;
  const edges: { a: string; b: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    for (const l of n.links) {
      const m = byId.get(l);
      if (m === undefined) continue;
      const key = n.id < l ? `${n.id}|${l}` : `${l}|${n.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: n.id, b: l, x1: n.x, y1: n.y, x2: m.x, y2: m.y });
    }
  }

  // No two edges that do not share an endpoint may cross.
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const A = edges[i];
      const B = edges[j];
      if (A === undefined || B === undefined) continue;
      if (A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b) continue;
      const crossing = segIntersect(
        { x: A.x1, y: A.y1 }, { x: A.x2, y: A.y2 }, { x: B.x1, y: B.y1 }, { x: B.x2, y: B.y2 },
      );
      expect(crossing, `${A.a}–${A.b} crosses ${B.a}–${B.b}`).toBe(false);
    }
  }

  // No two nodes may sit close enough for their icons to overlap: the smallest icon is 48 px across.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a === undefined || b === undefined) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      expect(d, `${a.id} and ${b.id} overlap`).toBeGreaterThanOrEqual(48);
    }
  }

  // No edge may run through a node it does not connect.
  for (const e of edges) {
    for (const n of nodes) {
      if (n.id === e.a || n.id === e.b) continue;
      const d = pointSegDist({ x: n.x, y: n.y }, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
      expect(d, `${e.a}–${e.b} runs through ${n.id}`).toBeGreaterThanOrEqual(24);
    }
  }
});
