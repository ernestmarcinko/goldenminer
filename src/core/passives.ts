import type { StatKey } from './items';
import type { GameState } from './types';

export type PassiveKind = 'small' | 'notable' | 'keystone' | 'start';
export type PassiveSide = 'mining' | 'battle' | 'hybrid' | 'start';
export type KeystoneId =
  | 'earthshaker' | 'cartographer' | 'prospectorsLuck' | 'berserker'
  | 'soulReaper' | 'bulwark' | 'deepPockets' | 'twoWayStreet';

/** What a node grants: a stat, a rule change (keystone), or a structural bonus. */
export type PassiveEffect =
  | { kind: 'stat'; stat: StatKey; value: number }
  | { kind: 'keystone'; id: KeystoneId }
  | { kind: 'gemStack'; value: number }
  | { kind: 'materialStack'; value: number }
  | { kind: 'stashPages'; value: number };

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

// The small nodes' budget: [stat, value, count]. Mining totals 48, battle 48, hybrid 19 — 115 in all.
const SMALL_BUDGET: Record<Exclude<PassiveSide, 'start'>, ReadonlyArray<readonly [StatKey, number, number]>> = {
  mining: [
    ['digPower', 4, 8], ['digPowerPct', 6, 4], ['goldYield', 6, 4], ['diamondYield', 6, 4],
    ['veinYield', 4, 4], ['chestFind', 5, 4], ['gemFind', 5, 3], ['mapFind', 5, 3], ['oreFind', 5, 3],
    ['lampSight', 1, 2], ['autoTickRate', 4, 3], ['ticksPerClick', 0.5, 2], ['offlineCap', 30, 2], ['hazardWard', 8, 2],
  ],
  battle: [
    ['damage', 4, 6], ['damagePct', 6, 3], ['attackSpeed', 4, 3], ['critChance', 2, 4], ['critMultiplier', 6, 3],
    ['life', 20, 5], ['lifePct', 4, 3], ['armor', 20, 4], ['armorPct', 6, 3], ['resistAll', 4, 3],
    ['elementalDamage', 4, 2], ['lifeRegen', 1, 2], ['lifeOnKill', 3, 1], ['soulFind', 5, 3], ['magicFind', 5, 2], ['xpFind', 5, 1],
  ],
  hybrid: [
    ['digPower', 3, 3], ['damage', 3, 3], ['life', 10, 4], ['goldYield', 4, 3], ['soulFind', 3, 3], ['magicFind', 3, 3],
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

// The web's geometry: the start in the middle, three chains fanning out each side, hybrid chains along the bottom.
// `s` marks a small node; a NamedSpec is a notable or a keystone at a chain's far end; a branch hangs a notable off a chain.
interface ChainDef {
  side: Exclude<PassiveSide, 'start'>;
  angle: number;
  items: (NamedSpec | 's')[];
  parent?: { chain: number; ring: number };
}

const START_X = 560;
const START_Y = 400;
const RING_GAP = 85;

const CHAINS: ChainDef[] = [
  // mining: upper-left, left, lower-left, plus two short branches
  { side: 'mining', angle: 135, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    veinSense, earthshaker] },
  { side: 'mining', angle: 180, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    prospector, prospectorsLuck] },
  { side: 'mining', angle: 225, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    deepLungs, cartographer] },
  { side: 'mining', angle: 153, parent: { chain: 0, ring: 3 }, items: ['s', oreSniffer] },
  { side: 'mining', angle: 207, parent: { chain: 2, ring: 3 }, items: ['s', steadyHands] },
  // battle: upper-right, right, lower-right, plus two short branches
  { side: 'battle', angle: 45, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    thickSkin, berserker] },
  { side: 'battle', angle: 0, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    sharpened, bulwark] },
  { side: 'battle', angle: 315, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    soulWarden, soulReaper] },
  { side: 'battle', angle: 27, parent: { chain: 5, ring: 3 }, items: ['s', deadlyAim] },
  { side: 'battle', angle: 333, parent: { chain: 7, ring: 3 }, items: ['s', treasureHunter] },
  // hybrid: the bottom
  { side: 'hybrid', angle: 250, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's',
    lampAndBlade, gemPouch, deepPockets] },
  { side: 'hybrid', angle: 290, items: ['s', 's', 's', 's', 's', 's', 's', 's', 's', 's',
    wellRested, sureFooting, careful, oreCart, twoWayStreet] },
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
  ring: number;
  chain: number;
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

  const chainDef = (i: number): ChainDef => {
    const c = CHAINS[i];
    if (c === undefined) throw new Error('missing chain');
    return c;
  };
  const takeSmall = (side: Exclude<PassiveSide, 'start'>): { stat: StatKey; value: number } => {
    const s = smalls[side][smallCursor[side]];
    if (s === undefined) throw new Error('small budget exhausted');
    smallCursor[side]++;
    return s;
  };

  for (const [ci, chain] of CHAINS.entries()) {
    let ring = 1;
    for (const item of chain.items) {
      if (item === 's') {
        const s = takeSmall(chain.side);
        placed.push({
          id: `${chain.side}Small${smallCursor[chain.side]}`, name: SMALL_NAMES[s.stat] ?? s.stat, kind: 'small', side: chain.side,
          effects: [{ kind: 'stat', stat: s.stat, value: s.value }], desc: '',
          x: pointX(chain.angle, ring), y: pointY(chain.angle, ring), links: [], ring, chain: ci,
        });
      } else {
        placed.push({
          id: item.id, name: item.name, kind: item.kind, side: chain.side, effects: item.effects, desc: item.desc,
          x: pointX(chain.angle, ring), y: pointY(chain.angle, ring), links: [], ring, chain: ci,
        });
      }
      ring++;
    }
  }

  const byChain = new Map<number, Placed[]>();
  for (const p of placed) {
    const list = byChain.get(p.chain) ?? [];
    list.push(p);
    byChain.set(p.chain, list);
  }
  const chainAt = (chain: number, ring: number): Placed | undefined => byChain.get(chain)?.find((p) => p.ring === ring);

  const link = (a: Placed, b: string): void => {
    if (b !== a.id && !a.links.includes(b)) a.links.push(b);
  };
  for (const p of placed) {
    const chain = chainDef(p.chain);
    if (chain.parent !== undefined) {
      const parent = chainAt(chain.parent.chain, chain.parent.ring);
      if (parent !== undefined) link(p, parent.id);
    } else if (p.ring === 1) {
      link(p, START_NODE_ID);
    } else {
      const prev = chainAt(p.chain, p.ring - 1);
      if (prev !== undefined) link(p, prev.id);
      if (p.chain > 0 && chainDef(p.chain - 1).side === chain.side) {
        const cross = chainAt(p.chain - 1, p.ring - 1);
        if (cross !== undefined) link(p, cross.id);
      }
    }
  }
  // symmetric links: every link a -> b is also b -> a
  for (const p of placed) {
    for (const l of p.links) {
      const other = placed.find((o) => o.id === l);
      if (other !== undefined && !other.links.includes(p.id)) other.links.push(p.id);
    }
  }

  const start: PassiveNode = {
    id: START_NODE_ID, name: 'Miner', kind: 'start', side: 'start',
    x: START_X, y: START_Y,
    links: placed.filter((p) => p.ring === 1 && chainDef(p.chain).parent === undefined).map((p) => p.id),
    effects: [], desc: 'Start',
  };
  return [start, ...placed.map(({ id, name, kind, side, effects, desc, x, y, links }) =>
    ({ id, name, kind, side, effects, desc, x, y, links }))];
}

function pointX(angleDeg: number, ring: number): number {
  return Math.round(START_X + Math.cos((angleDeg * Math.PI) / 180) * ring * RING_GAP);
}
function pointY(angleDeg: number, ring: number): number {
  return Math.round(START_Y + Math.sin((angleDeg * Math.PI) / 180) * ring * RING_GAP);
}

export const PASSIVE_NODES: readonly PassiveNode[] = buildWeb();

export const PASSIVE_NODE_BY_ID: ReadonlyMap<string, PassiveNode> = new Map(PASSIVE_NODES.map((n) => [n.id, n]));

/** The unspent points: one per level past the first, minus what is already allocated. */
export function pointsToSpend(state: Pick<GameState, 'level' | 'passives'>): number {
  return Math.max(0, state.level - 1 - state.passives.allocated.length);
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
}

/** The allocated nodes' effects, summed: stat effects into `stats`, the structural bonuses and the keystones set. */
export function passiveTotals(state: Pick<GameState, 'passives'>): PassiveTotals {
  const totals: PassiveTotals = {
    stats: {} as Record<StatKey, number>, gemStack: 0, materialStack: 0, stashPages: 0, keystones: new Set(),
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
      }
    }
  }
  return totals;
}

/** Whether a keystone is allocated (its node is). */
export function hasKeystone(state: Pick<GameState, 'passives'>, id: KeystoneId): boolean {
  return passiveTotals(state).keystones.has(id);
}
