import { hardness, MATERIAL_TABLE, TICKS_PER_METRE_AT_PARITY } from '../../core/balance';
import { GEM_GRADE_LABELS, gemName } from '../../core/itemData';
import { BATTLE_STATS, isGear, setOfSlot } from '../../core/items';
import type { GearItem, GemType, Item, Material, Slot, StatKey } from '../../core/items';
import { gemEffect, itemTotals } from '../../core/stats';
import type { GameState, LootNote, Stats } from '../../core/types';
import type { SpriteName } from '../../sprites/atlas';
import { formatDuration, formatNumber, formatRate, plural } from '../format';

export const SLOT_LABELS: Readonly<Record<Slot, string>> = {
  pickaxe: 'Pickaxe', lamp: 'Lamp helm', gloves: 'Gloves', boots: 'Boots', weapon: 'Weapon', armor: 'Armor',
  helm: 'Helm', ring: 'Ring', amulet: 'Amulet',
};

export const STAT_LABELS: Readonly<Record<StatKey, { label: string; unit: '' | '%' | ' m' | ' min' }>> = {
  digPower: { label: 'dig power', unit: '' },
  goldYield: { label: 'Gold yield', unit: '%' },
  diamondYield: { label: 'Diamond yield', unit: '%' },
  chestFind: { label: 'chest find', unit: '%' },
  gemFind: { label: 'gem find', unit: '%' },
  mapFind: { label: 'map find', unit: '%' },
  lampSight: { label: 'lamp sight', unit: ' m' },
  ticksPerClick: { label: 'tick per click', unit: '' },
  autoTickRate: { label: 'auto tick rate', unit: '%' },
  offlineCap: { label: 'offline cap', unit: ' min' },
  damage: { label: 'damage', unit: '' },
  damagePct: { label: 'damage', unit: '%' },
  attackSpeed: { label: 'attack speed', unit: '%' },
  life: { label: 'life', unit: '' },
  armor: { label: 'armor', unit: '' },
  critChance: { label: 'crit chance', unit: '%' },
  resistAll: { label: 'all resistances', unit: '%' },
  soulFind: { label: 'Soul find', unit: '%' },
  magicFind: { label: 'magic find', unit: '%' },
};

export function statText(stat: StatKey, value: number): string {
  const { label, unit } = STAT_LABELS[stat];
  const sign = value < 0 ? '−' : '+';
  const n = formatNumber(Math.abs(value));
  return unit === '%' ? `${sign}${n}% ${label}` : unit !== '' ? `${sign}${n}${unit} ${label}` : `${sign}${n} ${label}`;
}

const lineText = (l: { stat: StatKey; value: number }): string => statText(l.stat, l.value);

export type Tone = 'plain' | 'up' | 'down' | 'gem' | 'muted';
export interface ViewLine { text: string; tone: Tone }

export function rarityOf(item: Item): GearItem['rarity'] | 'gem' | 'material' | 'map' {
  return isGear(item) ? item.rarity : item.type;
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function itemKindLine(item: Item): string {
  if (item.type === 'map') return `Tier ${formatNumber(item.tier)} map`;
  if (item.type === 'material') return 'Crafting material';
  if (item.type === 'gem') {
    const base = `Gem · ${GEM_GRADE_LABELS[item.grade]} · socket into any gear`;
    return item.count > 1 ? `${base} · ${formatNumber(item.count)} in this stack` : base;
  }
  const base = `${capitalise(item.rarity)} ${SLOT_LABELS[item.slot].toLowerCase()} · item level ${formatNumber(item.ilvl)}`;
  return item.sockets > 0 ? `${base} · ${formatNumber(item.gems.length)}/${formatNumber(item.sockets)} sockets` : base;
}

export function itemLines(item: Item): ViewLine[] {
  if (item.type === 'map') return [{ text: `Found at ${formatNumber(item.metre)} m`, tone: 'plain' }];
  if (item.type === 'material') {
    const from = MATERIAL_TABLE[item.material].from;
    return [
      { text: from === 0 ? 'Found at every depth' : `First found below ${formatNumber(from)} m`, tone: 'plain' },
      { text: 'Kept for crafting.', tone: 'muted' },
    ];
  }
  if (item.type === 'gem') {
    return [
      { text: `In mining gear: ${lineText(gemEffect(item, 'mining'))}`, tone: 'plain' },
      { text: `In battle gear: ${lineText(gemEffect(item, 'battle'))}`, tone: 'plain' },
    ];
  }
  const lines: ViewLine[] = [{ text: lineText(item.implicit), tone: item.implicit.value < 0 ? 'down' : 'plain' }];
  for (const a of item.affixes) lines.push({ text: lineText(a), tone: a.value < 0 ? 'down' : 'plain' });
  const set = setOfSlot(item.slot);
  for (const g of item.gems) lines.push({ text: `${gemName(g)}: ${lineText(gemEffect(g, set))}`, tone: 'gem' });
  const empty = item.sockets - item.gems.length;
  if (empty > 0) lines.push({ text: plural(empty, 'empty socket', 'empty sockets'), tone: 'muted' });
  return lines;
}

export function compareLines(item: GearItem, worn: GearItem | undefined): { title: string; lines: ViewLine[] } {
  const next = itemTotals(item);
  const cur = worn ? itemTotals(worn) : {};
  const keys = [...(Object.keys(next) as StatKey[]), ...(Object.keys(cur) as StatKey[]).filter((k) => !(k in next))];
  const lines: ViewLine[] = [];
  for (const k of keys) {
    const delta = (next[k] ?? 0) - (cur[k] ?? 0);
    if (delta !== 0) lines.push({ text: statText(k, delta), tone: delta > 0 ? 'up' : 'down' });
  }
  return {
    title: worn ? `If equipped, instead of ${worn.name}:` : 'If equipped (the slot is empty):',
    lines,
  };
}

export function miningStatLine(stats: Stats, deepest: number): string {
  const perMin = (stats.autoTicksPerSecond * 60 * stats.digPower) / (hardness(deepest + 1) * TICKS_PER_METRE_AT_PARITY);
  const fc = stats.featureChances;
  return `Dig ${formatRate(perMin)} m/min · chest find ${formatRate(fc.chest * 100)}% · gem find ${formatRate(fc.gem * 100)}%`
    + ` · map find ${formatRate(fc.map * 100)}% · lamp sight ${formatNumber(stats.lampSight)} m`
    + ` · offline cap ${formatDuration(stats.offlineCapMs)}`;
}

export function battleStatLine(totals: Readonly<Record<StatKey, number>>): string {
  const parts = BATTLE_STATS.filter((s) => totals[s] !== 0).map((s) => statText(s, totals[s]));
  return `Battle gear: ${parts.length > 0 ? parts.join(' · ') : 'nothing equipped yet'}`;
}

export const TOOLTIP_WIDTH = 270;
/** The space between a hovered card and the worn item's card beside it. */
export const CARD_PAIR_GAP = 8;
const CARD_PAIR_MIN_VIEWPORT = 900;

/** `minLeft` lets a wide card pair reach left of its container; the container's right edge still bounds it. */
export function placeTooltip(
  anchor: { left: number; top: number; width: number; height: number },
  containerWidth: number,
  width: number = TOOLTIP_WIDTH,
  minLeft = 0,
): { left: number; top: number } {
  return {
    left: Math.max(minLeft, Math.min(anchor.left, containerWidth - width)),
    top: anchor.top + anchor.height + 4,
  };
}

/** The worn item's card goes beside a hover card on a wide screen, and inside any other card. */
export function cardPairLayout(viewportWidth: number, isMenu: boolean): 'row' | 'column' {
  return !isMenu && viewportWidth >= CARD_PAIR_MIN_VIEWPORT ? 'row' : 'column';
}

/** The worn item that `item` would replace, when `item` is gear that is not itself worn. */
export function wornToCompare(state: GameState, item: Item, isWorn: boolean): GearItem | undefined {
  return isGear(item) && !isWorn ? state.equipped[setOfSlot(item.slot)][item.slot] : undefined;
}

export type ClickIntent = 'primary' | 'sell' | 'move' | 'menu';

export function clickIntent(e: { altKey: boolean; shiftKey: boolean; detail: number; pointerType: string }): ClickIntent {
  if (e.pointerType === 'touch' || e.detail === 0) return 'menu';
  if (e.altKey) return 'sell';
  if (e.shiftKey) return 'move';
  return 'primary';
}

const SLOT_SPRITES: Readonly<Record<Slot, SpriteName>> = {
  pickaxe: 'pickaxe', lamp: 'lamphelm', gloves: 'gloves', boots: 'boots', weapon: 'maul', armor: 'armor',
  helm: 'helm', ring: 'ring', amulet: 'amulet',
};

/** Gems and materials have sprites named after them; gear by its slot. */
export function baseSprite(base: Slot | GemType | Material): SpriteName {
  return base in SLOT_SPRITES ? SLOT_SPRITES[base as Slot] : (base as GemType | Material);
}

export function itemSprite(item: Item): SpriteName {
  switch (item.type) {
    case 'gear': return baseSprite(item.slot);
    case 'gem': return baseSprite(item.gem);
    case 'map': return 'map';
    case 'material': return baseSprite(item.material);
  }
}

export function lootNoteText(note: LootNote): string {
  switch (note.outcome) {
    case 'bag':
    case 'stash':
      // The note's name is already the material, so the text says only how many and where they went.
      if (note.rarity === 'material') return `×${formatNumber(note.value)} ${note.outcome === 'bag' ? 'to bag' : 'to Materials tab'}`;
      return note.outcome === 'bag' ? 'to bag' : 'to stash';
    case 'sold': return `sold +${formatNumber(note.value)} Gold`;
    case 'salvaged': return `salvaged into ${plural(note.value, 'material', 'materials')}`;
    case 'held': return 'waiting for space';
  }
}
