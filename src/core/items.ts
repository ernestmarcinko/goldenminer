export const RARITIES = ['normal', 'magic', 'rare', 'legendary'] as const;
export const GEAR_SETS = ['mining', 'battle'] as const;
export const MINING_SLOTS = ['pickaxe', 'lamp', 'gloves', 'boots'] as const;
export const BATTLE_SLOTS = ['weapon', 'armor', 'helm', 'ring', 'amulet'] as const;
export const MINING_STATS = ['digPower', 'goldYield', 'diamondYield', 'chestFind', 'gemFind', 'mapFind',
  'lampSight', 'ticksPerClick', 'autoTickRate', 'offlineCap', 'hazardWard',
  'digPowerPct', 'veinYield', 'oreFind', 'salvageYield', 'sellBonus'] as const;
export const BATTLE_STATS = ['damage', 'damagePct', 'attackSpeed', 'life', 'armor', 'critChance',
  'resistAll', 'maxResist', 'soulFind', 'magicFind',
  'elementalDamage', 'critMultiplier', 'lifePct', 'armorPct', 'lifeRegen', 'lifeOnKill', 'xpFind', 'cleave'] as const;
export const GEM_TYPES = ['ruby', 'sapphire', 'emerald', 'amethyst', 'starstone'] as const;
export const GEM_GRADES = ['tiny', 'small', 'big', 'giant', 'perfect'] as const;
export const RUNE_TYPES = ['fehu', 'uruz', 'thurisaz', 'ansuz', 'raidho', 'kenaz', 'gebo', 'wunjo', 'hagalaz', 'isa'] as const;
export const MATERIALS = ['copper', 'tin', 'iron', 'silver', 'mithril', 'starsteel', 'obsidian', 'voidCrystal'] as const;
export const MAP_MOD_KINDS = ['monsterLife', 'monsterDamage', 'monsterSpeed', 'bossPower', 'weakHealing', 'hardened'] as const;
export const MAP_SPECIALS = ['bossLegendary', 'treasureRoom', 'championPacks', 'doubleMaterials', 'tripleSouls', 'secondBoss'] as const;

export type Rarity = (typeof RARITIES)[number];
export type GearSet = (typeof GEAR_SETS)[number];
export type MiningSlot = (typeof MINING_SLOTS)[number];
export type BattleSlot = (typeof BATTLE_SLOTS)[number];
export type Slot = MiningSlot | BattleSlot;
export type MiningStat = (typeof MINING_STATS)[number];
export type BattleStat = (typeof BATTLE_STATS)[number];
export type StatKey = MiningStat | BattleStat;
export type GemType = (typeof GEM_TYPES)[number];
export type GemGrade = (typeof GEM_GRADES)[number];
export type RuneType = (typeof RUNE_TYPES)[number];
export type Material = (typeof MATERIALS)[number];
export type MapModKind = (typeof MAP_MOD_KINDS)[number];
export type MapSpecial = (typeof MAP_SPECIALS)[number];
export type MapRarity = 'normal' | 'magic' | 'rare';

export interface StatLine { stat: StatKey; value: number }
/** A rolled modifier; `tier` is 0 only for a legendary's hand-written line. */
export interface ModLine { stat: StatKey; value: number; tier: number; crafted?: true }
export interface Gem { gem: GemType; grade: GemGrade }
export interface GemItem extends Gem { id: number; type: 'gem'; count: number }
/** A rune: an exotic socketable that competes with a gem for the same sockets. */
export interface Rune { rune: RuneType }
export interface RuneItem extends Rune { id: number; type: 'rune'; count: number }
/** What one socket holds: a graded gem or a rune. */
export type Socketed = Gem | Rune;
export interface GearItem {
  id: number; type: 'gear'; slot: Slot; name: string; rarity: Rarity; ilvl: number;
  implicit: StatLine; affixes: ModLine[]; sockets: number; gems: Socketed[]; uniqueId?: string;
  /** Set by tempering: the item takes no more crafts. */
  sealed?: true;
}
export interface MaterialItem { id: number; type: 'material'; material: Material; count: number }
/** A map modifier: each kind at most once on a map, rolled in its tier's range. */
export interface MapMod { kind: MapModKind; tier: number; value: number }
export interface MapItem {
  id: number; type: 'map'; tier: number; metre: number; rarity: MapRarity; mods: MapMod[];
  /** Set by tempering: the map takes no more enchanting. */
  sealed?: true;
  /** At most one, outside `mods`: never counted toward the six, and no enchant removes it. */
  special?: MapSpecial;
}
/** The side a craft or removal orb aims at; scattering, socketing and clearing have no side. */
export type OrbSide = 'prefix' | 'suffix';
/** The five orb families: craft (add a line), removal (remove a line), scattering (reroll values), socketing (add a
 * socket), clearSockets (empty the sockets). */
export type OrbFamily = 'craft' | 'removal' | 'scattering' | 'socketing' | 'clearSockets';
/** The three orb tiers: craft and scattering orbs price and roll in a tier band; removal, socketing and clearing are
 * untiered. */
export type OrbTier = 'minor' | 'normal' | 'greater';
export const ORB_FAMILIES = ['craft', 'removal', 'scattering', 'socketing', 'clearSockets'] as const;
export const ORB_TIERS = ['minor', 'normal', 'greater'] as const;
export const ORB_SIDES = ['prefix', 'suffix'] as const;

/**
 * A crafting orb. `side` is set for craft and removal, absent for scattering/socketing/clearing; `tier` is set for
 * craft and scattering, absent for removal/socketing/clearing.
 */
export interface OrbItem { id: number; type: 'orb'; family: OrbFamily; side?: OrbSide; tier?: OrbTier; count: number }
export type Item = GearItem | GemItem | RuneItem | MaterialItem | MapItem | OrbItem;
/** What stacks in a bag cell and counts up in its stash tab. */
export type Stack = GemItem | RuneItem | MaterialItem | OrbItem;
export type Cell = Item | null;

/** Every stat, in mining then battle order. */
export const ALL_STATS: readonly StatKey[] = [...MINING_STATS, ...BATTLE_STATS];

/** One orb in the catalogue: its family, side (absent for scattering/socketing/clearing), tier (absent for untiered)
 * and unique name. */
export interface OrbDef { family: OrbFamily; side?: OrbSide; tier?: OrbTier; name: string }

/** The 11-orb catalogue, each with a unique name: craft (add), removal (remove), scattering (reroll), socketing and
 * clearing. */
export const ORBS: readonly OrbDef[] = [
  { family: 'craft', side: 'prefix', tier: 'minor', name: 'Flint Orb' },
  { family: 'craft', side: 'prefix', tier: 'normal', name: 'Jasper Orb' },
  { family: 'craft', side: 'prefix', tier: 'greater', name: 'Sunstone Orb' },
  { family: 'craft', side: 'suffix', tier: 'minor', name: 'Shale Orb' },
  { family: 'craft', side: 'suffix', tier: 'normal', name: 'Amber Orb' },
  { family: 'craft', side: 'suffix', tier: 'greater', name: 'Moonstone Orb' },
  { family: 'removal', side: 'prefix', name: 'Orb of Unwriting' },
  { family: 'removal', side: 'suffix', name: 'Orb of Undoing' },
  { family: 'scattering', name: 'Tempest Orb' },
  { family: 'socketing', name: "Borer's Orb" },
  { family: 'clearSockets', name: 'Orb of Cleansing' },
];

/** The catalogue's unique name for an orb. */
export function orbName(item: OrbItem): string {
  return ORBS.find((o) => o.family === item.family && o.side === item.side && o.tier === item.tier)?.name ?? `${item.family} orb`;
}

const isOrbTier = (x: string): x is OrbTier => (ORB_TIERS as readonly string[]).includes(x);
const isOrbSide = (x: string): x is OrbSide => (ORB_SIDES as readonly string[]).includes(x);

/** The Orbs-tab key for an orb: `"craft:prefix:minor"`, `"removal:prefix"`, or the family alone when untiered. */
export function orbKey(family: OrbFamily, side: OrbSide | undefined, tier: OrbTier | undefined): string {
  if (family === 'craft') return `craft:${side}:${tier}`;
  if (family === 'removal') return `removal:${side}`;
  return family;
}

/** Reads an Orbs-tab key back to its family, side (if any) and tier (if any). */
export function parseOrbKey(key: string): { family: OrbFamily; side?: OrbSide; tier?: OrbTier } | undefined {
  const parts = key.split(':');
  const family = parts[0];
  if (parts.length === 1 && (family === 'socketing' || family === 'clearSockets' || family === 'scattering')) {
    return { family };
  }
  if (parts.length === 2) {
    const second = parts[1] ?? '';
    if (family === 'removal' && isOrbSide(second)) return { family: 'removal', side: second };
    return undefined;
  }
  if (parts.length === 3 && family === 'craft' && isOrbSide(parts[1] ?? '') && isOrbTier(parts[2] ?? '')) {
    return { family: 'craft', side: parts[1] as OrbSide, tier: parts[2] as OrbTier };
  }
  return undefined;
}

export const SLOT_IMPLICIT: Readonly<Record<Slot, StatKey>> = {
  pickaxe: 'digPower', lamp: 'lampSight', gloves: 'goldYield', boots: 'offlineCap',
  weapon: 'damage', armor: 'armor', helm: 'life', ring: 'critChance', amulet: 'damagePct',
};

/**
 * Which stats on a slot are *local*: they multiply that slot's own base/affix values before the global pool adds the
 * rest on top. A weapon's `damage`/`damagePct` raise the weapon's own flat damage first; an armor's `armor`/`armorPct`
 * raise the armor's own flat first; a pickaxe's `digPower`/`digPowerPct` raise the base dig power plus the pickaxe's
 * own flat first. Everything else is global.
 */
export const LOCAL_STATS: Readonly<Partial<Record<Slot, readonly StatKey[]>>> = {
  weapon: ['damage', 'damagePct'],
  armor: ['armor', 'armorPct'],
  pickaxe: ['digPower', 'digPowerPct'],
};

/** Which side of an item's name a modifier sits on; each gear set has 8 prefixes and 8 suffixes. */
export const MOD_SIDE: Readonly<Record<StatKey, 'prefix' | 'suffix'>> = {
  digPower: 'prefix', digPowerPct: 'prefix', goldYield: 'prefix', diamondYield: 'prefix', veinYield: 'prefix',
  autoTickRate: 'prefix', ticksPerClick: 'prefix', sellBonus: 'prefix',
  chestFind: 'suffix', gemFind: 'suffix', mapFind: 'suffix', oreFind: 'suffix', lampSight: 'suffix',
  offlineCap: 'suffix', hazardWard: 'suffix', salvageYield: 'suffix',
  damage: 'prefix', damagePct: 'prefix', elementalDamage: 'prefix', attackSpeed: 'prefix', critChance: 'prefix',
  critMultiplier: 'prefix', life: 'prefix', lifePct: 'prefix', cleave: 'prefix',
  armor: 'suffix', armorPct: 'suffix', resistAll: 'suffix', maxResist: 'suffix', lifeRegen: 'suffix', lifeOnKill: 'suffix',
  soulFind: 'suffix', magicFind: 'suffix', xpFind: 'suffix',
};

export function setOfSlot(slot: Slot): GearSet {
  return (MINING_SLOTS as readonly string[]).includes(slot) ? 'mining' : 'battle';
}
export function slotsOf(set: GearSet): readonly Slot[] {
  return set === 'mining' ? MINING_SLOTS : BATTLE_SLOTS;
}
export function statsOf(set: GearSet): readonly StatKey[] {
  return set === 'mining' ? MINING_STATS : BATTLE_STATS;
}
export function isGear(item: Item): item is GearItem {
  return item.type === 'gear';
}
export function isStack(item: Item): item is Stack {
  return item.type === 'gem' || item.type === 'rune' || item.type === 'material' || item.type === 'orb';
}
export function isMap(item: Item): item is MapItem {
  return item.type === 'map';
}
