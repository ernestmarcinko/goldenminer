import {
  ASCENDANCY_BIG_COST, ASCENDANCY_MID_COST, ASCENDANCY_SMALL_COST,
  ASCEND_DEPTH_PER_POINT, ASCEND_LEVEL, ASCEND_LEVEL_STEP,
} from './balance';
import type { StatKey } from './items';
import type { GameState } from './types';

export type AscendancyKind = 'small' | 'mid' | 'big' | 'start';
/** What a node grants: a stat, a starting depth, a passive point, or a map tier / queue the auto-mapping reaches. */
export type AscendancyEffect =
  | { kind: 'stat'; stat: StatKey; value: number }
  | { kind: 'startingDepth'; value: number }
  | { kind: 'passivePoints'; value: number }
  | { kind: 'autoMapQueue'; value: number };

/** The eight ascendancy clusters; each small node's icon is its group's base glyph at a slot tier. */
export type AscendancyGroupId =
  | 'wealth' | 'depth' | 'insight' | 'cartography' | 'endurance' | 'fortuna' | 'might' | 'greed';

/** The eight clusters in radial order; used to register every group glyph variation. */
export const ASCENDANCY_GROUPS: readonly AscendancyGroupId[] = [
  'wealth', 'depth', 'insight', 'cartography', 'endurance', 'fortuna', 'might', 'greed',
];

export interface AscendancyNode {
  id: string;
  name: string;
  kind: AscendancyKind;
  /** The points the node costs to allocate: small 1, mid 6, big 12, start 0 (free). The cost is code, never saved. */
  cost: number;
  x: number;
  y: number;
  links: string[];
  effects: AscendancyEffect[];
  desc: string;
  /** The cluster this node belongs to; unset for the start. A small's icon is the group glyph at its `variation`. */
  group?: AscendancyGroupId;
  /** For a small node, its 1-based slot count within the cluster (1–8). Unset for the start, mids and bigs. */
  variation?: number;
}

export const ASCENDANCY_START_ID = 'minerReborn';

const stat = (stat: StatKey, value: number): AscendancyEffect => ({ kind: 'stat', stat, value });
const startingDepth = (value: number): AscendancyEffect => ({ kind: 'startingDepth', value });
const passivePoints = (value: number): AscendancyEffect => ({ kind: 'passivePoints', value });
const autoMapQueue = (value: number): AscendancyEffect => ({ kind: 'autoMapQueue', value });
// A "find" node grants chest, gem and map find together.
const find = (value: number): AscendancyEffect[] => [
  stat('chestFind', value), stat('gemFind', value), stat('mapFind', value),
];

interface NamedSpec { id: string; name: string; effects: AscendancyEffect[]; desc: string }
const n = (id: string, name: string, effects: AscendancyEffect[], desc: string): NamedSpec => ({ id, name, effects, desc });

interface SmallSpec { name: string; effects: AscendancyEffect[] }
const s = (name: string, effects: AscendancyEffect[]): SmallSpec => ({ name, effects });

interface ClusterDef {
  prefix: AscendancyGroupId;
  angle: number;
  smalls: SmallSpec[];
  mid: NamedSpec;
  big: NamedSpec;
  /**
   * For the six clusters that predate the expansion, how many leading smalls existed before (so their ids — and the
   * mid's link to the last of them — stay stable, keeping old saves connected). New clusters have none.
   */
  legacySmalls?: number;
  /**
   * How many leading smalls sit before the mid, so the mid lands mid-branch (ring midAfter + 1) and the rest trail it
   * to the big. Defaults to 4, so a branch reads small ×4 → mid → small ×4 → big.
   */
  midAfter?: number;
}

// Eight radial clusters, each a branch of smalls (1 point each) with a mid (6 points) sat mid-branch and a big
// (12 points) as the terminal keystone. The smalls are whole percents or whole numbers; the mid is the old "notable",
// the big the keystone-grade permanent bonus.
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
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
      s('Auto-map Queue', [autoMapQueue(10)]),
    ],
    mid: n('masterSurveyor', 'Master Surveyor', [autoMapQueue(20)], '+20 auto-map queue.'),
    big: n('worldAtlas', 'World Atlas', [autoMapQueue(50)], '+50 auto-map queue.'),
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
  group: AscendancyGroupId;
  variation?: number;
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
    const midAfter = cluster.midAfter ?? 4;
    let previous = ASCENDANCY_START_ID;
    // The mid also links back to the last pre-expansion small so an old save's chain stays connected to the start.
    const legacyLastId = cluster.legacySmalls !== undefined ? `${cluster.prefix}Small${cluster.legacySmalls}` : undefined;
    cluster.smalls.forEach((small, i) => {
      const id = `${cluster.prefix}Small${i + 1}`;
      // The first `midAfter` smalls lead the branch; the rest trail the mid, shifted out one ring by it.
      const ring = i < midAfter ? i + 1 : i + 2;
      placed.push({
        id, name: small.name, kind: 'small', cost: ASCENDANCY_SMALL_COST, effects: small.effects, desc: '',
        x: pointX(cluster.angle, ring), y: pointY(cluster.angle, ring), links: [previous], ring,
        group: cluster.prefix, variation: i + 1,
      });
      previous = id;
      if (i === midAfter - 1) {
        // The mid sits mid-branch: linked from the last leading small, and back to the legacy small if it differs.
        const midLinks = [id];
        if (legacyLastId !== undefined && legacyLastId !== id) midLinks.push(legacyLastId);
        placed.push({
          id: cluster.mid.id, name: cluster.mid.name, kind: 'mid', cost: ASCENDANCY_MID_COST,
          effects: cluster.mid.effects, desc: cluster.mid.desc,
          x: pointX(cluster.angle, midAfter + 1), y: pointY(cluster.angle, midAfter + 1),
          links: midLinks, ring: midAfter + 1,
          group: cluster.prefix,
        });
        previous = cluster.mid.id;
      }
    });
    placed.push({
      id: cluster.big.id, name: cluster.big.name, kind: 'big', cost: ASCENDANCY_BIG_COST,
      effects: cluster.big.effects, desc: cluster.big.desc,
      x: pointX(cluster.angle, cluster.smalls.length + 2), y: pointY(cluster.angle, cluster.smalls.length + 2),
      links: [previous], ring: cluster.smalls.length + 2,
      group: cluster.prefix,
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
  return [start, ...placed.map(({ id, name, kind, cost, effects, desc, x, y, links, group, variation }) =>
    ({ id, name, kind, cost, x, y, links, effects, desc, group, variation }))];
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
  autoMapQueue: number;
}

/** The allocated nodes' effects, summed: stats into `stats`, the structural bonuses on their own. */
export function ascendancyTotals(state: Pick<GameState, 'ascendancy'>): AscendancyTotals {
  const totals: AscendancyTotals = {
    stats: {} as Record<StatKey, number>, startingDepth: 0, passivePoints: 0, autoMapQueue: 0,
  };
  for (const id of state.ascendancy.allocated) {
    const node = ASCENDANCY_NODE_BY_ID.get(id);
    if (node === undefined) continue;
    for (const effect of node.effects) {
      switch (effect.kind) {
        case 'stat': totals.stats[effect.stat] = (totals.stats[effect.stat] ?? 0) + effect.value; break;
        case 'startingDepth': totals.startingDepth += effect.value; break;
        case 'passivePoints': totals.passivePoints += effect.value; break;
        case 'autoMapQueue': totals.autoMapQueue += effect.value; break;
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
