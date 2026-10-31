import { ASCENDANCY_NODES, type AscendancyNode } from '../../core/ascendancy';
import { PASSIVE_NODES, type PassiveNode } from '../../core/passives';

/** The keystone nodes of the passive web (a rule change with a downside). */
export function keystoneNodes(): PassiveNode[] {
  return PASSIVE_NODES.filter((n) => n.kind === 'keystone');
}

/** The named notable nodes of the passive web. */
export function notableNodes(): PassiveNode[] {
  return PASSIVE_NODES.filter((n) => n.kind === 'notable');
}

/** The bulk small +stat nodes of the passive web. */
export function smallNodes(): PassiveNode[] {
  return PASSIVE_NODES.filter((n) => n.kind === 'small');
}

/** The whole ascendancy tree, each node carrying its allocation cost (small 1, mid 6, big 12, start 0). */
export function ascendancyNodes(): AscendancyNode[] {
  return [...ASCENDANCY_NODES];
}
