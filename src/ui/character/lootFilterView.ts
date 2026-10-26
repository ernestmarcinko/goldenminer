import { MAX_LOOT_RULES } from '../../core/balance';
import { GEM_GRADE_LABELS, GEM_LABELS, MATERIAL_LABELS } from '../../core/itemData';
import { BATTLE_SLOTS, GEM_GRADES, GEM_TYPES, MAP_MOD_KINDS, MATERIALS, MINING_SLOTS, setOfSlot } from '../../core/items';
import type { GearSet, Rarity, Slot } from '../../core/items';
import { MAP_MOD_LABELS } from '../../core/mapMods';
import type { LootAction, LootKind, LootRange, LootRule } from '../../core/types';
import { SLOT_LABELS } from './itemView';

export interface Option<T> { value: T; label: string }

/** A new rule keeps gear, which is what a find no rule matches gets anyway: adding it at the end changes nothing. */
export const NEW_RULE: LootRule = { kind: 'gear', action: 'keep' };

export const KIND_OPTIONS: readonly Option<LootKind | 'any'>[] = [
  { value: 'any', label: 'Any item' },
  { value: 'gear', label: 'Gear' },
  { value: 'gem', label: 'Gems' },
  { value: 'map', label: 'Maps' },
  { value: 'material', label: 'Materials' },
];

export const ACTION_OPTIONS: readonly Option<LootAction>[] = [
  { value: 'keep', label: 'Keep' },
  { value: 'sell', label: 'Sell for Gold' },
  { value: 'salvage', label: 'Salvage for materials' },
  { value: 'stash', label: 'Stash in its tab' },
];
const MATERIAL_ACTION_OPTIONS = ACTION_OPTIONS.filter((o) => o.value === 'keep' || o.value === 'stash');

/** Materials are crafting currency: they are only ever kept or stashed. */
export const actionOptionsFor = (kind: LootKind | 'any'): readonly Option<LootAction>[] =>
  kind === 'material' ? MATERIAL_ACTION_OPTIONS : ACTION_OPTIONS;

const ANY: Option<'any'> = { value: 'any', label: 'Any' };
const anyFirst = <T extends string>(order: readonly T[], label: (v: T) => string): readonly Option<T | 'any'>[] =>
  [ANY, ...order.map((value) => ({ value, label: label(value) }))];

export const SET_OPTIONS = anyFirst<GearSet>(['mining', 'battle'], (s) => (s === 'mining' ? 'Mining' : 'Battle'));
export const SLOT_OPTIONS = anyFirst([...MINING_SLOTS, ...BATTLE_SLOTS], (s) => SLOT_LABELS[s]);
const SET_SLOT_OPTIONS: Readonly<Record<GearSet, readonly Option<Slot | 'any'>[]>> = {
  mining: anyFirst(MINING_SLOTS, (s) => SLOT_LABELS[s]),
  battle: anyFirst(BATTLE_SLOTS, (s) => SLOT_LABELS[s]),
};
const RARITY_LABELS: Readonly<Record<Rarity, string>> = { normal: 'Normal', magic: 'Magic', rare: 'Rare', legendary: 'Legendary' };
export const RARITY_OPTIONS = anyFirst<Rarity>(['normal', 'magic', 'rare', 'legendary'], (r) => RARITY_LABELS[r]);
const MAP_RARITY_OPTIONS = RARITY_OPTIONS.filter((o) => o.value !== 'legendary');
export const GEM_OPTIONS = anyFirst(GEM_TYPES, (g) => GEM_LABELS[g]);
export const GRADE_OPTIONS = anyFirst(GEM_GRADES, (g) => GEM_GRADE_LABELS[g]);
export const MATERIAL_OPTIONS = anyFirst(MATERIALS, (m) => MATERIAL_LABELS[m]);
export const MAP_MOD_OPTIONS = anyFirst(MAP_MOD_KINDS, (k) => MAP_MOD_LABELS[k]);

/** A set narrows the slots to its own, so the editor never pairs a set with a slot of the other one. */
export function slotOptionsFor(rule: LootRule): readonly Option<Slot | 'any'>[] {
  return rule.set === undefined ? SLOT_OPTIONS : SET_SLOT_OPTIONS[rule.set];
}

/** Maps have no legendaries; a map rule that came over from gear still lists it, so its problem can be read and fixed. */
export function rarityOptionsFor(rule: LootRule): readonly Option<Rarity | 'any'>[] {
  return rule.kind === 'map' && rule.rarity !== 'legendary' ? MAP_RARITY_OPTIONS : RARITY_OPTIONS;
}

export type RuleField = 'set' | 'slot' | 'rarity' | 'level' | 'modTier' | 'mods' | 'mapMod' | 'gem' | 'grade' | 'material';

const KIND_FIELDS: Readonly<Record<LootKind | 'any', readonly RuleField[]>> = {
  gear: ['set', 'slot', 'rarity', 'level', 'modTier', 'mods'],
  map: ['rarity', 'level', 'modTier', 'mods', 'mapMod'],
  gem: ['gem', 'grade'],
  material: ['material'],
  any: ['rarity', 'level', 'modTier', 'mods'],
};

/** The fields the editor shows for a kind, in order. */
export const fieldsFor = (kind: LootKind | 'any'): readonly RuleField[] => KIND_FIELDS[kind];

/** The rule as the new kind: the fields that kind shows, and its action when the kind allows it, else Keep. */
export function withKind(rule: LootRule, kind: LootKind | 'any'): LootRule {
  const action = actionOptionsFor(kind).some((o) => o.value === rule.action) ? rule.action : 'keep';
  const next: LootRule = { kind, action };
  for (const field of fieldsFor(kind)) if (rule[field] !== undefined) Object.assign(next, { [field]: rule[field] });
  return next;
}

/** What `level` reads for the kind: gear's item level, a map's tier, or either. */
export function levelLabel(kind: LootKind | 'any'): string {
  return kind === 'map' ? 'Tier' : kind === 'any' ? 'Item level or tier' : 'Item level';
}

type PickField = 'set' | 'slot' | 'rarity' | 'mapMod' | 'gem' | 'grade' | 'material';

/** The rule with one select's pick; Any clears the field. A slot of the other set moves the set with it. */
export function withPick<F extends PickField>(rule: LootRule, field: F, value: NonNullable<LootRule[F]> | 'any'): LootRule {
  const next: LootRule = { ...rule };
  if (value === 'any') delete next[field];
  else Object.assign(next, { [field]: value });
  if (field === 'set' && next.set !== undefined && next.slot !== undefined && setOfSlot(next.slot) !== next.set) delete next.slot;
  if (field === 'slot' && next.set !== undefined && next.slot !== undefined) next.set = setOfSlot(next.slot);
  return next;
}

// A whole number at or above `least`, or nothing: an empty box, a fraction or a word clears the field.
function parseCount(text: string, least: number): number | undefined {
  const t = text.trim();
  const n = Number(t);
  return t !== '' && Number.isInteger(n) && n >= least ? n : undefined;
}

// An item level or a tier is never below 1, so a lower bound there could never match.
const RANGE_LEAST: Readonly<Record<'level' | 'mods', number>> = { level: 1, mods: 0 };

/** The rule with one end of a range typed in; an empty or non-numeric text clears that end, and a range with none goes. */
export function setRange(rule: LootRule, field: 'level' | 'mods', end: 'min' | 'max', text: string): LootRule {
  const n = parseCount(text, RANGE_LEAST[field]);
  const range: LootRange = { ...rule[field] };
  if (n === undefined) delete range[end];
  else range[end] = n;
  const next: LootRule = { ...rule };
  if (range.min === undefined && range.max === undefined) delete next[field];
  else next[field] = range;
  return next;
}

/** The rule with a modifier tier typed in: a whole number of 1 or more, else none. */
export function withModTier(rule: LootRule, text: string): LootRule {
  const { modTier: _old, ...rest } = rule;
  const n = parseCount(text, 1);
  return n === undefined ? rest : { ...rest, modTier: n };
}

/** The editor's number boxes: each end of the two ranges, and the modifier tier. */
export type NumberBox = 'level.min' | 'level.max' | 'mods.min' | 'mods.max' | 'modTier';
const BOX_FIELD: Readonly<Record<NumberBox, RuleField>> = {
  'level.min': 'level', 'level.max': 'level', 'mods.min': 'mods', 'mods.max': 'mods', modTier: 'modTier',
};
const BOX_LEAST: Readonly<Record<NumberBox, number>> = { 'level.min': 1, 'level.max': 1, 'mods.min': 0, 'mods.max': 0, modTier: 1 };

/** Whether a box's text is something the rule can't take: not empty, and not a whole number at or above its least. */
export const boxRejects = (box: NumberBox, text: string): boolean => text.trim() !== '' && parseCount(text, BOX_LEAST[box]) === undefined;

/** The box texts the kind still shows; `withKind` drops the others' fields, so their texts go with them. */
export function boxTextsFor(texts: Readonly<Partial<Record<NumberBox, string>>>, kind: LootKind | 'any'): Partial<Record<NumberBox, string>> {
  const shown = fieldsFor(kind);
  return Object.fromEntries((Object.entries(texts) as [NumberBox, string][]).filter(([box]) => shown.includes(BOX_FIELD[box])));
}

/**
 * A line when a box the kind shows holds text the rule can't take. The box keeps what was typed, so the player sees
 * what was refused; the rule holds no bound there meanwhile.
 */
export function boxProblems(texts: Readonly<Partial<Record<NumberBox, string>>>, kind: LootKind | 'any'): string[] {
  const shown = fieldsFor(kind);
  const bad = (Object.entries(texts) as [NumberBox, string][]).some(([box, text]) => shown.includes(BOX_FIELD[box]) && boxRejects(box, text));
  return bad ? ['Use whole numbers; an item level or tier starts at 1.'] : [];
}

const isOrdered = (range: LootRange | undefined): boolean =>
  range?.min === undefined || range.max === undefined || range.min <= range.max;

/**
 * Why a rule can't be saved, a line per failing check. For any rule the editor makes, `ruleValid` holds exactly when
 * this is empty: the editor only shows the fields that fit the kind, which is the rest of what `ruleValid` checks.
 */
export function ruleProblems(rule: LootRule): string[] {
  const problems: string[] = [];
  if ((rule.kind === 'material' || rule.material !== undefined) && (rule.action === 'sell' || rule.action === 'salvage')) {
    problems.push('Materials can\'t be sold or salvaged.');
  }
  if (rule.kind === 'map' && rule.rarity === 'legendary') problems.push('Legendary doesn\'t apply to maps.');
  if (!isOrdered(rule.level) || !isOrdered(rule.mods)) problems.push('The low end is above the high end.');
  return problems;
}

/** A row of the dialog's list: a rule, or null where one was removed, so the rows under it never move up. */
export type RuleRow = LootRule | null;

export const rowsOf = (rules: readonly LootRule[]): RuleRow[] => [...rules];

export const rulesOf = (rows: readonly RuleRow[]): LootRule[] => rows.filter((r): r is LootRule => r !== null);

export const removeRow = (rows: readonly RuleRow[], i: number): RuleRow[] => rows.map((r, j) => (j === i ? null : r));

/** Where a move from row `i` lands: the nearest rule in that direction, over empty rows; undefined when there is none. */
export function moveTarget(rows: readonly RuleRow[], i: number, delta: number): number | undefined {
  const step = Math.sign(delta);
  if (rows[i] == null || step === 0) return undefined;
  let j = i + step;
  while (rows[j] === null) j += step;
  return rows[j] === undefined ? undefined : j;
}

/** Swaps a rule with the nearest rule in that direction, over empty rows; the same array when there is none. */
export function moveRow(rows: readonly RuleRow[], i: number, delta: number): readonly RuleRow[] {
  const j = moveTarget(rows, i, delta);
  if (j === undefined) return rows;
  const next = [...rows];
  [next[i], next[j]] = [rows[j] ?? null, rows[i] ?? null];
  return next;
}

/** Appends a new rule, unless the filter holds the most it may; then the same array. */
export function addRow(rows: readonly RuleRow[]): readonly RuleRow[] {
  return rulesOf(rows).length >= MAX_LOOT_RULES ? rows : [...rows, NEW_RULE];
}

export { MAP_MOD_LABELS };
