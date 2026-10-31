import { GEM_BAG_STACK, MATERIAL_BAG_STACK, ORB_BAG_STACK, RUNE_BAG_STACK } from './balance';
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
  'Auto-mapping: queue maps to run back-to-back on their own.');
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
    ['critMultiplier', 6, 2], ['soulFind', 5, 2], ['magicFind', 5, 2], ['maxResist', 5, 1],
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
  maxResist: 'Maximum Resistances',
  elementalDamage: 'Elemental Damage', lifeRegen: 'Life per Second', lifeOnKill: 'Life per Kill', soulFind: 'Soul Find',
  magicFind: 'Magic Find', xpFind: 'XP',
};

// ── The world and its spacing constants ──────────────────────────────────────────────────────────────
// The web lives in a 3200 × 2600 world centred on the miner. The gaps below are the decluttered spacing the web is
// tuned to: adjacent smalls sit at least two icon widths apart, majors stand well clear of each other, and every node
// stays inside MAX_RADIUS of the start. They are pinned by the geometry tests, so changing them changes the web.
export const START_X = 1600;
export const START_Y = 1300;
export const WORLD_W = 3200;
export const WORLD_H = 2600;
export const SMALL_GAP = 92;
export const MAJOR_GAP = 280;
export const CLUSTER_GAP = 120;
export const MAX_RADIUS = 1500;

// The web's geometry is generated, not hand-placed: each side fans out from the start as a radial tree. The hybrid
// side's short chains form the inner ring of roots (their first small links straight to the start); the battle and
// mining sides' longer chains are the outer leaves, each branching off the root nearest its angle. A short relaxation
// then pushes the majors apart before the smalls are spaced along the straight entry → terminal rays, so the mesh is
// planar — no crossing edges, no overlapping nodes.
interface ClusterMeta {
  side: Exclude<PassiveSide, 'start'>;
  /** How many smalls this cluster draws from its side's budget, in order. */
  count: number;
  terminal: NamedSpec;
}

const cluster = (
  side: Exclude<PassiveSide, 'start'>, count: number, terminal: NamedSpec,
): ClusterMeta => ({ side, count, terminal });

const CLUSTERS: readonly ClusterMeta[] = [
  // ── battle (right) ──────────────────────────────────────────────────────────────────────────────
  cluster('battle', 6, thickSkin),
  cluster('battle', 6, sharpened),
  cluster('battle', 6, treasureHunter),
  cluster('battle', 6, vanguard),
  cluster('battle', 5, deadlyAim),
  cluster('battle', 6, soulWarden),
  cluster('battle', 5, reckoner),
  cluster('battle', 5, soulReaper),
  cluster('battle', 5, berserker),
  cluster('battle', 5, allOrNothing),
  cluster('battle', 5, bloodMoney),
  cluster('battle', 5, bulwark),
  // ── mining (left) ──────────────────────────────────────────────────────────────────────────────
  cluster('mining', 6, veinSense),
  cluster('mining', 6, prospector),
  cluster('mining', 6, steadyHands),
  cluster('mining', 6, prospectorsEye),
  cluster('mining', 6, deepLungs),
  cluster('mining', 5, oreSniffer),
  cluster('mining', 5, deepMiner),
  cluster('mining', 5, deepBreath),
  cluster('mining', 5, earthshaker),
  cluster('mining', 5, oreBaron),
  cluster('mining', 5, cartographer),
  cluster('mining', 5, prospectorsLuck),
  // ── hybrid (top / inner ring) ──────────────────────────────────────────────────────────────────
  cluster('hybrid', 3, lampAndBlade),
  cluster('hybrid', 3, sureFooting),
  cluster('hybrid', 3, alchemist),
  cluster('hybrid', 3, nightowl),
  cluster('hybrid', 3, wellRested),
  cluster('hybrid', 3, careful),
  cluster('hybrid', 3, gemPouch),
  cluster('hybrid', 3, oreCart),
  cluster('hybrid', 3, deepPockets),
  cluster('hybrid', 3, twoWayStreet),
  cluster('hybrid', 3, soulDebt),
  cluster('hybrid', 2, surveyor),
];

// Layout tuning, internal. The exported `SMALL_GAP` / `MAJOR_GAP` stay the test pins; these add a little breathing
// room so the relaxed web is never *exactly* at the limit.
const ROOT_RADIUS = 600;
const EDGE_PAD = 14;
const LAYOUT_MAJOR_GAP = MAJOR_GAP + 10;
const MIN_RADIUS = 300;
const RELAX_ITERATIONS = 6000;

interface TermPlacement {
  id: string;
  side: Exclude<PassiveSide, 'start'>;
  count: number;
  angle: number;
  x: number;
  y: number;
  root: boolean;
}

const polar = (deg: number, r: number): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return { x: START_X + Math.cos(a) * r, y: START_Y + Math.sin(a) * r };
};

const angleDiff = (a: number, b: number): number => {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

/** Initial terminal placement: hybrid clusters ring the start as roots; battle fans right, mining fans left. */
function initialTerminals(): TermPlacement[] {
  const out: TermPlacement[] = [];
  for (let i = 0; i < CLUSTERS.length; i++) {
    const c = CLUSTERS[i];
    if (c === undefined) continue;
    // sharpened and prospector were the start-connected battle/mining roots before the geometry rework, and old saves
    // may reach them straight from the start; keep them roots so a migrated allocation stays connected.
    const root = c.side === 'hybrid' || c.terminal.id === 'sharpened' || c.terminal.id === 'prospector';
    let angle: number;
    let radius: number;
    if (c.side === 'hybrid') {
      angle = -90 + (i - 24) * 30;
      radius = ROOT_RADIUS;
    } else if (c.side === 'battle') {
      angle = -85 + i * (170 / 11);
      radius = root
        ? SMALL_GAP * (c.count + 1) + EDGE_PAD
        : ROOT_RADIUS + SMALL_GAP * (c.count + 1) + EDGE_PAD;
    } else {
      angle = 95 + (i - 12) * (170 / 11);
      radius = root
        ? SMALL_GAP * (c.count + 1) + EDGE_PAD
        : ROOT_RADIUS + SMALL_GAP * (c.count + 1) + EDGE_PAD;
    }
    const p = polar(angle, radius);
    out.push({ id: c.terminal.id, side: c.side, count: c.count, angle, x: p.x, y: p.y, root });
  }
  return out;
}

/** Each outer cluster's entry is the root nearest its angle. */
function assignEntries(term: readonly TermPlacement[]): (number | null)[] {
  const entry: (number | null)[] = new Array(term.length).fill(null);
  for (let i = 0; i < term.length; i++) {
    const ti = term[i];
    if (ti === undefined || ti.root) continue;
    let best = -1;
    let bestScore = Infinity;
    for (let j = 0; j < term.length; j++) {
      const tj = term[j];
      if (tj === undefined || !tj.root) continue;
      const d = Math.abs(angleDiff(ti.angle, tj.angle));
      if (d < bestScore) {
        bestScore = d;
        best = j;
      }
    }
    entry[i] = best;
  }
  return entry;
}

/** Relax the terminals: majors push apart, and each outer cluster's edge stretches to fit its smalls. */
function relaxTerminals(term: TermPlacement[], entry: readonly (number | null)[]): void {
  const edgeLen = (i: number): number => {
    const t = term[i];
    if (t === undefined) throw new Error(`missing terminal ${i}`);
    return SMALL_GAP * (t.count + 1) + EDGE_PAD;
  };
  for (let it = 0; it < RELAX_ITERATIONS; it++) {
    let maxMove = 0;
    for (let i = 0; i < term.length; i++) {
      for (let j = i + 1; j < term.length; j++) {
        const a = term[i];
        const b = term[j];
        if (a === undefined || b === undefined) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LAYOUT_MAJOR_GAP && d > 0.001) {
          const push = (LAYOUT_MAJOR_GAP - d) / 2;
          a.x += (dx / d) * push;
          a.y += (dy / d) * push;
          b.x -= (dx / d) * push;
          b.y -= (dy / d) * push;
          maxMove = Math.max(maxMove, push);
        }
      }
    }
    for (let i = 0; i < term.length; i++) {
      const a = term[i];
      if (a === undefined || a.root) continue;
      const e = entry[i];
      if (e === null || e === undefined) continue;
      const b = term[e];
      if (b === undefined) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = edgeLen(i);
      const f = (want - d) * 0.6;
      a.x -= (dx / d) * f;
      a.y -= (dy / d) * f;
      b.x += (dx / d) * f;
      b.y += (dy / d) * f;
      maxMove = Math.max(maxMove, Math.abs(f));
    }
    for (const t of term) {
      const dx = t.x - START_X;
      const dy = t.y - START_Y;
      const r = Math.hypot(dx, dy);
      if (r > MAX_RADIUS && r > 0) {
        t.x = START_X + (dx / r) * MAX_RADIUS;
        t.y = START_Y + (dy / r) * MAX_RADIUS;
      }
      if (r < MIN_RADIUS && r > 0) {
        t.x = START_X + (dx / r) * MIN_RADIUS;
        t.y = START_Y + (dy / r) * MIN_RADIUS;
      }
    }
    if (maxMove < 0.02) break;
  }
}

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

function buildWeb(): PassiveNode[] {
  const smalls: Record<Exclude<PassiveSide, 'start'>, { stat: StatKey; value: number }[]> = {
    mining: expandSmall('mining'), battle: expandSmall('battle'), hybrid: expandSmall('hybrid'),
  };
  const smallCursor: Record<Exclude<PassiveSide, 'start'>, number> = { mining: 0, battle: 0, hybrid: 0 };
  const placed: Placed[] = [];

  const term = initialTerminals();
  const entry = assignEntries(term);
  relaxTerminals(term, entry);

  // Every entry's place is known up front, so a cluster's smalls sit on the straight ray from it to the terminal.
  const entryAt = (i: number): { x: number; y: number; id: string } => {
    const e = entry[i];
    if (e === null || e === undefined) return { x: START_X, y: START_Y, id: START_NODE_ID };
    const t = term[e];
    if (t === undefined) throw new Error(`missing entry terminal at ${e}`);
    return { x: t.x, y: t.y, id: t.id };
  };
  const entryId = (i: number): string | null => {
    const e = entry[i];
    if (e === null || e === undefined) return null;
    return term[e]?.id ?? null;
  };

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

  // Place each cluster's smalls on its straight ray, then its terminal. The small ids fall out of the cluster order,
  // which is load-bearing: it is what keeps every pre-existing id pointing at the same stat.
  const smallIds = new Map<string, string[]>();   // terminal id → the cluster's small ids, in chain order
  const startLinks: string[] = [];

  for (let i = 0; i < CLUSTERS.length; i++) {
    const c = CLUSTERS[i];
    if (c === undefined) continue;
    const t = term[i];
    if (t === undefined) throw new Error(`missing terminal ${i}`);
    const e = entryAt(i);
    const ids: string[] = [];
    for (let s = 1; s <= c.count; s++) {
      const stat = takeSmall(c.side);
      const id = `${c.side}Small${smallCursor[c.side]}`;
      const f = s / (c.count + 1);
      placed.push({
        id, name: SMALL_NAMES[stat.stat] ?? stat.stat, kind: 'small', side: c.side,
        effects: [{ kind: 'stat', stat: stat.stat, value: stat.value }], desc: '',
        x: Math.round(e.x + (t.x - e.x) * f), y: Math.round(e.y + (t.y - e.y) * f), links: [],
      });
      ids.push(id);
    }
    smallIds.set(c.terminal.id, ids);
    if (entryId(i) === null && ids[0] !== undefined) startLinks.push(ids[0]);
    placed.push({
      id: c.terminal.id, name: c.terminal.name, kind: c.terminal.kind, side: c.side,
      effects: c.terminal.effects, desc: c.terminal.desc, x: t.x, y: t.y, links: [],
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
  for (let i = 0; i < CLUSTERS.length; i++) {
    const c = CLUSTERS[i];
    if (c === undefined) continue;
    const ids = smallIds.get(c.terminal.id) ?? [];
    const from = entryId(i);
    for (let s = 0; s < ids.length; s++) {
      const id = ids[s];
      if (id === undefined) continue;
      const node = must(id);
      if (s === 0) {
        // The first small links from its entry: the start (a one-way edge the start mirrors via startLinks) or a
        // terminal of another cluster (a both-ways edge).
        if (from === null) node.links.push(START_NODE_ID);
        else linkTo(node, must(from));
      } else {
        const prev = ids[s - 1];
        if (prev !== undefined) linkTo(node, must(prev));
      }
    }
    const terminal = must(c.terminal.id);
    const last = ids[ids.length - 1];
    if (last !== undefined) linkTo(terminal, must(last));
  }

  // The mesh's cycles: each outer cluster's last small cross-links to its angularly nearest same-side neighbour's last
  // small — short chords on the outer ring that close the web without ever crossing an edge.
  for (let i = 0; i < CLUSTERS.length; i++) {
    const t = term[i];
    if (t === undefined || t.root) continue;
    let best = -1;
    let bestScore = Infinity;
    for (let j = 0; j < CLUSTERS.length; j++) {
      const o = term[j];
      if (o === undefined || j === i || o.root || o.side !== t.side) continue;
      const d = Math.abs(angleDiff(t.angle, o.angle));
      if (d > 0.5 && d < bestScore) {
        bestScore = d;
        best = j;
      }
    }
    if (best < 0) continue;
    const mine = smallIds.get(t.id) ?? [];
    const theirs = smallIds.get(term[best]?.id ?? '') ?? [];
    const a = mine[mine.length - 1];
    const b = theirs[theirs.length - 1];
    if (a === undefined || b === undefined) continue;
    if (!must(a).links.includes(b)) linkTo(must(a), must(b));
  }

  // The larger notable/keystone icons need a little more clearance, so nudge smalls apart from each other, from the
  // majors and from the start — never moving a major, which keeps the MAJOR_GAP guarantee exact.
  const smallNodes = placed.filter((p) => p.kind === 'small');
  const majorNodes = placed.filter((p) => p.kind !== 'small');
  for (let it = 0; it < 240; it++) {
    let maxMove = 0;
    for (const a of smallNodes) {
      let vx = 0;
      let vy = 0;
      for (const b of smallNodes) {
        if (a === b) continue;
        const ox = a.x - b.x;
        const oy = a.y - b.y;
        const d = Math.hypot(ox, oy);
        if (d < 52 && d > 0.001) {
          const push = 52 - d;
          vx += (ox / d) * push;
          vy += (oy / d) * push;
        }
      }
      for (const b of majorNodes) {
        const ox = a.x - b.x;
        const oy = a.y - b.y;
        const d = Math.hypot(ox, oy);
        const min = b.kind === 'keystone' ? 66 : 58;
        if (d < min && d > 0.001) {
          const push = min - d;
          vx += (ox / d) * push;
          vy += (oy / d) * push;
        }
      }
      const ox = a.x - START_X;
      const oy = a.y - START_Y;
      const d = Math.hypot(ox, oy);
      if (d < 52 && d > 0.001) {
        const push = 52 - d;
        vx += (ox / d) * push;
        vy += (oy / d) * push;
      }
      const len = Math.hypot(vx, vy);
      if (len > 0.5) {
        const step = Math.min(len, 4);
        a.x += (vx / len) * step;
        a.y += (vy / len) * step;
        maxMove = Math.max(maxMove, step);
      }
    }
    if (maxMove < 0.02) break;
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

/** What a bag cell holds of a gem, rune, material or orb stack; gems and materials rise with the web. */
export function stackCaps(state: Pick<GameState, 'passives'>): { gem: number; rune: number; material: number; orb: number } {
  const p = passiveTotals(state);
  return {
    gem: GEM_BAG_STACK + p.gemStack, material: MATERIAL_BAG_STACK + p.materialStack,
    rune: RUNE_BAG_STACK, orb: ORB_BAG_STACK,
  };
}

/** The free General pages the web grants (Deep Pockets), on top of the free and bought pages. */
export function freeStashPages(state: Pick<GameState, 'passives'>): number {
  return passiveTotals(state).stashPages;
}
