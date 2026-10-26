import { ESSENCE_BAG_STACK, GEM_BAG_STACK, MATERIAL_BAG_STACK, RUNE_BAG_STACK } from './balance';
import { ascendancyTotals } from './ascendancy';
import type { StatKey } from './items';
import type { GameState } from './types';

export type PassiveKind = 'small' | 'notable' | 'keystone' | 'start';
export type PassiveSide = 'mining' | 'battle' | 'hybrid' | 'start';
export type KeystoneId =
  | 'earthshaker' | 'cartographer' | 'prospectorsLuck' | 'berserker'
  | 'soulReaper' | 'bulwark' | 'deepPockets' | 'twoWayStreet'
  | 'oreBaron' | 'allOrNothing' | 'deepBreath' | 'bloodMoney' | 'soulDebt' | 'prospectorsEye';

/** What a node grants: a stat, a rule change (keystone), or a structural bonus. */
export type PassiveEffect =
  | { kind: 'stat'; stat: StatKey; value: number }
  | { kind: 'keystone'; id: KeystoneId }
  | { kind: 'gemStack'; value: number }
  | { kind: 'materialStack'; value: number }
  | { kind: 'stashPages'; value: number }
  | { kind: 'autoMap' };

export interface PassiveNode {
  id: string;
  name: string;
  kind: PassiveKind;
  side: PassiveSide;
  x: number;
  y: number;
  links: string[];
  effects: PassiveEffect[];
  desc: string;
}

export const START_NODE_ID = 'miner';

const stat = (stat: StatKey, value: number): PassiveEffect => ({ kind: 'stat', stat, value });
const keystone = (id: KeystoneId): PassiveEffect => ({ kind: 'keystone', id });

interface NamedSpec {
  id: string;
  name: string;
  kind: PassiveKind;
  effects: PassiveEffect[];
  desc: string;
}

const n = (id: string, name: string, kind: PassiveKind, effects: PassiveEffect[], desc: string): NamedSpec =>
  ({ id, name, kind, effects, desc });

// The named nodes: keystones change a rule (with a downside), notables are a named bonus, and the small nodes below
// are the bulk of the web's +stat budget. Values are whole numbers or whole percents, one point each.
const earthshaker = n('earthshaker', 'Earthshaker', 'keystone', [keystone('earthshaker')],
  'Clicks dig three times as much, but the miner digs a third slower on its own.');
const cartographer = n('cartographer', 'Cartographer', 'keystone', [keystone('cartographer')],
  'Maps are found one tier higher.');
const prospectorsLuck = n('prospectorsLuck', "Prospector's Luck", 'keystone', [keystone('prospectorsLuck')],
  '+50% Diamonds, −20% Gold.');
const berserker = n('berserker', 'Berserker', 'keystone', [keystone('berserker')],
  '+50% damage, but no armor.');
const soulReaper = n('soulReaper', 'Soul Reaper', 'keystone', [keystone('soulReaper')],
  'Kills give double Souls, −20% life.');
const bulwark = n('bulwark', 'Bulwark', 'keystone', [keystone('bulwark')],
  'Armor ×2, −25% damage.');
const deepPockets = n('deepPockets', 'Deep Pockets', 'keystone', [{ kind: 'stashPages', value: 2 }],
  'Two more General stash pages, for nothing.');
const twoWayStreet = n('twoWayStreet', 'Two-Way Street', 'keystone', [keystone('twoWayStreet')],
  '+15% dig power, +15% damage, −10% life.');
const oreBaron = n('oreBaron', 'Ore Baron', 'keystone', [keystone('oreBaron')],
  '+100% ore find, −50% Gold from gold veins.');
const allOrNothing = n('allOrNothing', 'All or Nothing', 'keystone', [keystone('allOrNothing')],
  'Critical hits ×3, non-critical hits −40%.');
const deepBreath = n('deepBreath', 'Deep Breath', 'keystone', [keystone('deepBreath')],
  '×3 offline cap, −25% active dig power.');
const bloodMoney = n('bloodMoney', 'Blood Money', 'keystone', [keystone('bloodMoney')],
  '+100% Gold from kills, take +25% damage.');
const soulDebt = n('soulDebt', 'Soul Debt', 'keystone', [keystone('soulDebt')],
  'Soul upgrades 25% cheaper, deaths cost 10% of current Souls.');
const prospectorsEye = n('prospectorsEye', "Prospector's Eye", 'keystone', [keystone('prospectorsEye')],
  '+100% chest find, maps found one tier lower.');

const veinSense = n('veinSense', 'Vein Sense', 'notable', [stat('chestFind', 15)], '+15% chest find.');
const prospector = n('prospector', 'Prospector', 'notable', [stat('diamondYield', 20)], '+20% Diamonds.');
const deepLungs = n('deepLungs', 'Deep Lungs', 'notable', [stat('offlineCap', 120)], '+2 h offline cap.');
const oreSniffer = n('oreSniffer', 'Ore Sniffer', 'notable', [stat('oreFind', 20)], '+20% ore find.');
const steadyHands = n('steadyHands', 'Steady Hands', 'notable', [stat('ticksPerClick', 1)], '+1 tick per click.');
const thickSkin = n('thickSkin', 'Thick Skin', 'notable', [stat('lifePct', 15)], '+15% life.');
const sharpened = n('sharpened', 'Sharpened', 'notable', [stat('damagePct', 15)], '+15% damage.');
const deadlyAim = n('deadlyAim', 'Deadly Aim', 'notable', [stat('critChance', 5)], '+5% crit chance.');
const soulWarden = n('soulWarden', 'Soul Warden', 'notable', [stat('soulFind', 15)], '+15% Soul find.');
const treasureHunter = n('treasureHunter', 'Treasure Hunter', 'notable', [stat('magicFind', 15)], '+15% magic find.');
const lampAndBlade = n('lampAndBlade', 'Lamp & Blade', 'notable', [stat('ticksPerClick', 1), stat('autoTickRate', 50)],
  '+1 tick per click, +0.5 auto ticks per second.');
const wellRested = n('wellRested', 'Well-Rested', 'notable', [stat('offlineCap', 60), stat('lifePct', 10)],
  '+1 h offline cap, +10% life.');
const sureFooting = n('sureFooting', 'Sure Footing', 'notable', [stat('digPowerPct', 8), stat('armor', 10)],
  '+8% dig power, +10 armor.');
const careful = n('careful', 'Careful', 'notable', [stat('hazardWard', 15), stat('armor', 10)],
  '+15 hazard ward, +10 armor.');
const gemPouch = n('gemPouch', 'Gem Pouch', 'notable', [{ kind: 'gemStack', value: 10 }],
  'Gems stack 10 higher in the bag.');
const oreCart = n('oreCart', 'Ore Cart', 'notable', [{ kind: 'materialStack', value: 25 }],
  'Materials stack 25 higher in the bag.');
const surveyor = n('surveyor', 'Surveyor', 'notable', [{ kind: 'autoMap' }],
  'Auto-mapping: queue maps to run themselves while you are away.');
const deepMiner = n('deepMiner', 'Deep Miner', 'notable', [stat('digPowerPct', 10), stat('oreFind', 5)],
  '+10% dig power, +5% ore find.');
const reckoner = n('reckoner', 'Reckoner', 'notable', [stat('critChance', 5), stat('critMultiplier', 10)],
  '+5% crit chance, +10% critical damage.');
const vanguard = n('vanguard', 'Vanguard', 'notable', [stat('lifePct', 10), stat('armor', 10)],
  '+10% life, +10 armor.');
const alchemist = n('alchemist', 'Alchemist', 'notable', [stat('goldYield', 10), stat('magicFind', 10)],
  '+10% Gold, +10% magic find.');
const nightowl = n('nightowl', 'Nightowl', 'notable', [stat('offlineCap', 30), stat('soulFind', 5)],
  '+30 min offline cap, +5% Soul find.');

// The small nodes' budget: [stat, value, count]. Mining totals 65, battle 65, hybrid 35 — 165 in all. The order is
// load-bearing: the builder numbers smalls from it, so miningSmall1..48, battleSmall1..48 and hybridSmall1..19 keep
// their stats forever; new smalls append below with fresh ids.
const SMALL_BUDGET: Record<Exclude<PassiveSide, 'start'>, ReadonlyArray<readonly [StatKey, number, number]>> = {
  mining: [
    ['digPower', 4, 8], ['digPowerPct', 6, 4], ['goldYield', 6, 4], ['diamondYield', 6, 4],
    ['veinYield', 4, 4], ['chestFind', 5, 4], ['gemFind', 5, 3], ['mapFind', 5, 3], ['oreFind', 5, 3],
    ['lampSight', 1, 2], ['autoTickRate', 4, 3], ['ticksPerClick', 0.5, 2], ['offlineCap', 30, 2], ['hazardWard', 8, 2],
    ['digPower', 4, 2], ['goldYield', 6, 2], ['diamondYield', 6, 2], ['chestFind', 5, 2], ['gemFind', 5, 2],
    ['mapFind', 5, 2], ['oreFind', 5, 2], ['veinYield', 4, 2], ['hazardWard', 8, 1],
  ],
  battle: [
    ['damage', 4, 6], ['damagePct', 6, 3], ['attackSpeed', 4, 3], ['critChance', 2, 4], ['critMultiplier', 6, 3],
    ['life', 20, 5], ['lifePct', 4, 3], ['armor', 20, 4], ['armorPct', 6, 3], ['resistAll', 4, 3],
    ['elementalDamage', 4, 2], ['lifeRegen', 1, 2], ['lifeOnKill', 3, 1], ['soulFind', 5, 3], ['magicFind', 5, 2], ['xpFind', 5, 1],
    ['damage', 4, 2], ['life', 20, 2], ['armor', 20, 2], ['attackSpeed', 4, 2], ['critChance', 2, 2],
    ['critMultiplier', 6, 2], ['soulFind', 5, 2], ['magicFind', 5, 2], ['resistAll', 4, 1],
  ],
  hybrid: [
    ['digPower', 3, 3], ['damage', 3, 3], ['life', 10, 4], ['goldYield', 4, 3], ['soulFind', 3, 3], ['magicFind', 3, 3],
    ['digPower', 3, 2], ['damage', 3, 2], ['life', 10, 3], ['goldYield', 4, 2], ['soulFind', 3, 2],
    ['magicFind', 3, 2], ['chestFind', 5, 2], ['lifePct', 4, 1],
  ],
};

// A short name for a small node, so the search box finds it by name as well as by its effect line.
const SMALL_NAMES: Record<string, string> = {
  digPower: 'Dig Power', digPowerPct: 'Dig Power', goldYield: 'Gold Yield', diamondYield: 'Diamond Yield',
  veinYield: 'Vein Yield', chestFind: 'Chest Find', gemFind: 'Gem Find', mapFind: 'Map Find', oreFind: 'Ore Find',
  lampSight: 'Lamp Sight', autoTickRate: 'Auto Tick Rate', ticksPerClick: 'Ticks per Click', offlineCap: 'Offline Cap',
  hazardWard: 'Hazard Ward', damage: 'Damage', damagePct: 'Damage', attackSpeed: 'Attack Speed', critChance: 'Crit Chance',
  critMultiplier: 'Critical Damage', life: 'Life', lifePct: 'Life', armor: 'Armor', armorPct: 'Armor', resistAll: 'All Resistances',
  elementalDamage: 'Elemental Damage', lifeRegen: 'Life per Second', lifeOnKill: 'Life per Kill', soulFind: 'Soul Find',
  magicFind: 'Magic Find', xpFind: 'XP',
};

// ── The world and its spacing constants ──────────────────────────────────────────────────────────────
// The web lives in a 2400 × 2000 world centred on the miner. The gaps below are the decluttered spacing the web is
// tuned to: adjacent smalls sit at least two icon widths apart, majors stand well clear of each other, and clusters
// keep their own breathing room. They are pinned by the geometry tests, so changing them changes the web.
export const START_X = 1200;
export const START_Y = 1000;
export const WORLD_W = 2400;
export const WORLD_H = 2000;
export const SMALL_GAP = 92;
export const MAJOR_GAP = 280;
export const CLUSTER_GAP = 120;
export const MAX_RADIUS = 1100;

// The web's geometry: a hand-authored cluster table. The start sits at the centre; each side's clusters group a chain
// of smalls behind a terminal notable or keystone. A cluster's first small links from its `entry` (the start or an
// earlier cluster's terminal), its smalls arc along the quadratic Bézier from the entry through its `bend` control
// point to the terminal, and its terminal links only to its own last small. `cross` names neighbour clusters whose
// first small this cluster's first small also cross-links to, weaving the mesh at the minor level (never major↔major).
interface ClusterDef {
  side: Exclude<PassiveSide, 'start'>;
  /** The terminal's place. */
  x: number;
  y: number;
  /** The Bézier control point the smalls arc through on the way from the entry to the terminal. */
  bendX: number;
  bendY: number;
  /** How many smalls this cluster draws from its side's budget, in order. */
  count: number;
  terminal: NamedSpec;
  /** Where the cluster's first small links from: the start, or another cluster's terminal id. */
  entry: string;
  /** Neighbour clusters (by terminal id) whose first small this cluster's first small cross-links to. */
  cross: string[];
}

const cluster = (
  side: Exclude<PassiveSide, 'start'>, x: number, y: number, bendX: number, bendY: number, count: number,
  terminal: NamedSpec, entry: string, cross: string[],
): ClusterDef => ({ side, x, y, bendX, bendY, count, terminal, entry, cross });

// 36 scattered cluster centres across the three side wedges (battle right, mining left, hybrid top). Angles and radii
// are jittered from the old 12-spoke × 3-ring grid, then nudged so majors stay ≥ MAJOR_GAP apart and every cluster
// sits within MAX_RADIUS of the start. The bend control point pushes each chain into a gentle arc.
const CLUSTERS: ClusterDef[] = [
  // ── battle (right) ──────────────────────────────────────────────────────────────────────────────
  cluster('battle', 1936, 1313, 2025, 908, 6, thickSkin, 'sharpened', ['sharpened']),
  cluster('battle', 1617, 831, 1229, 473, 6, sharpened, START_NODE_ID, ['treasureHunter']),
  cluster('battle', 1385, 1482, 1558, 1177, 6, treasureHunter, 'sharpened', ['vanguard']),
  cluster('battle', 2025, 1043, 2035, 524, 6, vanguard, 'sharpened', ['thickSkin']),
  cluster('battle', 1720, 1730, 2092, 1658, 5, deadlyAim, 'thickSkin', ['soulWarden']),
  cluster('battle', 1667, 1451, 1851, 1124, 6, soulWarden, 'sharpened', ['reckoner']),
  cluster('battle', 1475, 1958, 1700, 1669, 5, reckoner, 'treasureHunter', ['soulReaper']),
  cluster('battle', 2133, 565, 2338, 863, 5, soulReaper, 'vanguard', ['deadlyAim']),
  cluster('battle', 2260, 1206, 2032, 1511, 5, berserker, 'deadlyAim', ['allOrNothing']),
  cluster('battle', 2003, 1723, 1616, 1858, 5, allOrNothing, 'soulWarden', ['bloodMoney']),
  cluster('battle', 2246, 834, 1910, 1430, 5, bloodMoney, 'reckoner', ['bulwark']),
  cluster('battle', 2162, 1490, 2207, 1026, 5, bulwark, 'soulReaper', ['berserker']),
  // ── mining (left) ──────────────────────────────────────────────────────────────────────────────
  cluster('mining', 661, 515, 245, 832, 6, veinSense, 'prospector', ['prospector']),
  cluster('mining', 752, 961, 935, 1457, 6, prospector, START_NODE_ID, ['steadyHands']),
  cluster('mining', 470, 1310, 238, 834, 6, steadyHands, 'prospector', ['prospectorsEye']),
  cluster('mining', 348, 547, 337, 961, 6, prospectorsEye, 'prospector', ['veinSense']),
  cluster('mining', 640, 1580, 591, 1046, 6, deepLungs, 'veinSense', ['oreSniffer']),
  cluster('mining', 849, 1390, 470, 1250, 5, oreSniffer, 'prospector', ['deepMiner']),
  cluster('mining', 300, 1030, -8, 1409, 5, deepMiner, 'steadyHands', ['deepBreath']),
  cluster('mining', 190, 1330, 210, 927, 5, deepBreath, 'prospectorsEye', ['deepLungs']),
  cluster('mining', 140, 770, 339, 1207, 5, earthshaker, 'deepLungs', ['oreBaron']),
  cluster('mining', 517, 804, 631, 1127, 5, oreBaron, 'oreSniffer', ['cartographer']),
  cluster('mining', 330, 1609, 255, 1323, 5, cartographer, 'deepMiner', ['prospectorsLuck']),
  cluster('mining', 506, 1827, 297, 1611, 5, prospectorsLuck, 'deepBreath', ['earthshaker']),
  // ── hybrid (top) ──────────────────────────────────────────────────────────────────────────────
  cluster('hybrid', 1160, 300, 1019, 442, 3, lampAndBlade, 'sureFooting', ['sureFooting']),
  cluster('hybrid', 984, 640, 1041, 851, 3, sureFooting, START_NODE_ID, ['alchemist']),
  cluster('hybrid', 1380, 531, 1166, 528, 3, alchemist, 'sureFooting', ['nightowl']),
  cluster('hybrid', 1695, 538, 1331, 530, 3, nightowl, 'sureFooting', ['lampAndBlade']),
  cluster('hybrid', 1929, 366, 1550, 273, 3, wellRested, 'lampAndBlade', ['careful']),
  cluster('hybrid', 1522, 277, 1219, 409, 3, careful, 'sureFooting', ['gemPouch']),
  cluster('hybrid', 859, 301, 1144, 361, 3, gemPouch, 'alchemist', ['oreCart']),
  cluster('hybrid', 1323, 40, 1557, 253, 3, oreCart, 'nightowl', ['wellRested']),
  cluster('hybrid', 1740, 65, 1938, 150, 3, deepPockets, 'wellRested', ['twoWayStreet']),
  cluster('hybrid', 660, 65, 1105, 113, 3, twoWayStreet, 'careful', ['soulDebt']),
  cluster('hybrid', 979, 40, 701, 70, 3, soulDebt, 'gemPouch', ['surveyor']),
  cluster('hybrid', 423, 250, 859, 87, 2, surveyor, 'oreCart', ['deepPockets']),
];

interface Placed {
  id: string;
  name: string;
  kind: PassiveKind;
  side: Exclude<PassiveSide, 'start'>;
  effects: PassiveEffect[];
  desc: string;
  x: number;
  y: number;
  links: string[];
}

function expandSmall(side: Exclude<PassiveSide, 'start'>): { stat: StatKey; value: number }[] {
  const out: { stat: StatKey; value: number }[] = [];
  for (const [stat, value, count] of SMALL_BUDGET[side]) for (let i = 0; i < count; i++) out.push({ stat, value });
  return out;
}

// A point on the quadratic Bézier from `p0` through `p1` to `p2`.
const bezier = (p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, t: number): { x: number; y: number } => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
};

// The point at the given arc-length fraction along a quadratic Bézier, by sampling the curve finely.
const bezierAtArc = (
  p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, frac: number,
): { x: number; y: number } => {
  const SAMPLES = 128;
  const pts: { x: number; y: number }[] = [p0];
  const arc: number[] = [0];
  let prev = p0;
  let cum = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const cur = bezier(p0, p1, p2, i / SAMPLES);
    cum += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    arc.push(cum);
    pts.push(cur);
    prev = cur;
  }
  const target = frac * (arc[SAMPLES] ?? 0);
  for (let i = 0; i < SAMPLES; i++) {
    const end = arc[i + 1];
    if (end === undefined || end < target) continue;
    const a = pts[i];
    const b = pts[i + 1];
    if (a === undefined || b === undefined) continue;
    const start = arc[i] ?? 0;
    const seg = end - start;
    const f = seg === 0 ? 0 : (target - start) / seg;
    return { x: Math.round(a.x + (b.x - a.x) * f), y: Math.round(a.y + (b.y - a.y) * f) };
  }
  return pts[SAMPLES] ?? p2;
};

function buildWeb(): PassiveNode[] {
  const smalls: Record<Exclude<PassiveSide, 'start'>, { stat: StatKey; value: number }[]> = {
    mining: expandSmall('mining'), battle: expandSmall('battle'), hybrid: expandSmall('hybrid'),
  };
  const smallCursor: Record<Exclude<PassiveSide, 'start'>, number> = { mining: 0, battle: 0, hybrid: 0 };
  const placed: Placed[] = [];

  // Every terminal's place is known up front, so a cluster's smalls can arc from its entry to here.
  const terminalAt = new Map<string, { x: number; y: number }>();
  terminalAt.set(START_NODE_ID, { x: START_X, y: START_Y });
  for (const c of CLUSTERS) terminalAt.set(c.terminal.id, { x: c.x, y: c.y });

  const takeSmall = (side: Exclude<PassiveSide, 'start'>): { stat: StatKey; value: number } => {
    const s = smalls[side][smallCursor[side]];
    if (s === undefined) throw new Error('small budget exhausted');
    smallCursor[side]++;
    return s;
  };

  // A link between two placed nodes is added both ways; a guard refuses a link that would join two majors.
  const linkTo = (a: Placed, b: Placed): void => {
    const major = (p: Placed): boolean => p.kind === 'notable' || p.kind === 'keystone';
    if (major(a) && major(b)) throw new Error(`major↔major link ${a.id} → ${b.id}`);
    if (!a.links.includes(b.id)) a.links.push(b.id);
    if (!b.links.includes(a.id)) b.links.push(a.id);
  };

  // Place each cluster's smalls (arc-length steps along the Bézier), then its terminal. The small ids fall out of the
  // cluster order, which is load-bearing: it is what keeps every pre-existing id pointing at the same stat.
  const smallIds = new Map<string, string[]>();   // terminal id → the cluster's small ids, in chain order
  const startLinks: string[] = [];

  for (const c of CLUSTERS) {
    const entry = terminalAt.get(c.entry);
    if (entry === undefined) throw new Error(`unknown cluster entry ${c.entry}`);
    const ids: string[] = [];
    for (let i = 0; i < c.count; i++) {
      const s = takeSmall(c.side);
      const id = `${c.side}Small${smallCursor[c.side]}`;
      const p = bezierAtArc(entry, { x: c.bendX, y: c.bendY }, { x: c.x, y: c.y }, (i + 1) / (c.count + 1));
      placed.push({
        id, name: SMALL_NAMES[s.stat] ?? s.stat, kind: 'small', side: c.side,
        effects: [{ kind: 'stat', stat: s.stat, value: s.value }], desc: '',
        x: p.x, y: p.y, links: [],
      });
      ids.push(id);
    }
    smallIds.set(c.terminal.id, ids);
    if (c.entry === START_NODE_ID && ids[0] !== undefined) startLinks.push(ids[0]);
    // The terminal ends its own chain and links to nothing else yet.
    placed.push({
      id: c.terminal.id, name: c.terminal.name, kind: c.terminal.kind, side: c.side,
      effects: c.terminal.effects, desc: c.terminal.desc, x: c.x, y: c.y, links: [],
    });
  }

  const byId = new Map<string, Placed>();
  for (const p of placed) byId.set(p.id, p);
  const must = (id: string): Placed => {
    const p = byId.get(id);
    if (p === undefined) throw new Error(`missing placed node ${id}`);
    return p;
  };

  // Wire the chains and the entries. A terminal links only to its own last small; a first small links from its entry
  // (the start, or another cluster's terminal) and on to its own second small.
  for (const c of CLUSTERS) {
    const ids = smallIds.get(c.terminal.id) ?? [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined) continue;
      const node = must(id);
      if (i === 0) {
        // The first small links from its entry: the start (a one-way edge the start mirrors via startLinks) or a
        // terminal of another cluster (a both-ways edge).
        if (c.entry === START_NODE_ID) node.links.push(START_NODE_ID);
        else linkTo(node, must(c.entry));
      } else {
        const prev = ids[i - 1];
        if (prev !== undefined) linkTo(node, must(prev));
      }
    }
    const terminal = must(c.terminal.id);
    const last = ids[ids.length - 1];
    if (last !== undefined) linkTo(terminal, must(last));
  }

  // The mesh's cycles: this cluster's first small cross-links to each named neighbour's first small (minor↔minor).
  for (const c of CLUSTERS) {
    const mine = smallIds.get(c.terminal.id);
    const myFirst = mine?.[0];
    if (myFirst === undefined) continue;
    for (const target of c.cross) {
      const theirs = smallIds.get(target);
      const theirFirst = theirs?.[0];
      if (theirFirst === undefined) continue;
      linkTo(must(myFirst), must(theirFirst));
    }
  }

  const start: PassiveNode = {
    id: START_NODE_ID, name: 'Miner', kind: 'start', side: 'start',
    x: START_X, y: START_Y, links: startLinks, effects: [], desc: 'Start',
  };
  return [start, ...placed.map(({ id, name, kind, side, effects, desc, x, y, links }) =>
    ({ id, name, kind, side, effects, desc, x, y, links }))];
}

export const PASSIVE_NODES: readonly PassiveNode[] = buildWeb();

export const PASSIVE_NODE_BY_ID: ReadonlyMap<string, PassiveNode> = new Map(PASSIVE_NODES.map((n) => [n.id, n]));

/** The unspent points: one per level past the first, plus the ascendancy tree's, minus what is already allocated. */
export function pointsToSpend(state: Pick<GameState, 'level' | 'passives' | 'ascendancy'>): number {
  return Math.max(0, state.level - 1 - state.passives.allocated.length + ascendancyTotals(state).passivePoints);
}

/** Whether `id` links to the start or to an allocated node (and is not itself allocated). */
export function canAllocate(state: Pick<GameState, 'passives'>, id: string): boolean {
  const node = PASSIVE_NODE_BY_ID.get(id);
  if (node === undefined || state.passives.allocated.includes(id)) return false;
  return node.links.some((l) => l === START_NODE_ID || state.passives.allocated.includes(l));
}

/** Whether every allocated node reaches the start over links that stay inside { start } ∪ allocated. */
export function isConnectedWeb(allocated: readonly string[]): boolean {
  const alloc = new Set(allocated);
  const seen = new Set<string>([START_NODE_ID]);
  const queue = [START_NODE_ID];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node === undefined) return false;
    for (const l of node.links) {
      if (seen.has(l) || (l !== START_NODE_ID && !alloc.has(l))) continue;
      seen.add(l);
      queue.push(l);
    }
  }
  return [...alloc].every((id) => seen.has(id));
}

/** Whether removing `id` leaves every remaining node still connected to the start. */
export function canRefund(state: Pick<GameState, 'passives'>, id: string): boolean {
  if (!state.passives.allocated.includes(id)) return false;
  return isConnectedWeb(state.passives.allocated.filter((n) => n !== id));
}

export interface PassiveTotals {
  stats: Record<StatKey, number>;
  gemStack: number;
  materialStack: number;
  stashPages: number;
  keystones: Set<KeystoneId>;
  autoMap: boolean;
}

/** The allocated nodes' effects, summed: stat effects into `stats`, the structural bonuses, the keystones set. */
export function passiveTotals(state: Pick<GameState, 'passives'>): PassiveTotals {
  const totals: PassiveTotals = {
    stats: {} as Record<StatKey, number>, gemStack: 0, materialStack: 0, stashPages: 0, keystones: new Set(),
    autoMap: false,
  };
  for (const id of state.passives.allocated) {
    const node = PASSIVE_NODE_BY_ID.get(id);
    if (node === undefined) continue;
    for (const effect of node.effects) {
      switch (effect.kind) {
        case 'stat': totals.stats[effect.stat] = (totals.stats[effect.stat] ?? 0) + effect.value; break;
        case 'keystone': totals.keystones.add(effect.id); break;
        case 'gemStack': totals.gemStack += effect.value; break;
        case 'materialStack': totals.materialStack += effect.value; break;
        case 'stashPages': totals.stashPages += effect.value; break;
        case 'autoMap': totals.autoMap = true; break;
      }
    }
  }
  return totals;
}

/** Whether a keystone is allocated (its node is). */
export function hasKeystone(state: Pick<GameState, 'passives'>, id: KeystoneId): boolean {
  return passiveTotals(state).keystones.has(id);
}

/** What a bag cell holds of a gem, rune, material, essence or orb stack; gems and materials rise with the web. */
export function stackCaps(state: Pick<GameState, 'passives'>): { gem: number; rune: number; material: number; essence: number; orb: number } {
  const p = passiveTotals(state);
  return {
    gem: GEM_BAG_STACK + p.gemStack, material: MATERIAL_BAG_STACK + p.materialStack,
    rune: RUNE_BAG_STACK, essence: ESSENCE_BAG_STACK, orb: ESSENCE_BAG_STACK,
  };
}

/** The free General pages the web grants (Deep Pockets), on top of the free and bought pages. */
export function freeStashPages(state: Pick<GameState, 'passives'>): number {
  return passiveTotals(state).stashPages;
}
