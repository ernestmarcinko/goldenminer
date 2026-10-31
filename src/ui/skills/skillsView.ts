import { RESET_WEB_DIAMONDS } from '../../core/balance';
import {
  PASSIVE_NODE_BY_ID, PASSIVE_NODES, START_NODE_ID, isConnectedWeb, pointsToSpend,
  type PassiveKind, type PassiveNode, type PassiveSide,
} from '../../core/passives';
import { refundPrice } from '../../core/respec';
import { composeIcon, iconForPassive, type IconGlyphId } from '../../core/skillIcons';
import type { GameState } from '../../core/types';
import { statText } from '../character/itemView';
import { formatNumber, plural } from '../format';

/** Whether clicks are staging allocations (the default) or staging refunds. */
export type SkillMode = 'allocate' | 'refund';

/** A node as the web draws it: its place, its effect in words, and whether it can be clicked now. */
export interface SkillNodeVM {
  id: string;
  name: string;
  kind: PassiveKind;
  /** The points the node costs: 1 on the passive web, 1/6/12 on the ascendancy tree (0 for the start). */
  cost: number;
  side: PassiveSide;
  x: number;
  y: number;
  links: string[];
  desc: string;
  line: string;
  /** The hover `<title>`: `name — line`, plus the description when it adds something. */
  tip: string;
  allocated: boolean;
  /** Allocatable now, counting staged nodes as allocated. */
  allocatable: boolean;
  /** Refundable now, counting nodes already marked for refund as gone. */
  refundable: boolean;
  /** Staged for allocation, not yet confirmed. */
  staged: boolean;
  /** Marked for refund, not yet confirmed. */
  refunding: boolean;
  /** The composed 24 × 24 pixel icon for the node, drawn on the web and in the card. */
  icon: { id: IconGlyphId; grid: string[]; palette: Record<string, string> };
}

export interface NodeVMOptions {
  mode?: SkillMode;
  staged?: readonly string[];
  refund?: readonly string[];
}

/** The node's effect in words: a small node's stat, a named node's own sentence. */
function effectLine(n: PassiveNode): string {
  if (n.desc !== '') return n.desc;
  const s = n.effects.find((e) => e.kind === 'stat');
  return s !== undefined && s.kind === 'stat' ? statText(s.stat, s.value) : '';
}

/** The hover `<title>`: `name — line`, plus the description when it differs and adds detail. */
export function nodeTip(name: string, line: string, desc: string): string {
  const parts = [name, line].filter((s) => s !== '');
  if (desc !== '' && desc !== line) parts.push(desc);
  return parts.join(' — ');
}

export function nodeVMs(state: GameState, options: NodeVMOptions = {}): SkillNodeVM[] {
  const mode = options.mode ?? 'allocate';
  const staged = options.staged ?? [];
  const refunding = options.refund ?? [];
  const pointsLeft = pointsToSpend(state) - staged.length;
  // Adjacency counts the start, everything already allocated, and everything staged before this render.
  const available = new Set(state.passives.allocated);
  available.add(START_NODE_ID);
  for (const id of staged) available.add(id);
  const marked = new Set(refunding);
  return PASSIVE_NODES.map((n) => {
    const allocated = n.side === 'start' || state.passives.allocated.includes(n.id);
    const isStaged = staged.includes(n.id);
    const isRefunding = refunding.includes(n.id);
    const remaining = state.passives.allocated.filter((id) => id !== n.id && !marked.has(id));
    const glyph = iconForPassive(n);
    const frameKind = n.kind === 'start' ? 'start' : n.kind === 'keystone' ? 'keystone' : n.kind === 'notable' ? 'notable' : 'small';
    return {
      id: n.id,
      name: n.name,
      kind: n.kind,
      cost: 1,
      side: n.side,
      x: n.x,
      y: n.y,
      links: n.links,
      desc: n.desc,
      line: effectLine(n),
      tip: nodeTip(n.name, effectLine(n), n.desc),
      allocated,
      // A node only looks takeable when there is actually a point to spend on it.
      allocatable: mode === 'allocate' && n.side !== 'start' && !allocated && !isStaged
        && pointsLeft > 0 && n.links.some((l) => available.has(l)),
      refundable: mode === 'refund' && n.side !== 'start' && allocated && !isRefunding
        && isConnectedWeb(remaining),
      staged: isStaged,
      refunding: isRefunding,
      icon: composeIcon(frameKind, glyph, n.side),
    };
  });
}

/**
 * Drops staged nodes that no longer connect to the start or an allocated/staged node, keeping allocation order:
 * unstaging a parent also unstages everything that depended on it.
 */
export function pruneStaged(allocated: readonly string[], staged: readonly string[]): string[] {
  const available = new Set(allocated);
  available.add(START_NODE_ID);
  const out: string[] = [];
  for (const id of staged) {
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node !== undefined && node.links.some((l) => available.has(l))) {
      out.push(id);
      available.add(id);
    }
  }
  return out;
}

/** The header's line under the level: how many points are left. */
export function pointsLine(state: GameState): string {
  const n = pointsToSpend(state);
  const head = n === 0 ? 'No points to spend' : `${plural(n, 'point', 'points')} to spend`;
  return `${head} · level ${formatNumber(state.level)}`;
}

/** What a single-node refund costs, or why it cannot be refunded yet. */
export function refundLine(state: GameState, id: string): string {
  if (!state.passives.allocated.includes(id)) return 'Not allocated';
  if (!isConnectedWeb(state.passives.allocated.filter((n) => n !== id))) return "Can't refund yet";
  return `Refund for ${formatNumber(refundPrice(state.level))} Gold`;
}

/** The staged refund's price line. */
export function refundTotalLine(state: GameState, ids: readonly string[]): string {
  if (ids.length === 0) return 'No nodes marked for refund';
  return `Refund ${plural(ids.length, 'node', 'nodes')} for ${formatNumber(refundPrice(state.level) * ids.length)} Gold`;
}

/** Whether the Gold on hand covers the staged refund. */
export function refundAffordable(state: GameState, ids: readonly string[]): boolean {
  return state.gold >= refundPrice(state.level) * ids.length;
}

/** The full reset's price. */
export function resetLine(): string {
  return `Reset web for ${formatNumber(RESET_WEB_DIAMONDS)} Diamonds`;
}

/** The ids whose name or effect contains the query, case-insensitive. */
export function searchNodes(_state: GameState, q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (needle === '') return [];
  return PASSIVE_NODES.filter(
    (n) => n.name.toLowerCase().includes(needle) || effectLine(n).toLowerCase().includes(needle),
  ).map((n) => n.id);
}
