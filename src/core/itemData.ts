import { GEM_GRADES, orbName } from './items';
import type { Gem, GemGrade, GemType, GearSet, Item, Material, Slot, StatKey } from './items';
import { GEM_GRADE_FROM_TIER } from './balance';
import { RUNE_LABELS } from './runes';

export const BASE_NAMES: Readonly<Record<Slot, readonly [string, string, string, string]>> = {
  pickaxe: ['Copper Pick', 'Iron Pick', 'Steel Pick', 'Mithril Pick'],
  lamp: ['Candle Cap', 'Oil Lamp Helm', 'Carbide Helm', 'Glowstone Helm'],
  gloves: ['Cloth Gloves', 'Leather Gloves', 'Studded Gloves', 'Iron Gauntlets'],
  boots: ['Worn Boots', 'Leather Boots', 'Hobnail Boots', 'Iron Boots'],
  weapon: ['Rusty Cleaver', 'Quarry Maul', 'Iron Mace', 'War Pick'],
  armor: ['Leather Apron', 'Hide Vest', 'Chain Mail', 'Plate Coat'],
  helm: ['Leather Cap', 'Iron Visor', 'Steel Helm', 'Great Helm'],
  ring: ['Copper Ring', 'Brass Loop', 'Silver Band', 'Gold Band'],
  amulet: ['Coal Charm', 'Bone Amulet', 'Silver Pendant', 'Gold Amulet'],
};

export function baseName(slot: Slot, ilvl: number): string {
  const names = BASE_NAMES[slot];
  return names[Math.min(3, Math.floor((ilvl - 1) / 3))] ?? names[0];
}

/** The word a modifier puts on a magic item's name: a prefix word for prefix stats, a suffix word for suffix stats. */
export const MOD_WORDS: Readonly<Record<StatKey, string>> = {
  digPower: 'Sharp', digPowerPct: 'Honed', goldYield: 'Golden', diamondYield: 'Glittering', veinYield: 'Bountiful',
  autoTickRate: 'Tireless', ticksPerClick: 'Eager', sellBonus: 'Shrewd',
  chestFind: 'Treasure', gemFind: 'Gems', mapFind: 'the Explorer', oreFind: 'Ore', lampSight: 'Vision',
  offlineCap: 'Dreams', hazardWard: 'the Canary', salvageYield: 'Salvage',
  damage: 'Heavy', damagePct: 'Cruel', elementalDamage: 'Searing', attackSpeed: 'Swift', critChance: 'Keen',
  critMultiplier: 'Deadly', life: 'Hale', lifePct: 'Robust', cleave: 'Cleaving',
  armor: 'the Wall', armorPct: 'the Bulwark', resistAll: 'Warding', maxResist: 'the Aegis', lifeRegen: 'Mending', lifeOnKill: 'the Leech',
  soulFind: 'Souls', magicFind: 'Plunder', xpFind: 'Learning',
};

export const RARE_FIRST: readonly string[] = ['Gloom', 'Stone', 'Grim', 'Deep', 'Ash', 'Iron', 'Ember', 'Dusk',
  'Hollow', 'Rune', 'Storm', 'Bone'];

export const RARE_SECOND: Readonly<Record<Slot, readonly string[]>> = {
  pickaxe: ['Biter', 'Breaker', 'Delver'],
  lamp: ['Glow', 'Beacon', 'Eye'],
  gloves: ['Grasp', 'Fist', 'Touch'],
  boots: ['Stride', 'Tread', 'March'],
  weapon: ['Cleaver', 'Maul', 'Smasher'],
  armor: ['Mail', 'Coat', 'Shell'],
  helm: ['Visor', 'Hood', 'Crown'],
  ring: ['Loop', 'Coil', 'Band'],
  amulet: ['Charm', 'Token', 'Heart'],
};

export type LegendaryTier = 1 | 2 | 3 | 4 | 5;

/** How likely each legendary tier is when one drops: tier 1 is the commonest, tier 5 a once-in-a-blue-moon chase. */
export const LEGENDARY_TIER_WEIGHTS: Readonly<Record<LegendaryTier, number>> = { 1: 32, 2: 16, 3: 8, 4: 4, 5: 1 };

/** The item level a legendary tier first drops at: deeper, rarer legendaries never drop shallow. */
export const LEGENDARY_TIER_MIN_LEVEL: Readonly<Record<LegendaryTier, number>> = { 1: 1, 2: 10, 3: 25, 4: 40, 5: 60 };

export interface LegendaryDef {
  id: string; name: string; slot: Slot;
  /** The rarity tier: 1 is the commonest legendary, 5 the rarest (gated by `LEGENDARY_TIER_MIN_LEVEL`). */
  tier: LegendaryTier;
  lines: ({ stat: StatKey; scale: number } | { stat: StatKey; fixed: number })[];
}

export type LegendaryId = string;
export const LEGENDARIES: readonly LegendaryDef[] = [
  // --- Tier 1: the common legendaries, drop from the first metres ---
  { id: 'molesbane', name: 'Molesbane', slot: 'pickaxe', tier: 1, lines: [
    { stat: 'digPower', scale: 1.3 }, { stat: 'oreFind', scale: 1.2 }] },
  { id: 'ratKing', name: 'Rat King', slot: 'pickaxe', tier: 1, lines: [
    { stat: 'digPower', scale: 1.2 }, { stat: 'veinYield', scale: 1.3 }] },
  { id: 'glowworm', name: 'Glowworm', slot: 'lamp', tier: 1, lines: [
    { stat: 'lampSight', fixed: 2 }, { stat: 'gemFind', scale: 1.3 }] },
  { id: 'siltGloves', name: 'Silt Gloves', slot: 'gloves', tier: 1, lines: [
    { stat: 'goldYield', scale: 1.4 }] },
  { id: 'surefoot', name: 'Surefoot', slot: 'boots', tier: 1, lines: [
    { stat: 'hazardWard', scale: 1.4 }] },
  { id: 'oldReliable', name: 'Old Reliable', slot: 'weapon', tier: 1, lines: [
    { stat: 'damage', scale: 1.3 }] },
  { id: 'rustcoat', name: 'Rustcoat', slot: 'armor', tier: 1, lines: [
    { stat: 'armor', scale: 1.4 }] },
  { id: 'dentedCrown', name: 'Dented Crown', slot: 'helm', tier: 1, lines: [
    { stat: 'life', scale: 1.3 }] },
  { id: 'copperLoop', name: 'Copper Loop', slot: 'ring', tier: 1, lines: [
    { stat: 'critChance', scale: 1.3 }] },
  { id: 'luckyCharm', name: 'Lucky Charm', slot: 'amulet', tier: 1, lines: [
    { stat: 'magicFind', scale: 1.4 }] },

  // --- Tier 2: drop from level 10 ---
  { id: 'boulderBiter', name: 'Boulder Biter', slot: 'pickaxe', tier: 2, lines: [
    { stat: 'digPower', scale: 1.6 }, { stat: 'ticksPerClick', fixed: 1 }] },
  { id: 'mothLamp', name: 'Moth Lamp', slot: 'lamp', tier: 2, lines: [
    { stat: 'lampSight', fixed: 3 }, { stat: 'chestFind', scale: 1.4 }] },
  { id: 'minersMitts', name: "Miner's Mitts", slot: 'gloves', tier: 2, lines: [
    { stat: 'goldYield', scale: 1.6 }, { stat: 'diamondYield', scale: 1.2 }] },
  { id: 'tunnelTreads', name: 'Tunnel Treads', slot: 'boots', tier: 2, lines: [
    { stat: 'autoTickRate', scale: 1.4 }, { stat: 'hazardWard', scale: 1.2 }] },
  { id: 'quarryMaul', name: 'Quarry Maul', slot: 'weapon', tier: 2, lines: [
    { stat: 'damage', scale: 1.6 }, { stat: 'damagePct', scale: 1.2 }] },
  { id: 'basaltPlate', name: 'Basalt Plate', slot: 'armor', tier: 2, lines: [
    { stat: 'armor', scale: 1.6 }, { stat: 'life', scale: 1.2 }] },
  { id: 'caveCrown', name: 'Cave Crown', slot: 'helm', tier: 2, lines: [
    { stat: 'life', scale: 1.5 }, { stat: 'armorPct', scale: 1.2 }] },
  { id: 'silverBand', name: 'Silver Band', slot: 'ring', tier: 2, lines: [
    { stat: 'critMultiplier', scale: 1.3 }, { stat: 'critChance', scale: 1.2 }] },
  { id: 'boneCharm', name: 'Bone Charm', slot: 'amulet', tier: 2, lines: [
    { stat: 'soulFind', scale: 1.6 }] },
  { id: 'nightfallTreads', name: 'Nightfall Treads', slot: 'boots', tier: 2, lines: [
    { stat: 'offlineCap', scale: 1.4 }] },

  // --- Tier 3: drop from level 25 ---
  { id: 'gildedPick', name: 'Gilded Pick', slot: 'pickaxe', tier: 3, lines: [
    { stat: 'digPower', scale: 2 }, { stat: 'goldYield', scale: 1.3 }] },
  { id: 'starlight', name: 'Starlight', slot: 'lamp', tier: 3, lines: [
    { stat: 'lampSight', fixed: 4 }, { stat: 'mapFind', scale: 1.6 }] },
  { id: 'diamondHands', name: 'Diamond Hands', slot: 'gloves', tier: 3, lines: [
    { stat: 'diamondYield', scale: 1.8 }, { stat: 'goldYield', scale: 1.3 }] },
  { id: 'deepStride', name: 'Deep Stride', slot: 'boots', tier: 3, lines: [
    { stat: 'autoTickRate', scale: 1.8 }] },
  { id: 'emberEdge', name: 'Ember Edge', slot: 'weapon', tier: 3, lines: [
    { stat: 'damage', scale: 1.8 }, { stat: 'elementalDamage', scale: 1.3 }] },
  { id: 'obsidianShell', name: 'Obsidian Shell', slot: 'armor', tier: 3, lines: [
    { stat: 'armor', scale: 1.8 }, { stat: 'resistAll', scale: 1.3 }] },
  { id: 'wardensCrown', name: "Warden's Crown", slot: 'helm', tier: 3, lines: [
    { stat: 'life', scale: 1.8 }, { stat: 'lifePct', scale: 1.3 }] },
  { id: 'soulBand', name: 'Soul Band', slot: 'ring', tier: 3, lines: [
    { stat: 'soulFind', scale: 1.6 }, { stat: 'magicFind', scale: 1.3 }] },
  { id: 'seersEye', name: "Seer's Eye", slot: 'amulet', tier: 3, lines: [
    { stat: 'xpFind', scale: 1.6 }] },
  { id: 'oreBiter', name: 'Ore Biter', slot: 'gloves', tier: 3, lines: [
    { stat: 'oreFind', scale: 1.8 }, { stat: 'veinYield', scale: 1.3 }] },

  // --- Tier 4: drop from level 40, and the four signature mining legendaries ---
  { id: 'deepdelver', name: 'Deepdelver', slot: 'pickaxe', tier: 4, lines: [
    { stat: 'digPower', scale: 1.5 }, { stat: 'ticksPerClick', fixed: 1 }, { stat: 'chestFind', fixed: -10 }] },
  { id: 'golddigger', name: 'The Golddigger', slot: 'gloves', tier: 4, lines: [
    { stat: 'goldYield', scale: 2 }, { stat: 'diamondYield', scale: 1 }] },
  { id: 'blackLantern', name: 'Black Lantern', slot: 'lamp', tier: 4, lines: [
    { stat: 'lampSight', fixed: 3 }, { stat: 'mapFind', scale: 1.5 }, { stat: 'gemFind', scale: 1 }] },
  { id: 'longVoyage', name: 'Long Voyage', slot: 'boots', tier: 4, lines: [
    { stat: 'offlineCap', fixed: 120 }, { stat: 'autoTickRate', scale: 1 }] },
  { id: 'wolfEye', name: 'Wolf Eye', slot: 'amulet', tier: 4, lines: [
    { stat: 'magicFind', scale: 2 }, { stat: 'soulFind', scale: 1.5 }] },
  { id: 'worldbreaker', name: 'Worldbreaker', slot: 'pickaxe', tier: 4, lines: [
    { stat: 'digPower', scale: 2.4 }, { stat: 'digPowerPct', scale: 1.4 }] },
  { id: 'abyssLight', name: 'Abyss Light', slot: 'lamp', tier: 4, lines: [
    { stat: 'lampSight', fixed: 5 }, { stat: 'gemFind', scale: 1.8 }] },
  { id: 'midasGrips', name: 'Midas Grips', slot: 'gloves', tier: 4, lines: [
    { stat: 'goldYield', scale: 2.2 }, { stat: 'diamondYield', scale: 1.4 }] },
  { id: 'leviathanTreads', name: 'Leviathan Treads', slot: 'boots', tier: 4, lines: [
    { stat: 'autoTickRate', scale: 2 }, { stat: 'offlineCap', scale: 1.4 }] },
  { id: 'stormcaller', name: 'Stormcaller', slot: 'weapon', tier: 4, lines: [
    { stat: 'damage', scale: 2.2 }, { stat: 'attackSpeed', scale: 1.4 }] },
  { id: 'dragonhide', name: 'Dragonhide', slot: 'armor', tier: 4, lines: [
    { stat: 'armor', scale: 2.2 }, { stat: 'life', scale: 1.5 }] },
  { id: 'crownOfTheDeep', name: 'Crown of the Deep', slot: 'helm', tier: 4, lines: [
    { stat: 'life', scale: 2.2 }, { stat: 'armorPct', scale: 1.4 }] },
  { id: 'meteorBand', name: 'Meteor Band', slot: 'ring', tier: 4, lines: [
    { stat: 'critMultiplier', scale: 1.6 }, { stat: 'critChance', scale: 1.5 }] },
  { id: 'voidCharm', name: 'Void Charm', slot: 'amulet', tier: 4, lines: [
    { stat: 'soulFind', scale: 2 }, { stat: 'xpFind', scale: 1.4 }] },

  // --- Tier 5: the rarest chase legendaries, drop from level 60, and the signature battle legendaries ---
  { id: 'bandOfTheDeep', name: 'Band of the Deep', slot: 'ring', tier: 5, lines: [
    { stat: 'critChance', scale: 1.5 }, { stat: 'life', scale: 1 }] },
  { id: 'krakenLeather', name: 'Kraken Leather', slot: 'armor', tier: 5, lines: [
    { stat: 'armor', scale: 1.5 }, { stat: 'resistAll', scale: 1.5 }] },
  { id: 'peacemaker', name: 'The Peacemaker', slot: 'weapon', tier: 5, lines: [
    { stat: 'damage', scale: 1.5 }, { stat: 'attackSpeed', scale: 1.5 }] },
  { id: 'excavatorPrime', name: 'Excavator Prime', slot: 'pickaxe', tier: 5, lines: [
    { stat: 'digPower', scale: 3 }, { stat: 'veinYield', scale: 1.6 }] },
  { id: 'sunLantern', name: 'Sun Lantern', slot: 'lamp', tier: 5, lines: [
    { stat: 'lampSight', fixed: 6 }, { stat: 'mapFind', scale: 2 }] },
  { id: 'handsOfMidas', name: 'Hands of Midas', slot: 'gloves', tier: 5, lines: [
    { stat: 'goldYield', scale: 3 }, { stat: 'diamondYield', scale: 1.8 }] },
  { id: 'godspeedTreads', name: 'Godspeed Treads', slot: 'boots', tier: 5, lines: [
    { stat: 'autoTickRate', scale: 2.5 }] },
  { id: 'doomfang', name: 'Doomfang', slot: 'weapon', tier: 5, lines: [
    { stat: 'damage', scale: 2.8 }, { stat: 'elementalDamage', scale: 1.8 }] },
  { id: 'adamantBulwark', name: 'Adamant Bulwark', slot: 'armor', tier: 5, lines: [
    { stat: 'armor', scale: 2.8 }, { stat: 'resistAll', scale: 1.8 }] },
  { id: 'haloOfKings', name: 'Halo of Kings', slot: 'helm', tier: 5, lines: [
    { stat: 'life', scale: 2.8 }, { stat: 'lifePct', scale: 1.8 }] },
  { id: 'theOneRing', name: 'The One Ring', slot: 'ring', tier: 5, lines: [
    { stat: 'critChance', scale: 2 }, { stat: 'critMultiplier', scale: 1.8 }] },
  { id: 'soulOfTheDeep', name: 'Soul of the Deep', slot: 'amulet', tier: 5, lines: [
    { stat: 'soulFind', scale: 2.5 }, { stat: 'magicFind', scale: 1.5 }] },
];

/** Every legendary id, for the id type guard. */
export const LEGENDARY_IDS: readonly string[] = LEGENDARIES.map((d) => d.id);

export const GEM_EFFECTS: Readonly<Record<GemType, Readonly<Record<GearSet, StatKey>>>> = {
  ruby: { mining: 'goldYield', battle: 'damagePct' },
  sapphire: { mining: 'diamondYield', battle: 'resistAll' },
  emerald: { mining: 'mapFind', battle: 'attackSpeed' },
  amethyst: { mining: 'chestFind', battle: 'life' },
  starstone: { mining: 'digPower', battle: 'critChance' },
};

export const GEM_LABELS: Readonly<Record<GemType, string>> = {
  ruby: 'Ruby', sapphire: 'Sapphire', emerald: 'Emerald', amethyst: 'Amethyst', starstone: 'Starstone',
};

export const GEM_GRADE_LABELS: Readonly<Record<GemGrade, string>> = {
  tiny: 'Tiny', small: 'Small', big: 'Big', giant: 'Giant', perfect: 'Perfect',
};

/** The highest grade whose first tier is at or below `level`; Tiny below tier 1. */
export function gemGradeFor(level: number): GemGrade {
  let grade: GemGrade = 'tiny';
  for (const g of GEM_GRADES) if (level >= GEM_GRADE_FROM_TIER[g]) grade = g;
  return grade;
}

export function gemName(g: Gem): string {
  return `${GEM_GRADE_LABELS[g.grade]} ${GEM_LABELS[g.gem]}`;
}

export const MATERIAL_LABELS: Readonly<Record<Material, string>> = {
  copper: 'Copper ore', tin: 'Tin ore', iron: 'Iron ore', silver: 'Silver ore', mithril: 'Mithril', starsteel: 'Starsteel',
  obsidian: 'Obsidian shard', voidCrystal: 'Void crystal',
};

/** A short, unitless name per stat. */
export const STAT_NAMES: Readonly<Record<StatKey, string>> = {
  digPower: 'Dig power', digPowerPct: 'Dig power %', goldYield: 'Gold yield', diamondYield: 'Diamond yield', veinYield: 'Vein yield',
  autoTickRate: 'Auto tick rate', ticksPerClick: 'Ticks per click', sellBonus: 'Sell bonus',
  chestFind: 'Chest find', gemFind: 'Gem find', mapFind: 'Map find', oreFind: 'Ore find', lampSight: 'Lamp sight',
  offlineCap: 'Offline cap', hazardWard: 'Hazard ward', salvageYield: 'Salvage yield',
  damage: 'Damage', damagePct: 'Damage %', elementalDamage: 'Elemental damage', attackSpeed: 'Attack speed', critChance: 'Crit chance',
  critMultiplier: 'Critical damage', life: 'Life', lifePct: 'Life %', cleave: 'Cleave efficiency',
  armor: 'Armor', armorPct: 'Armor %', resistAll: 'All resistances', maxResist: 'Max resistances', lifeRegen: 'Life regen', lifeOnKill: 'Life on kill',
  soulFind: 'Soul find', magicFind: 'Magic find', xpFind: 'XP',
};

export function itemName(item: Item): string {
  switch (item.type) {
    case 'gear': return item.name;
    case 'gem': return gemName(item);
    case 'rune': return RUNE_LABELS[item.rune];
    case 'material': return MATERIAL_LABELS[item.material];
    case 'orb': return orbName(item);
    case 'map':
      // the rarity leads, so a grid cell's label tells an enchanted map from a plain one
      switch (item.rarity) {
        case 'normal': return `Tier ${item.tier} map`;
        case 'magic': return `Magic tier ${item.tier} map`;
        case 'rare': return `Rare tier ${item.tier} map`;
      }
  }
}
