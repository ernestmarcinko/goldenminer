import type { GearItem, GemItem, GemType, GearSet, Slot, StatKey } from './items';

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

export const STAT_WORDS: Readonly<Record<StatKey, { prefix: string; suffix: string }>> = {
  digPower: { prefix: 'Sharp', suffix: 'the Mole' },
  goldYield: { prefix: 'Golden', suffix: 'Greed' },
  diamondYield: { prefix: 'Glittering', suffix: 'the Jeweler' },
  chestFind: { prefix: 'Lucky', suffix: 'Treasure' },
  gemFind: { prefix: 'Prismatic', suffix: 'Gems' },
  mapFind: { prefix: 'Wandering', suffix: 'the Explorer' },
  lampSight: { prefix: 'Bright', suffix: 'Vision' },
  ticksPerClick: { prefix: 'Eager', suffix: 'Haste' },
  autoTickRate: { prefix: 'Tireless', suffix: 'Toil' },
  offlineCap: { prefix: 'Patient', suffix: 'Dreams' },
  damage: { prefix: 'Heavy', suffix: 'Wounds' },
  damagePct: { prefix: 'Cruel', suffix: 'Ruin' },
  attackSpeed: { prefix: 'Swift', suffix: 'Speed' },
  life: { prefix: 'Hale', suffix: 'Vigor' },
  armor: { prefix: 'Sturdy', suffix: 'the Wall' },
  critChance: { prefix: 'Keen', suffix: 'Precision' },
  resistAll: { prefix: 'Warded', suffix: 'Warding' },
  soulFind: { prefix: 'Grim', suffix: 'Souls' },
  magicFind: { prefix: 'Gleaming', suffix: 'Plunder' },
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

export const GEM_SIZES: readonly (readonly [number, string])[] = [
  [1, 'Tiny'], [4, 'Small'], [7, 'Big'], [10, 'Giant'], [15, 'Perfect'],
];

export function gemSizeName(ilvl: number): string {
  let name = 'Tiny';
  for (const [from, label] of GEM_SIZES) if (ilvl >= from) name = label;
  return name;
}

export function gemName(gem: GemItem): string {
  return `${gemSizeName(gem.ilvl)} ${GEM_LABELS[gem.gem]}`;
}

export function itemName(item: GearItem | GemItem): string {
  return item.type === 'gear' ? item.name : gemName(item);
}
