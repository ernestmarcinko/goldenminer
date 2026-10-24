import { GEM_GRADES } from './items';
import type { Gem, GemGrade, GemType, GearSet, Item, Material, Slot, StatKey } from './items';
import { GEM_GRADE_FROM_TIER } from './balance';

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
  critMultiplier: 'Deadly', life: 'Hale', lifePct: 'Robust',
  armor: 'the Wall', armorPct: 'the Bulwark', resistAll: 'Warding', lifeRegen: 'Mending', lifeOnKill: 'the Leech',
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

export interface LegendaryDef {
  id: string; name: string; slot: Slot;
  lines: ({ stat: StatKey; scale: number } | { stat: StatKey; fixed: number })[];
}

export const LEGENDARIES: readonly LegendaryDef[] = [
  { id: 'deepdelver', name: 'Deepdelver', slot: 'pickaxe', lines: [
    { stat: 'digPower', scale: 1.5 }, { stat: 'ticksPerClick', fixed: 1 }, { stat: 'chestFind', fixed: -10 }] },
  { id: 'golddigger', name: 'The Golddigger', slot: 'gloves', lines: [
    { stat: 'goldYield', scale: 2 }, { stat: 'diamondYield', scale: 1 }] },
  { id: 'blackLantern', name: 'Black Lantern', slot: 'lamp', lines: [
    { stat: 'lampSight', fixed: 3 }, { stat: 'mapFind', scale: 1.5 }, { stat: 'gemFind', scale: 1 }] },
  { id: 'longVoyage', name: 'Long Voyage', slot: 'boots', lines: [
    { stat: 'offlineCap', fixed: 120 }, { stat: 'autoTickRate', scale: 1 }] },
  { id: 'bandOfTheDeep', name: 'Band of the Deep', slot: 'ring', lines: [
    { stat: 'critChance', scale: 1.5 }, { stat: 'life', scale: 1 }] },
  { id: 'wolfEye', name: 'Wolf Eye', slot: 'amulet', lines: [
    { stat: 'magicFind', scale: 2 }, { stat: 'soulFind', scale: 1.5 }] },
  { id: 'krakenLeather', name: 'Kraken Leather', slot: 'armor', lines: [
    { stat: 'armor', scale: 1.5 }, { stat: 'resistAll', scale: 1.5 }] },
  { id: 'peacemaker', name: 'The Peacemaker', slot: 'weapon', lines: [
    { stat: 'damage', scale: 1.5 }, { stat: 'attackSpeed', scale: 1.5 }] },
];

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

export function itemName(item: Item): string {
  switch (item.type) {
    case 'gear': return item.name;
    case 'gem': return gemName(item);
    case 'material': return MATERIAL_LABELS[item.material];
    case 'map': return `Tier ${item.tier} map`;
  }
}
