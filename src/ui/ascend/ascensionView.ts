import {
  ASCENDANCY_NODES, ASCENDANCY_START_ID, ascendancyPoints, canAllocateAscendancy,
  type AscendancyEffect,
} from '../../core/ascendancy';
import { ASCEND_LEVEL } from '../../core/balance';
import { composeIcon, iconForAscendancy } from '../../core/skillIcons';
import type { GameState } from '../../core/types';
import { statText } from '../character/itemView';
import { formatNumber, plural } from '../format';
import type { SkillNodeVM } from '../skills/skillsView';

/** One ascendancy effect in words: a stat's line, or the tree's structural bonuses. */
function effectLine(e: AscendancyEffect): string {
  switch (e.kind) {
    case 'stat': return statText(e.stat, e.value);
    case 'startingDepth': return `+${formatNumber(e.value)} m starting depth`;
    case 'passivePoints': return `+${plural(e.value, 'passive point', 'passive points')}`;
    case 'autoMapTier': return `+${plural(e.value, 'auto-map tier', 'auto-map tiers')}`;
  }
}

/** The node's effects in words, joined: "+25 m starting depth, +1 passive point". */
function nodeLine(effects: readonly AscendancyEffect[]): string {
  return effects.map(effectLine).join(', ');
}

/** The ascendancy tree as the web draws it: each node's place, its effect in words, and whether it can be clicked now. */
export function ascendancyVMs(state: GameState): SkillNodeVM[] {
  return ASCENDANCY_NODES.map((n) => {
    const start = n.id === ASCENDANCY_START_ID;
    const glyph = iconForAscendancy(n);
    const frameKind = n.kind === 'start' ? 'start' : 'ascendancy';
    return {
      id: n.id,
      name: n.name,
      kind: n.kind,
      side: start ? 'start' : 'hybrid',
      x: n.x,
      y: n.y,
      links: n.links,
      desc: n.desc,
      line: nodeLine(n.effects),
      allocated: start || state.ascendancy.allocated.includes(n.id),
      // A node only looks takeable when there is an ascendancy point to spend on it.
      allocatable: state.ascendancy.points > 0 && canAllocateAscendancy(state, n.id),
      refundable: false,
      staged: false,
      refunding: false,
      icon: composeIcon(frameKind, glyph, 'ascendancy'),
    };
  });
}

/** How many ascendancy points the player holds. */
export function ascendancyPointsLine(state: GameState): string {
  const n = state.ascendancy.points;
  return n === 0 ? 'No ascendancy points to spend' : `${plural(n, 'ascendancy point', 'ascendancy points')} to spend`;
}

/** The ascend button's label: what it would pay, or what level unlocks it. */
export function ascendLine(state: GameState): string {
  if (state.level < ASCEND_LEVEL) return `Reach level ${formatNumber(ASCEND_LEVEL)} to ascend`;
  return `Ascend for ${plural(ascendancyPoints(state.deepest, state.level, state.lifetime.ascensions), 'point', 'points')}`;
}

/** The points the current depth and level would be worth on ascending. */
export function pointsPreview(state: GameState): string {
  const points = ascendancyPoints(state.deepest, state.level, state.lifetime.ascensions);
  const depth = `Deepest ${formatNumber(state.deepest)} m`;
  const level = state.lifetime.ascensions >= 1 ? ` · level ${formatNumber(state.level)}` : '';
  return `${depth}${level} → ${formatNumber(points)} points`;
}
