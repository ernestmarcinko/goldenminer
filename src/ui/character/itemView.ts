import { baseDamage, hardness, MATERIAL_TABLE, TICKS_PER_METRE_AT_PARITY } from '../../core/balance';
import { GEM_GRADE_LABELS, gemName, itemName } from '../../core/itemData';
import { BATTLE_STATS, MOD_SIDE, isGear, orbName, setOfSlot } from '../../core/items';
import type { GearItem, GemType, Item, MapItem, Material, ModLine, OrbFamily, OrbSide, OrbTier, Slot, StatKey } from '../../core/items';
import { RUNE_DESCRIPTIONS, RUNE_LABELS } from '../../core/runes';
import { gemEffect, itemTotals, weaponDamage } from '../../core/stats';
import type { GameState, LootNote, Stats } from '../../core/types';
import { UNIQUE_LINES, isLegendaryId } from '../../core/uniques';
import type { SpriteName } from '../../sprites/atlas';
import { formatDuration, formatNumber, formatRate, plural } from '../format';
import { mapDungeon, mapModLines, mapRewardsText, mapSpecialLine } from '../run/runView';

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
  maxResist: { label: 'maximum resistances', unit: '%' },
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

function modText(l: ModLine): string {
  return l.crafted ? `${lineText(l)} (crafted)` : lineText(l);
}

/** A modifier's line, its tier shown at the right; a legendary's hand-written lines have no tier to show. */
function modLine(l: ModLine, legendary: boolean): ViewLine {
  const tone: Tone = l.value < 0 ? 'down' : 'plain';
  return legendary ? { text: modText(l), tone } : { text: modText(l), tone, tier: l.tier };
}

/** Prefixes first, then suffixes, then crafted lines, each group in its rolled order. */
function cardOrder(lines: readonly ModLine[]): ModLine[] {
  const rank = (l: ModLine) => (l.crafted ? 2 : MOD_SIDE[l.stat] === 'prefix' ? 0 : 1);
  return [...lines].sort((a, b) => rank(a) - rank(b));
}

export type Tone = 'plain' | 'up' | 'down' | 'gem' | 'muted' | 'special';
/** `tier`: a modifier's tier, shown at the line's right edge. */
export interface ViewLine { text: string; tone: Tone; tier?: number }

/** An enchanted map takes the gear colour of its rarity; a normal map keeps the map colour. */
export function rarityOf(item: Item): GearItem['rarity'] | 'gem' | 'rune' | 'material' | 'map' {
  if (item.type === 'map') return item.rarity === 'normal' ? 'map' : item.rarity;
  if (isGear(item)) return item.rarity;
  if (item.type === 'orb') return 'material';
  return item.type;
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
  if (item.type === 'rune') {
    const base = `Rune · ${RUNE_LABELS[item.rune]} · socket into any gear`;
    return item.count > 1 ? `${base} · ${formatNumber(item.count)} in this stack` : base;
  }
  if (item.type === 'orb') {
    const base = orbName(item);
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
  const lines = mapModLines(map);
  const special = mapSpecialLine(map);
  if (special !== null) lines.push(special);
  const rewards = mapRewardsText(map);
  if (rewards !== '') lines.push({ text: rewards, tone: 'plain' });
  lines.push({ text: `Found at ${formatNumber(map.metre)} m`, tone: 'plain' });
  if (map.sealed) lines.push({ text: 'Tempered: it can\'t be enchanted any more.', tone: 'muted' });
  return lines;
}

export function itemLines(item: Item, level?: number): ViewLine[] {
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
  if (item.type === 'rune') {
    return [
      { text: RUNE_DESCRIPTIONS[item.rune], tone: 'special' },
      { text: 'Works for the whole character, once per kind, while worn.', tone: 'muted' },
    ];
  }
  if (item.type === 'orb') {
    const tier = item.tier === 'minor' ? 'low' : item.tier === 'normal' ? 'middle' : 'high';
    const bestOf = item.tier === 'minor' ? 1 : item.tier === 'normal' ? 2 : 3;
    const effect = item.family === 'craft'
      ? `Adds a random ${item.side}, or rerolls a chosen ${item.side}, in the ${tier} tier band.`
      : item.family === 'removal'
        ? `Removes one random ${item.side} ${item.tier === 'normal' ? 'at any tier' : `in the ${tier} tier band`}.`
        : `Rerolls every rolled value, keeping the best of ${bestOf}.`;
    return [
      { text: effect, tone: 'plain' },
      { text: 'Kept for crafting. Use its Craft action on gear, or the Refiner.', tone: 'muted' },
    ];
  }
  const lines: ViewLine[] = [{ text: lineText(item.implicit), tone: item.implicit.value < 0 ? 'down' : 'plain' }];
  // A weapon's overall damage: its flat (after its own damage%) laid on the base damage, shown as a range.
  if (item.slot === 'weapon' && level !== undefined) {
    const wd = weaponDamage(item);
    const base = baseDamage(level);
    lines.unshift({
      text: `Damage ${formatNumber(Math.round(base.min + wd))}–${formatNumber(Math.round(base.max + wd))}`,
      tone: 'plain',
    });
  }
  for (const a of cardOrder(item.affixes)) lines.push(modLine(a, item.rarity === 'legendary'));
  // A legendary's unique line has no tier; an id this build doesn't know has no line.
  if (item.rarity === 'legendary' && isLegendaryId(item.uniqueId)) lines.push({ text: UNIQUE_LINES[item.uniqueId], tone: 'special' });
  const set = setOfSlot(item.slot);
  for (const g of item.gems) {
    if ('rune' in g) lines.push({ text: `${RUNE_LABELS[g.rune]}: ${RUNE_DESCRIPTIONS[g.rune]}`, tone: 'special' });
    else lines.push({ text: `${gemName(g)}: ${lineText(gemEffect(g, set))}`, tone: 'gem' });
  }
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
/** How far inside the screen's edges a card stays. */
const SCREEN_MARGIN = 8;

/** A card's left edge on the screen: at its item's, moved left as far as it takes to keep it inside the screen. */
export function placeCardLeft(anchorLeft: number, width: number, viewportWidth: number, minLeft = SCREEN_MARGIN): number {
  return Math.max(minLeft, Math.min(anchorLeft, viewportWidth - width - SCREEN_MARGIN));
}

/** A stretch of rows, top to bottom. */
export interface Span { top: number; bottom: number }

/**
 * A card's top on the screen, so it stays inside `view`: below its item when it fits there, else above it when it fits
 * there, else on the side with more room, moved as far as it takes to fit. A card taller than the view starts at its
 * top.
 */
export function placeCardTop(anchor: Span, height: number, view: Span): number {
  const below = anchor.bottom + CARD_GAP;
  if (below + height <= view.bottom) return below;
  const above = anchor.top - CARD_GAP - height;
  if (above >= view.top) return above;
  const top = view.bottom - below >= anchor.top - CARD_GAP - view.top ? below : above;
  return Math.max(view.top, Math.min(top, view.bottom - height));
}

/**
 * The tallest an action card of `height` opens, or undefined when it fits the screen and shows whole. A card taller
 * than the screen would run off it, where its buttons could not be reached (the card is fixed on the screen), so it
 * scrolls inside, in the room on the larger side of its item, which it then never covers.
 */
export function cardMaxHeight(anchor: Span, view: Span, height: number): number | undefined {
  if (height <= view.bottom - view.top) return undefined;
  return Math.max(view.bottom - anchor.bottom - CARD_GAP, anchor.top - CARD_GAP - view.top);
}

/**
 * An open action card's scroll inside after a craft, when `anchorCraft` asks to move its box from `top` to `placed`: a
 * card that scrolls inside (one taller than the screen, capped) scrolls its content by as much instead, as far as
 * `maxScroll` lets it, and its box moves only by the rest. Either keeps the clicked button under the pointer; moving
 * a capped box would take its bottom, and the pointer's button with it, away from the pointer.
 */
export function cardScroll(top: number, placed: number, scroll: number, maxScroll: number): number {
  return Math.max(0, Math.min(maxScroll, scroll + top - placed));
}

/**
 * The part of an open action card that shows on the screen. The card would be at `top`, `height` tall, its content
 * running from `content.top` to `content.bottom` on the screen; after a craft (Plan 7's anchoring) or as its item
 * scrolls with the page, that can be past the screen's edge, where a fixed card could never be reached. So it shows
 * only what is on the screen and scrolls inside to the rest, its content left where it is: the clicked button stays
 * under the pointer, and the card's name, lines and Close can still be scrolled to.
 */
export function cardWindow(top: number, height: number, content: Span, view: Span): Span {
  const lo = Math.max(content.top, view.top);
  const hi = Math.min(content.bottom, view.bottom);
  const shown = Math.min(Math.max(top, lo), hi);
  return { top: shown, bottom: Math.min(Math.max(top + height, shown), hi) };
}

/**
 * Whether an open card's scroll moved since the card last set it (`was`) because the player scrolled it, so a craft
 * must not pull it back. A scroll the browser pulled back to the content's new end (`maxScroll`), after a craft made
 * the content shorter, is not the player's.
 */
export function userScrolled(was: number, now: number, maxScroll: number): boolean {
  if (Math.abs(now - was) <= 0.5) return false;
  return !(now < was && now >= maxScroll - 0.5);
}

/** Where a card's item is and which rows show, so the card can be fitted once its height is known. */
export interface CardFit { anchor: Span; view: Span }

/**
 * A card's new top, or undefined to leave it where it is. It fits only when it opens on an item (a new `fit`, after
 * `fitted`): a craft keeps an action card open and changes its height, and fitting it again would put another button
 * under the pointer. A card that grew runs down, over its item or past the screen's edge.
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

export type ClickIntent = 'card' | 'menu' | 'sell' | 'salvage' | 'move';

export interface ClickKeys {
  altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; detail: number; pointerType: string;
}

/**
 * What a click on an item asks for. A keyboard click (detail 0) and a touch open the action card; Ctrl+click sells,
 * Cmd+click on a Mac (`mac`), where Ctrl+click is the context menu.
 */
export function clickIntent(e: ClickKeys, mac: boolean): ClickIntent {
  if (e.pointerType === 'touch' || e.detail === 0) return 'menu';
  if (mac ? e.metaKey : e.ctrlKey) return 'sell';
  if (e.altKey) return 'salvage';
  if (e.shiftKey) return 'move';
  return 'card';
}

const SLOT_SPRITES: Readonly<Record<Slot, SpriteName>> = {
  pickaxe: 'pickaxe', lamp: 'lamphelm', gloves: 'gloves', boots: 'boots', weapon: 'maul', armor: 'armor',
  helm: 'helm', ring: 'ring', amulet: 'amulet',
};

/** Gems and materials have sprites named after them; gear by its slot. */
export function baseSprite(base: Slot | GemType | Material): SpriteName {
  return base in SLOT_SPRITES ? SLOT_SPRITES[base as Slot] : (base as GemType | Material);
}

/** The sprite of an orb: one per family, side and tier, recoloured by the tier. */
export function orbSprite(family: OrbFamily, side: OrbSide | undefined, tier: OrbTier): SpriteName {
  const base = family === 'craft'
    ? (side === 'prefix' ? 'orbPrefix' : 'orbSuffix')
    : family === 'removal'
      ? (side === 'prefix' ? 'orbSeverance' : 'orbUnmaking')
      : 'orbScatter';
  const suffix = tier === 'minor' ? 'Minor' : tier === 'normal' ? 'Normal' : 'Greater';
  return `${base}${suffix}` as SpriteName;
}

export function itemSprite(item: Item): SpriteName {
  switch (item.type) {
    case 'gear': return baseSprite(item.slot);
    case 'gem': return baseSprite(item.gem);
    case 'rune': return item.rune;
    case 'map': return 'map';
    case 'material': return baseSprite(item.material);
    case 'orb': return orbSprite(item.family, item.side, item.tier);
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
