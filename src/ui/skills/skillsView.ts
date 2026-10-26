import { RESET_WEB_DIAMONDS } from '../../core/balance';
import {
  PASSIVE_NODES, canAllocate, canRefund, pointsToSpend,
  type PassiveKind, type PassiveNode, type PassiveSide,
} from '../../core/passives';
import { refundPrice } from '../../core/respec';
import type { GameState } from '../../core/types';
import { statText } from '../character/itemView';
import { formatNumber, plural } from '../format';

/** A node as the web draws it: its place, its effect in words, and whether it can be clicked now. */
export interface SkillNodeVM {
  id: string;
  name: string;
  kind: PassiveKind;
  side: PassiveSide;
  x: number;
  y: number;
  links: string[];
  desc: string;
  line: string;
  allocated: boolean;
  allocatable: boolean;
  refundable: boolean;
}

/** The node's effect in words: a small node's stat, a named node's own sentence. */
function effectLine(n: PassiveNode): string {
  if (n.desc !== '') return n.desc;
  const s = n.effects.find((e) => e.kind === 'stat');
  return s !== undefined && s.kind === 'stat' ? statText(s.stat, s.value) : '';
}

export function nodeVMs(state: GameState): SkillNodeVM[] {
  const points = pointsToSpend(state);
  return PASSIVE_NODES.map((n) => {
    const allocated = n.side === 'start' || state.passives.allocated.includes(n.id);
    return {
      id: n.id,
      name: n.name,
      kind: n.kind,
      side: n.side,
      x: n.x,
      y: n.y,
      links: n.links,
      desc: n.desc,
      line: effectLine(n),
      allocated,
      // A node only looks takeable when there is actually a point to spend on it.
      allocatable: n.side !== 'start' && !allocated && points > 0 && canAllocate(state, n.id),
      refundable: n.side !== 'start' && allocated && canRefund(state, n.id),
    };
  });
}

/** The header's line under the level: how many points are left. */
export function pointsLine(state: GameState): string {
  const n = pointsToSpend(state);
  const head = n === 0 ? 'No points to spend' : `${plural(n, 'point', 'points')} to spend`;
  return `${head} · level ${formatNumber(state.level)}`;
}

/** What refunding this node costs, or why it cannot be refunded yet. */
export function refundLine(state: GameState, id: string): string {
  if (!state.passives.allocated.includes(id)) return 'Not allocated';
  if (!canRefund(state, id)) return "Can't refund yet";
  return `Refund for ${formatNumber(refundPrice(state.level))} Gold`;
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
