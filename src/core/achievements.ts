import { MATERIAL_LABELS } from './itemData';
import { MATERIALS, type Material } from './items';
import type { GameState } from './types';

/**
 * The permanent, global boost each earned achievement grants: +0.1% per achievement, applied to the final derived
 * offensive, defensive and yield values only. It never re-enters the stat pool, so it cannot be rolled on gear or read
 * back as a bonus. (The owner floated 0.5%; the balance sim showed 0.5% × ~1000 achievements = +500% overwhelms the
 * level curve, so it is tuned to 0.1% — +100% at full completion.)
 */
export const ACHIEVEMENT_BOOST = 0.001;

/** One achievement: a generated id `<family>.<value>`, the family it belongs to and its threshold. */
export interface AchievementDef {
  id: string;
  family: string;
  value: number;
  name: string;
  desc: string;
}

/** How a family's achievements read: its group label and the name/description for a threshold. */
interface FamilyDef {
  family: string;
  label: string;
  min: number;
  max: number;
  count: number;
  name: (n: number) => string;
  desc: (n: number) => string;
}

/** Whole numbers with thousands separators, for the generated names. */
const commas = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * `count` strictly-increasing whole-number thresholds from `min` to `max`, spaced logarithmically (the low end is dense
 * and easy, the tail is endgame). A rounded value that repeats its neighbour steps up one, so exactly `count` distinct
 * thresholds come out and the last is always `max`.
 */
function thresholds(min: number, max: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [max];
  const ratio = Math.pow(max / min, 1 / (count - 1));
  const out: number[] = [];
  let prev = min - 1;
  for (let i = 0; i < count; i++) {
    const raw = i === count - 1 ? max : min * Math.pow(ratio, i);
    let value = Math.max(min, Math.round(raw));
    if (value <= prev) value = prev + 1;
    out.push(value);
    prev = value;
  }
  return out;
}

const FAMILY_DEFS: readonly FamilyDef[] = [
  { family: 'depth', label: 'Depth', min: 10, max: 10_000, count: 50,
    name: (n) => `Reach ${commas(n)} m`,
    desc: (n) => `Reach a depth of ${commas(n)} metres.` },
  { family: 'dig', label: 'Digging', min: 1, max: 10_000, count: 50,
    name: (n) => `Dig ${commas(n)} m`,
    desc: (n) => `Dig ${commas(n)} metres over your lifetime.` },
  { family: 'gold', label: 'Gold', min: 100, max: 1_000_000, count: 50,
    name: (n) => `Earn ${commas(n)} Gold`,
    desc: (n) => `Earn ${commas(n)} Gold over your lifetime.` },
  { family: 'diamonds', label: 'Diamonds', min: 5, max: 10_000, count: 44,
    name: (n) => `Earn ${commas(n)} Diamonds`,
    desc: (n) => `Earn ${commas(n)} Diamonds over your lifetime.` },
  { family: 'gems', label: 'Gems', min: 1, max: 5000, count: 44,
    name: (n) => `Find ${commas(n)} gems`,
    desc: (n) => `Find ${commas(n)} gems over your lifetime.` },
  { family: 'maps', label: 'Maps', min: 1, max: 500, count: 44,
    name: (n) => `Clear ${commas(n)} maps`,
    desc: (n) => `Clear ${commas(n)} maps over your lifetime.` },
  { family: 'kills', label: 'Kills', min: 1, max: 50_000, count: 50,
    name: (n) => `Kill ${commas(n)} monsters`,
    desc: (n) => `Kill ${commas(n)} monsters over your lifetime.` },
  { family: 'bosses', label: 'Bosses', min: 1, max: 1000, count: 44,
    name: (n) => `Kill ${commas(n)} bosses`,
    desc: (n) => `Kill ${commas(n)} bosses over your lifetime.` },
  { family: 'deaths', label: 'Deaths', min: 1, max: 50, count: 34,
    name: (n) => `Die ${commas(n)} times`,
    desc: (n) => `Die ${commas(n)} times over your lifetime.` },
  { family: 'levels', label: 'Levels', min: 2, max: 100, count: 44,
    name: (n) => `Reach level ${commas(n)}`,
    desc: (n) => `Reach level ${commas(n)}.` },
  { family: 'ascensions', label: 'Ascensions', min: 1, max: 10, count: 10,
    name: (n) => `Ascend ${commas(n)} times`,
    desc: (n) => `Ascend ${commas(n)} times.` },
  { family: 'craft', label: 'Crafting', min: 1, max: 1000, count: 44,
    name: (n) => `Craft ${commas(n)} items`,
    desc: (n) => `Craft ${commas(n)} items over your lifetime.` },
  { family: 'merchant', label: 'Merchant', min: 1, max: 1000, count: 44,
    name: (n) => `Buy ${commas(n)} items`,
    desc: (n) => `Buy ${commas(n)} items from the merchant over your lifetime.` },
  { family: 'legendaries', label: 'Legendaries', min: 1, max: 20, count: 20,
    name: (n) => `Own ${commas(n)} legendaries`,
    desc: (n) => `Own ${commas(n)} legendary items.` },
  { family: 'sockets', label: 'Sockets', min: 1, max: 500, count: 44,
    name: (n) => `Socket ${commas(n)} gems`,
    desc: (n) => `Socket ${commas(n)} gems into gear over your lifetime.` },
];

const ORE_DEFS: readonly FamilyDef[] = MATERIALS.map((material) => {
  const label = MATERIAL_LABELS[material];
  return {
    family: `ore.${material}`,
    label,
    min: 1, max: 1000, count: 48,
    name: (n: number) => `Find ${commas(n)} ${label}`,
    desc: (n: number) => `Find ${commas(n)} ${label.toLowerCase()} over your lifetime.`,
  };
});

const ALL_DEFS: readonly FamilyDef[] = [...FAMILY_DEFS, ...ORE_DEFS];

/** The full generated table: families × thresholds, ~1000 achievements with unique `<family>.<value>` ids. */
export const ACHIEVEMENTS: readonly AchievementDef[] = ALL_DEFS.flatMap((def) =>
  thresholds(def.min, def.max, def.count).map((value) => ({
    id: `${def.family}.${value}`,
    family: def.family,
    value,
    name: def.name(value),
    desc: def.desc(value),
  })),
);

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.id));

const BY_FAMILY: ReadonlyMap<string, readonly AchievementDef[]> = (() => {
  const map = new Map<string, AchievementDef[]>();
  for (const a of ACHIEVEMENTS) {
    const list = map.get(a.family);
    if (list === undefined) map.set(a.family, [a]);
    else list.push(a);
  }
  return map;
})();

export const FAMILY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  ALL_DEFS.map((def) => [def.family, def.label]),
);

/** The permanent counters the achievements read: everything that must survive ascension lives in `state.stats`. */
function familyValue(state: GameState, family: string): number {
  switch (family) {
    case 'depth': return state.deepest;
    case 'dig': return state.stats.metresDug;
    case 'gold': return state.stats.goldFound + state.stats.goldFromSales;
    case 'diamonds': return state.stats.diamondsFound;
    case 'gems': return state.stats.gems;
    case 'maps': return state.stats.mapsCleared;
    case 'kills': return state.stats.monstersKilled;
    case 'bosses': return state.stats.bossKills;
    case 'deaths': return state.stats.deaths;
    case 'levels': return state.level;
    case 'ascensions': return state.lifetime.ascensions;
    case 'craft': return state.stats.itemsCrafted;
    case 'merchant': return state.stats.itemsBought;
    case 'legendaries': return state.stats.legendaries;
    case 'sockets': return state.stats.gemsSocketed;
    default: return family.startsWith('ore.') ? (state.stats.oresFound[family.slice(4) as Material] ?? 0) : 0;
  }
}

/**
 * Marks every achievement of `family` (or of every family, when omitted) whose condition now holds. Each one is marked
 * once and never again, and the check only reads monotonic counters, so it stays cheap and idempotent.
 */
export function checkAchievements(state: GameState, family?: string): void {
  const list = family === undefined ? ACHIEVEMENTS : BY_FAMILY.get(family);
  if (list === undefined) return;
  const earned = state.achievements.earned;
  const earnedSet = new Set(earned);
  for (const a of list) {
    if (earnedSet.has(a.id)) continue;
    if (familyValue(state, a.family) >= a.value) {
      earned.push(a.id);
      earnedSet.add(a.id);
    }
  }
}

/** How many achievements are earned. */
export function earnedCount(state: GameState): number {
  return state.achievements.earned.length;
}

/** The global multiplier: 1 + ACHIEVEMENT_BOOST × earned. */
export function achievementBoost(state: GameState): number {
  return 1 + ACHIEVEMENT_BOOST * earnedCount(state);
}
