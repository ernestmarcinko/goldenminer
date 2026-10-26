import { ASCEND_DEPTH_PER_POINT, ASCEND_LEVEL, ASCEND_LEVEL_STEP } from './balance';
import type { StatKey } from './items';
import type { GameState } from './types';

export type AscendancyKind = 'small' | 'mid' | 'big' | 'start';
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
  /** The points the node costs to allocate: small 1, mid 2, big 4, start 0 (free). The cost is code, never saved. */
  cost: number;
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

interface ClusterDef {
  prefix: string;
  angle: number;
  smalls: SmallSpec[];
  mid: NamedSpec;
  big: NamedSpec;
  /**
   * For the six clusters that predate the expansion, how many leading smalls existed before (so their ids — and the
   * mid's link to the last of them — stay stable, keeping old saves connected). New clusters have none.
   */
  legacySmalls?: number;
}

// Eight radial clusters, each a chain of smalls (1 point) into a mid (2 points) and a big (4 points). The smalls are
// whole percents or whole numbers; the mid is the old "notable", the big the new keystone-grade permanent bonus.
const CLUSTERS: ClusterDef[] = [
  {
    prefix: 'wealth', angle: 90, legacySmalls: 5,
    smalls: [
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Diamond Yield', [stat('diamondYield', 10)]),
      s('Diamond Yield', [stat('diamondYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Diamond Yield', [stat('diamondYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
    ],
    mid: n('midasTouch', 'Midas Touch', [stat('goldYield', 25)], '+25% Gold.'),
    big: n('goldRush', 'Gold Rush', [stat('goldYield', 40), stat('diamondYield', 40)], '+40% Gold, +40% Diamonds.'),
  },
  {
    prefix: 'depth', angle: 135, legacySmalls: 4,
    smalls: [
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
      s('Starting Depth', [startingDepth(25)]),
    ],
    mid: n('deepRoots', 'Deep Roots', [startingDepth(50)], 'Start 50 m deeper.'),
    big: n('worldCore', 'World Core', [startingDepth(250)], 'Start 250 m deeper.'),
  },
  {
    prefix: 'insight', angle: 180, legacySmalls: 3,
    smalls: [
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
      s('Passive Point', [passivePoints(1)]),
    ],
    mid: n('secondSight', 'Second Sight', [passivePoints(1)], '+1 passive point.'),
    big: n('thirdEye', 'Third Eye', [passivePoints(3)], '+3 passive points.'),
  },
  {
    prefix: 'cartography', angle: 225, legacySmalls: 3,
    smalls: [
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
      s('Auto-map Tier', [autoMapTier(1)]),
    ],
    mid: n('masterSurveyor', 'Master Surveyor', [autoMapTier(2)], '+2 auto-map tiers.'),
    big: n('worldAtlas', 'World Atlas', [autoMapTier(4)], '+4 auto-map tiers.'),
  },
  {
    prefix: 'endurance', angle: 270, legacySmalls: 4,
    smalls: [
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
      s('Offline Cap', [stat('offlineCap', 30)]),
    ],
    mid: n('tireless', 'Tireless', [stat('offlineCap', 120)], '+2 h offline cap.'),
    big: n('perpetualMotion', 'Perpetual Motion', [stat('offlineCap', 300)], '+5 h offline cap.'),
  },
  {
    prefix: 'fortuna', angle: 0, legacySmalls: 4,
    smalls: [
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
      s('Find', find(5)),
    ],
    mid: n('luckyBreak', 'Lucky Break', find(10), '+10% chest, gem and map find.'),
    big: n('jackpot', 'Jackpot', find(25), '+25% chest, gem and map find.'),
  },
  {
    prefix: 'might', angle: 45,
    smalls: [
      s('Damage', [stat('damage', 15)]),
      s('Damage', [stat('damage', 15)]),
      s('Life', [stat('life', 50)]),
      s('Life', [stat('life', 50)]),
      s('Damage', [stat('damage', 15)]),
      s('Damage', [stat('damage', 15)]),
      s('Life', [stat('life', 50)]),
      s('Life', [stat('life', 50)]),
    ],
    mid: n('gladiator', 'Gladiator', [stat('damage', 25), stat('life', 100)], '+25 damage, +100 life.'),
    big: n('colossus', 'Colossus', [stat('damage', 60), stat('life', 250)], '+60 damage, +250 life.'),
  },
  {
    prefix: 'greed', angle: 315,
    smalls: [
      s('Vein Yield', [stat('veinYield', 10)]),
      s('Vein Yield', [stat('veinYield', 10)]),
      s('Ore Find', [stat('oreFind', 10)]),
      s('Ore Find', [stat('oreFind', 10)]),
      s('Vein Yield', [stat('veinYield', 10)]),
      s('Vein Yield', [stat('veinYield', 10)]),
      s('Gold Yield', [stat('goldYield', 10)]),
      s('Diamond Yield', [stat('diamondYield', 10)]),
    ],
    mid: n('deepVeins', 'Deep Veins', [stat('veinYield', 15), stat('oreFind', 15)], '+15% vein yield, +15% ore find.'),
    big: n('elDorado', 'El Dorado', [stat('veinYield', 25), stat('oreFind', 25)], '+25% vein yield, +25% ore find.'),
  },
];

const START_X = 560;
const START_Y = 400;
const RING_GAP = 70;

interface Placed {
  id: string;
  name: string;
  kind: AscendancyKind;
  cost: number;
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
    // The mid also links back to the last pre-expansion small so an old save's chain stays connected to the start.
    const legacyLastId = cluster.legacySmalls !== undefined ? `${cluster.prefix}Small${cluster.legacySmalls}` : undefined;
    cluster.smalls.forEach((small, i) => {
      const id = `${cluster.prefix}Small${i + 1}`;
      placed.push({
        id, name: small.name, kind: 'small', cost: 1, effects: small.effects, desc: '',
        x: pointX(cluster.angle, i + 1), y: pointY(cluster.angle, i + 1), links: [previous], ring: i + 1,
      });
      previous = id;
    });
    const midLinks = [previous];
    if (legacyLastId !== undefined && legacyLastId !== previous) midLinks.push(legacyLastId);
    placed.push({
      id: cluster.mid.id, name: cluster.mid.name, kind: 'mid', cost: 2, effects: cluster.mid.effects,
      desc: cluster.mid.desc, x: pointX(cluster.angle, cluster.smalls.length + 1),
      y: pointY(cluster.angle, cluster.smalls.length + 1), links: midLinks, ring: cluster.smalls.length + 1,
    });
    placed.push({
      id: cluster.big.id, name: cluster.big.name, kind: 'big', cost: 4, effects: cluster.big.effects,
      desc: cluster.big.desc, x: pointX(cluster.angle, cluster.smalls.length + 2),
      y: pointY(cluster.angle, cluster.smalls.length + 2), links: [cluster.mid.id], ring: cluster.smalls.length + 2,
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
    id: ASCENDANCY_START_ID, name: 'Miner Reborn', kind: 'start', cost: 0, x: START_X, y: START_Y,
    links: placed.filter((p) => p.ring === 1).map((p) => p.id), effects: [], desc: 'Start',
  };
  return [start, ...placed.map(({ id, name, kind, cost, effects, desc, x, y, links }) =>
    ({ id, name, kind, cost, x, y, links, effects, desc }))];
}

export const ASCENDANCY_NODES: readonly AscendancyNode[] = buildTree();

export const ASCENDANCY_NODE_BY_ID: ReadonlyMap<string, AscendancyNode> = new Map(
  ASCENDANCY_NODES.map((node) => [node.id, node]),
);

export const ASCENDANCY_NODE_COUNT = ASCENDANCY_NODES.length;

/** The points a run is worth: the depth term, plus a level bonus from the second ascension on. */
export function ascendancyPoints(deepest: number, level: number, priorAscensions: number): number {
  if (!Number.isFinite(deepest) || deepest < 0) return 0;
  const depth = Math.floor(Math.sqrt(deepest / ASCEND_DEPTH_PER_POINT));
  const bonus = priorAscensions >= 1 ? Math.max(0, Math.floor((level - ASCEND_LEVEL) / ASCEND_LEVEL_STEP)) : 0;
  return depth + bonus;
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

/** The most passive points the whole tree grants, summed from the table. */
export const MAX_ASCENDANCY_PASSIVE_POINTS: number = ASCENDANCY_NODES.reduce(
  (sum, node) => sum + node.effects.reduce((n, e) => n + (e.kind === 'passivePoints' ? e.value : 0), 0),
  0,
);

/** Whether `id` links to the start or to an allocated node, is not itself allocated, and the player can afford it. */
export function canAllocateAscendancy(state: Pick<GameState, 'ascendancy'>, id: string): boolean {
  const node = ASCENDANCY_NODE_BY_ID.get(id);
  if (node === undefined || id === ASCENDANCY_START_ID || state.ascendancy.allocated.includes(id)) return false;
  if (state.ascendancy.points < node.cost) return false;
  return node.links.some((l) => l === ASCENDANCY_START_ID || state.ascendancy.allocated.includes(l));
}

/** Allocates a node for its cost in points. The start is free and never enters the allocated list. */
export function allocateAscendancy(
  state: GameState,
  id: string,
): 'ok' | 'noPoints' | 'notAdjacent' | 'allocated' | 'invalid' {
  const node = ASCENDANCY_NODE_BY_ID.get(id);
  if (node === undefined || id === ASCENDANCY_START_ID) return 'invalid';
  if (state.ascendancy.allocated.includes(id)) return 'allocated';
  const adjacent = node.links.some((l) => l === ASCENDANCY_START_ID || state.ascendancy.allocated.includes(l));
  if (!adjacent) return 'notAdjacent';
  if (state.ascendancy.points < node.cost) return 'noPoints';
  state.ascendancy.allocated.push(id);
  state.ascendancy.points -= node.cost;
  return 'ok';
}
