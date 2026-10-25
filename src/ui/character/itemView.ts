import { hardness, MATERIAL_TABLE, TICKS_PER_METRE_AT_PARITY } from '../../core/balance';
import { GEM_GRADE_LABELS, gemName, itemName } from '../../core/itemData';
import { BATTLE_STATS, MOD_SIDE, isGear, setOfSlot } from '../../core/items';
import type { GearItem, GemType, Item, MapItem, Material, ModLine, Slot, StatKey } from '../../core/items';
import { gemEffect, itemTotals } from '../../core/stats';
import type { GameState, LootNote, Stats } from '../../core/types';
import type { SpriteName } from '../../sprites/atlas';
import { formatDuration, formatNumber, formatRate, plural } from '../format';
import { mapDungeon, mapModLines } from '../run/runView';

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
  hazardWard: { label: 'hazard ward', unit: '%' },
  digPowerPct: { label: 'dig power', unit: '%' },
  veinYield: { label: 'vein yield', unit: '%' },
  oreFind: { label: 'ore find', unit: '%' },
  salvageYield: { label: 'salvage yield', unit: '%' },
  sellBonus: { label: 'Gold from selling', unit: '%' },
  damage: { label: 'damage', unit: '' },
  damagePct: { label: 'damage', unit: '%' },
  attackSpeed: { label: 'attack speed', unit: '%' },
  life: { label: 'life', unit: '' },
  armor: { label: 'armor', unit: '' },
  critChance: { label: 'crit chance', unit: '%' },
  resistAll: { label: 'all resistances', unit: '%' },
  soulFind: { label: 'Soul find', unit: '%' },
  magicFind: { label: 'magic find', unit: '%' },
  elementalDamage: { label: 'elemental damage', unit: '' },
  critMultiplier: { label: 'critical damage', unit: '%' },
  lifePct: { label: 'life', unit: '%' },
  armorPct: { label: 'armor', unit: '%' },
  lifeRegen: { label: 'life per second', unit: '' },
  lifeOnKill: { label: 'life per kill', unit: '' },
  xpFind: { label: 'XP', unit: '%' },
};

export function statText(stat: StatKey, value: number): string {
  const { label, unit } = STAT_LABELS[stat];
  const sign = value < 0 ? '−' : '+';
  const n = formatNumber(Math.abs(value));
  return unit === '%' ? `${sign}${n}% ${label}` : unit !== '' ? `${sign}${n}${unit} ${label}` : `${sign}${n} ${label}`;
}

const lineText = (l: { stat: StatKey; value: number }): string => statText(l.stat, l.value);

/** A legendary's hand-written lines have no tier to show. */
function modText(l: ModLine, legendary: boolean): string {
  const text = legendary ? lineText(l) : `T${formatNumber(l.tier)} ${lineText(l)}`;
  return l.crafted ? `${text} (crafted)` : text;
}

/** Prefixes first, then suffixes, then crafted lines, each group in its rolled order. */
function cardOrder(lines: readonly ModLine[]): ModLine[] {
  const rank = (l: ModLine) => (l.crafted ? 2 : MOD_SIDE[l.stat] === 'prefix' ? 0 : 1);
  return [...lines].sort((a, b) => rank(a) - rank(b));
}

export type Tone = 'plain' | 'up' | 'down' | 'gem' | 'muted';
export interface ViewLine { text: string; tone: Tone }

/** An enchanted map takes the gear colour of its rarity; a normal map keeps the map colour. */
export function rarityOf(item: Item): GearItem['rarity'] | 'gem' | 'material' | 'map' {
  if (item.type === 'map') return item.rarity === 'normal' ? 'map' : item.rarity;
  return isGear(item) ? item.rarity : item.type;
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Gear's rarity, slot and item level, e.g. "Rare gloves · item level 7". */
export function gearKindBase(item: GearItem): string {
  return `${capitalise(item.rarity)} ${SLOT_LABELS[item.slot].toLowerCase()} · item level ${formatNumber(item.ilvl)}`;
}

export function itemKindLine(item: Item): string {
  if (item.type === 'map') {
    const tier = `tier ${formatNumber(item.tier)} map`;
    return item.rarity === 'normal' ? capitalise(tier) : `${capitalise(item.rarity)} ${tier}`;
  }
  if (item.type === 'material') return 'Crafting material';
  if (item.type === 'gem') {
    const base = `Gem · ${GEM_GRADE_LABELS[item.grade]} · socket into any gear`;
    return item.count > 1 ? `${base} · ${formatNumber(item.count)} in this stack` : base;
  }
  const base = gearKindBase(item);
  return item.sockets > 0 ? `${base} · ${formatNumber(item.gems.length)}/${formatNumber(item.sockets)} sockets` : base;
}

/** A card's name and kind line: a map is named after the dungeon it opens into, and counts its rooms. */
export function cardHead(seed: number, item: Item): { name: string; kind: string } {
  if (item.type !== 'map') return { name: itemName(item), kind: itemKindLine(item) };
  const { type } = mapDungeon(seed, item);
  return { name: type.name, kind: `${itemKindLine(item)} · ${plural(type.rooms, 'room', 'rooms')}` };
}

/** A map's modifiers with their tiers, in their rolled order, and what they pay; then where it was found. */
function mapLines(map: MapItem): ViewLine[] {
  const lines: ViewLine[] = mapModLines(map).map((text) => ({ text, tone: 'plain' }));
  lines.push({ text: `Found at ${formatNumber(map.metre)} m`, tone: 'plain' });
  if (map.sealed) lines.push({ text: 'Tempered: it can\'t be enchanted any more.', tone: 'muted' });
  return lines;
}

export function itemLines(item: Item): ViewLine[] {
  if (item.type === 'map') return mapLines(item);
  if (item.type === 'material') {
    const from = MATERIAL_TABLE[item.material].from;
    return [
      { text: from === 0 ? 'Found at every depth' : `First found below ${formatNumber(from)} m`, tone: 'plain' },
      { text: 'Kept for crafting.', tone: 'muted' },
      { text: "Drag it onto gear or a map, or pick it under Craft or Enchant in that item's card.", tone: 'muted' },
    ];
  }
  if (item.type === 'gem') {
    return [
      { text: `In mining gear: ${lineText(gemEffect(item, 'mining'))}`, tone: 'plain' },
      { text: `In battle gear: ${lineText(gemEffect(item, 'battle'))}`, tone: 'plain' },
    ];
  }
  const lines: ViewLine[] = [{ text: lineText(item.implicit), tone: item.implicit.value < 0 ? 'down' : 'plain' }];
  for (const a of cardOrder(item.affixes)) lines.push({ text: modText(a, item.rarity === 'legendary'), tone: a.value < 0 ? 'down' : 'plain' });
  const set = setOfSlot(item.slot);
  for (const g of item.gems) lines.push({ text: `${gemName(g)}: ${lineText(gemEffect(g, set))}`, tone: 'gem' });
  const empty = item.sockets - item.gems.length;
  if (empty > 0) lines.push({ text: plural(empty, 'empty socket', 'empty sockets'), tone: 'muted' });
  if (item.sealed) lines.push({ text: 'Tempered: it can\'t be crafted any more.', tone: 'muted' });
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
/** The space between an item and its card. */
const CARD_GAP = 4;

/** `minLeft` lets a wide card pair reach left of its container; the container's right edge still bounds it. */
export function placeTooltip(
  anchor: { left: number; top: number; width: number; height: number },
  containerWidth: number,
  width: number = TOOLTIP_WIDTH,
  minLeft = 0,
): { left: number; top: number } {
  return {
    left: Math.max(minLeft, Math.min(anchor.left, containerWidth - width)),
    top: anchor.top + anchor.height + CARD_GAP,
  };
}

/** A stretch of rows, top to bottom. */
export interface Span { top: number; bottom: number }

/**
 * An action card's top, so its bottom stays inside `view` (the rows that show): below its item when it fits there,
 * else above it, else pinned to the top of the view. A card taller than the view runs past its bottom, and the page
 * scrolls to the rest.
 */
export function placeCardTop(anchor: Span, height: number, view: Span): number {
  const below = anchor.bottom + CARD_GAP;
  if (below + height <= view.bottom) return below;
  const above = anchor.top - CARD_GAP - height;
  if (above >= view.top) return above;
  return view.top;
}

/** Where an action card's item is and which rows show, so the card can be fitted once its height is known. */
export interface CardFit { anchor: Span; view: Span }

/**
 * An action card's new top, or undefined to leave it where it is. It fits only when it opens on an item (a new
 * `fit`, after `fitted`): a craft keeps the card open and changes its height, and fitting it again would put another
 * button under the pointer. A card that grew runs down, over its item or past the view, and the page scrolls.
 */
export function fittedCardTop(fitted: CardFit | undefined, fit: CardFit | undefined, height: number): number | undefined {
  return fit === undefined || fit === fitted ? undefined : placeCardTop(fit.anchor, height, fit.view);
}

/**
 * The order of an open action card's craft slots, its Soul upgrade's first: the ones it has shown, in the order they
 * first showed, then any new ones. A craft that goes leaves its slot empty and the rest stay put, so no craft takes
 * another one's place under the pointer.
 */
export function craftSlots(was: readonly string[], now: readonly string[]): string[] {
  return [...was, ...now.filter((kind) => !was.includes(kind))];
}

/**
 * An action card's craft slots, measured down the card: where they start, and each slot's kind ('' when it is empty)
 * and top. A battle gear's Soul upgrade is the first slot, under the action id 'soulUpgrade', so an upgrade keeps its
 * button under the pointer as a craft does.
 */
export interface CraftGrid { top: number; kinds: string[]; tops: number[] }

/** The craft button under the pointer: its kind, its slot in the grid, and how far down the card and the grid it starts. */
export interface CraftAnchor { kind: string; slot: number; top: number; inGrid: number }

/** The anchor for a click on the `kind` craft, which must be in `grid`. */
export function craftAnchor(grid: CraftGrid, kind: string): CraftAnchor {
  const slot = grid.kinds.indexOf(kind);
  const top = grid.tops[slot] ?? grid.top;
  return { kind, slot, top, inGrid: top - grid.top };
}

/**
 * An open action card's top after a craft from it, and the anchor to keep from then on: the card moves so that the
 * clicked button stays under the pointer, and a second click does the same craft. The button is found again by its
 * kind, as a craft can bring or take away other crafts; when that craft is gone, it is its slot: empty, or the button
 * now in it, or when the grid got shorter, the slot's own place in it. There is no limit: pointer safety comes before the
 * card's name, which may move above the rows that show.
 */
export function anchorCraft(top: number, was: CraftAnchor, grid: CraftGrid): { top: number; anchor: CraftAnchor } {
  const found = grid.kinds.indexOf(was.kind);
  const slot = found >= 0 ? found : was.slot;
  const at = grid.tops[slot] ?? grid.top + was.inGrid;
  return { top: top + was.top - at, anchor: { kind: grid.kinds[slot] || was.kind, slot, top: at, inGrid: at - grid.top } };
}

/** An open action card's least height: the tallest it has been since it opened, so it never gets shorter. */
export function keptHeight(tallest: number, height: number): number {
  return Math.max(tallest, height);
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
