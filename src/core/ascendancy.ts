import { ASCEND_DEPTH_PER_POINT } from './balance';
import type { StatKey } from './items';
import type { GameState } from './types';

export type AscendancyKind = 'small' | 'notable' | 'start';
/** What a node grants: a stat, a starting depth, a passive point, or a map tier auto-mapping reaches. */
export type AscendancyEffect =
  | { kind: 'stat'; stat: StatKey; value: number }
  | { kind: 'startingDepth'; value: number }
  | { kind: 'passivePoints'; value: number }
  | { kind: 'autoMapTier'; value: number };

export interface AscendancyNode {
  id: string;
  name: string;
  kind: AscendancyKind;
  x: number;
  y: number;
  links: string[];
  effects: AscendancyEffect[];
  desc: string;
}

export const ASCENDANCY_START_ID = 'minerReborn';

const stat = (stat: StatKey, value: number): AscendancyEffect => ({ kind: 'stat', stat, value });
const startingDepth = (value: number): AscendancyEffect => ({ kind: 'startingDepth', value });
const passivePoints = (value: number): AscendancyEffect => ({ kind: 'passivePoints', value });
const autoMapTier = (value: number): AscendancyEffect => ({ kind: 'autoMapTier', value });
// A "find" node grants chest, gem and map find together.
const find = (value: number): AscendancyEffect[] => [
  stat('chestFind', value), stat('gemFind', value), stat('mapFind', value),
];

interface NamedSpec { id: string; name: string; effects: AscendancyEffect[]; desc: string }
const n = (id: string, name: string, effects: AscendancyEffect[], desc: string): NamedSpec => ({ id, name, effects, desc });

interface SmallSpec { name: string; effects: AscendancyEffect[] }
const s = (name: string, effects: AscendancyEffect[]): SmallSpec => ({ name, effects });

interface ClusterDef { prefix: string; angle: number; smalls: SmallSpec[]; notable: NamedSpec }

// Six short radial chains, each ending in its notable. The smalls are whole percents or whole numbers.
const CLUSTERS: ClusterDef[] = [
  {
    prefix: 'wealth', angle: 90,
    smalls: [
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Diamond Yield', [stat('diamondYield', 10)]),
      s('Diamond Yield', [stat('diamondYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
    ],
    notable: n('midasTouch', 'Midas Touch', [stat('goldYield', 25)], '+25% Gold.'),
  },
  {
    prefix: 'depth', angle: 150,
    smalls: [
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
    ],
    notable: n('deepRoots', 'Deep Roots', [startingDepth(50)], 'Start 50 m deeper.'),
  },
  {
    prefix: 'insight', angle: 210,
    smalls: [
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
    ],
    notable: n('secondSight', 'Second Sight', [passivePoints(1)], '+1 passive point.'),
  },
  {
    prefix: 'cartography', angle: 270,
    smalls: [
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
    ],
    notable: n('masterSurveyor', 'Master Surveyor', [autoMapTier(2)], '+2 auto-map tiers.'),
  },
  {
    prefix: 'endurance', angle: 330,
    smalls: [
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
    ],
    notable: n('tireless', 'Tireless', [stat('offlineCap', 120)], '+2 h offline cap.'),
  },
  {
    prefix: 'fortuna', angle: 30,
    smalls: [
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
    ],
    notable: n('luckyBreak', 'Lucky Break', find(10), '+10% chest, gem and map find.'),
  },
];

const START_X = 560;
const START_Y = 400;
const RING_GAP = 70;

interface Placed {
  id: string;
  name: string;
  kind: AscendancyKind;
  effects: AscendancyEffect[];
  desc: string;
  x: number;
  y: number;
  links: string[];
  ring: number;
}

function pointX(angleDeg: number, ring: number): number {
  return Math.round(START_X + Math.cos((angleDeg * Math.PI) / 180) * ring * RING_GAP);
}
function pointY(angleDeg: number, ring: number): number {
  return Math.round(START_Y + Math.sin((angleDeg * Math.PI) / 180) * ring * RING_GAP);
}

function buildTree(): AscendancyNode[] {
  const placed: Placed[] = [];
  for (const cluster of CLUSTERS) {
    let previous = ASCENDANCY_START_ID;
    cluster.smalls.forEach((small, i) => {
      const id = `${cluster.prefix}Small${i + 1}`;
      placed.push({
        id, name: small.name, kind: 'small', effects: small.effects, desc: '',
        x: pointX(cluster.angle, i + 1), y: pointY(cluster.angle, i + 1), links: [previous], ring: i + 1,
      });
      previous = id;
    });
    placed.push({
      id: cluster.notable.id, name: cluster.notable.name, kind: 'notable', effects: cluster.notable.effects,
      desc: cluster.notable.desc, x: pointX(cluster.angle, cluster.smalls.length + 1),
      y: pointY(cluster.angle, cluster.smalls.length + 1), links: [previous], ring: cluster.smalls.length + 1,
    });
  }
  // symmetric links: every link a -> b is also b -> a
  for (const p of placed) {
    for (const l of p.links) {
      if (l === ASCENDANCY_START_ID) continue;
      const other = placed.find((o) => o.id === l);
      if (other !== undefined && !other.links.includes(p.id)) other.links.push(p.id);
    }
  }

  const start: AscendancyNode = {
    id: ASCENDANCY_START_ID, name: 'Miner Reborn', kind: 'start', x: START_X, y: START_Y,
    links: placed.filter((p) => p.ring === 1).map((p) => p.id), effects: [], desc: 'Start',
  };
  return [start, ...placed.map(({ id, name, kind, effects, desc, x, y, links }) =>
    ({ id, name, kind, x, y, links, effects, desc }))];
}

export const ASCENDANCY_NODES: readonly AscendancyNode[] = buildTree();

export const ASCENDANCY_NODE_BY_ID: ReadonlyMap<string, AscendancyNode> = new Map(
  ASCENDANCY_NODES.map((node) => [node.id, node]),
);

export const ASCENDANCY_NODE_COUNT = ASCENDANCY_NODES.length;

/** The points a run's deepest depth is worth: one per ASCEND_DEPTH_PER_POINT metres, taken as a square root. */
export function ascendancyPoints(deepest: number): number {
  if (!Number.isFinite(deepest) || deepest < 0) return 0;
  return Math.floor(Math.sqrt(deepest / ASCEND_DEPTH_PER_POINT));
}

export interface AscendancyTotals {
  stats: Record<StatKey, number>;
  startingDepth: number;
  passivePoints: number;
  autoMapTier: number;
}

/** The allocated nodes' effects, summed: stats into `stats`, the structural bonuses on their own. */
export function ascendancyTotals(state: Pick<GameState, 'ascendancy'>): AscendancyTotals {
  const totals: AscendancyTotals = {
    stats: {} as Record<StatKey, number>, startingDepth: 0, passivePoints: 0, autoMapTier: 0,
  };
  for (const id of state.ascendancy.allocated) {
    const node = ASCENDANCY_NODE_BY_ID.get(id);
    if (node === undefined) continue;
    for (const effect of node.effects) {
      switch (effect.kind) {
        case 'stat': totals.stats[effect.stat] = (totals.stats[effect.stat] ?? 0) + effect.value; break;
        case 'startingDepth': totals.startingDepth += effect.value; break;
        case 'passivePoints': totals.passivePoints += effect.value; break;
        case 'autoMapTier': totals.autoMapTier += effect.value; break;
      }
    }
  }
  return totals;
}

/** The most passive points the whole tree grants, summed from the table: three smalls and a notable, four in all. */
export const MAX_ASCENDANCY_PASSIVE_POINTS: number = ASCENDANCY_NODES.reduce(
  (sum, node) => sum + node.effects.reduce((n, e) => n + (e.kind === 'passivePoints' ? e.value : 0), 0),
  0,
);

/** Whether `id` links to the start or to an allocated node (and is not itself allocated). */
export function canAllocateAscendancy(state: Pick<GameState, 'ascendancy'>, id: string): boolean {
  const node = ASCENDANCY_NODE_BY_ID.get(id);
  if (node === undefined || id === ASCENDANCY_START_ID || state.ascendancy.allocated.includes(id)) return false;
  return node.links.some((l) => l === ASCENDANCY_START_ID || state.ascendancy.allocated.includes(l));
}

/** Allocates a node for one permanent point. The start is free and never enters the allocated list. */
export function allocateAscendancy(
  state: GameState,
  id: string,
): 'ok' | 'noPoints' | 'notAdjacent' | 'allocated' | 'invalid' {
  const node = ASCENDANCY_NODE_BY_ID.get(id);
  if (node === undefined || id === ASCENDANCY_START_ID) return 'invalid';
  if (state.ascendancy.allocated.includes(id)) return 'allocated';
  if (!canAllocateAscendancy(state, id)) return 'notAdjacent';
  if (state.ascendancy.points <= 0) return 'noPoints';
  state.ascendancy.allocated.push(id);
  state.ascendancy.points -= 1;
  return 'ok';
}
