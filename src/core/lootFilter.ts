import { MAX_LOOT_RULES } from './balance';
import { GEM_GRADE_LABELS, MATERIAL_LABELS } from './itemData';
import { BATTLE_SLOTS, GEAR_SETS, MINING_SLOTS, RARITIES, setOfSlot } from './items';
import type { GearSet, GemType, Item, Rarity, RuneType, Slot } from './items';
import { MAP_MOD_LABELS } from './mapMods';
import { RUNE_LABELS } from './runes';
import type { LootAction, LootKind, LootRange, LootRule } from './types';

/** No rules: every find is kept, as the game has always done. */
export const DEFAULT_LOOT_FILTER: readonly LootRule[] = [];

const inRange = (range: LootRange, n: number): boolean => (range.min ?? n) <= n && n <= (range.max ?? n);

// What `level` reads: gear's item level or a map's tier. Gems, runes and materials have none.
function levelOf(item: Item): number | undefined {
  switch (item.type) {
    case 'gear': return item.ilvl;
    case 'map': return item.tier;
    case 'gem':
    case 'rune':
    case 'material':
    case 'orb': return undefined;
  }
}

// What `modTier` and `mods` read: gear's lines (crafted ones included) or a map's modifiers.
function modsOf(item: Item): readonly { tier: number }[] | undefined {
  switch (item.type) {
    case 'gear': return item.affixes;
    case 'map': return item.mods;
    case 'gem':
    case 'rune':
    case 'material':
    case 'orb': return undefined;
  }
}

/** Whether every field the rule sets holds for the item; a field that does not apply to the item's kind fails. */
export function ruleMatches(rule: LootRule, item: Item): boolean {
  if (rule.kind !== 'any' && rule.kind !== item.type) return false;
  // materials are crafting currency: a catch-all that sells or salvages passes them by
  if (item.type === 'material' && (rule.action === 'sell' || rule.action === 'salvage')) return false;
  const gear = item.type === 'gear' ? item : undefined;
  if (rule.set !== undefined && (gear === undefined || setOfSlot(gear.slot) !== rule.set)) return false;
  if (rule.slot !== undefined && gear?.slot !== rule.slot) return false;
  if (rule.rarity !== undefined && !((item.type === 'gear' || item.type === 'map') && item.rarity === rule.rarity)) return false;
  const level = levelOf(item);
  if (rule.level !== undefined && (level === undefined || !inRange(rule.level, level))) return false;
  const mods = modsOf(item);
  const { modTier, modTierGap } = rule;
  if (modTier !== undefined && (mods === undefined || !mods.some((m) => m.tier >= modTier))) return false;
  // `modTierGap`: every modifier sits at or above the item's top tier (its level for gear, its tier for a map) minus the
  // gap. A gap of 0 keeps only items whose every modifier rolled the very top tier.
  if (modTierGap !== undefined) {
    if (mods === undefined || level === undefined || mods.length === 0) return false;
    if (!mods.every((m) => m.tier >= level - modTierGap)) return false;
  }
  if (rule.mods !== undefined && (mods === undefined || !inRange(rule.mods, mods.length))) return false;
  if (rule.mapMod !== undefined && !(item.type === 'map' && item.mods.some((m) => m.kind === rule.mapMod))) return false;
  if (rule.gem !== undefined && !(item.type === 'gem' && item.gem === rule.gem)) return false;
  if (rule.grade !== undefined && !(item.type === 'gem' && item.grade === rule.grade)) return false;
  if (rule.rune !== undefined && !(item.type === 'rune' && item.rune === rule.rune)) return false;
  return rule.material === undefined || (item.type === 'material' && item.material === rule.material);
}

const ACTION_WORDS: Readonly<Record<LootAction, string>> = { keep: 'Keep', sell: 'Sell', salvage: 'Salvage', stash: 'Stash' };
const KIND_WORDS: Readonly<Record<LootKind | 'any', string>> = { gear: 'gear', gem: 'gems', rune: 'runes', map: 'maps', material: 'materials', any: 'items' };
const SLOT_WORDS: Readonly<Record<Slot, string>> = {
  pickaxe: 'pickaxes', lamp: 'lamp helms', gloves: 'gloves', boots: 'boots', weapon: 'weapons', armor: 'armor', helm: 'helms',
  ring: 'rings', amulet: 'amulets',
};
const GEM_WORDS: Readonly<Record<GemType, string>> = {
  ruby: 'rubies', sapphire: 'sapphires', emerald: 'emeralds', amethyst: 'amethysts', starstone: 'starstones',
};
const RUNE_WORDS: Readonly<Record<RuneType, string>> = {
  fehu: 'Fehu runes', uruz: 'Uruz runes', thurisaz: 'Thurisaz runes', ansuz: 'Ansuz runes', raidho: 'Raidho runes',
  kenaz: 'Kenaz runes', gebo: 'Gebo runes', wunjo: 'Wunjo runes', hagalaz: 'Hagalaz runes', isa: 'Isa runes',
};

// A range in words: `4 to 6`, `4 or more`, `up to 6`, or one number when both ends are it.
function rangeWords(range: LootRange): string | undefined {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) return min === max ? `${min}` : `${min} to ${max}`;
  if (min !== undefined) return `${min} or more`;
  return max !== undefined ? `up to ${max}` : undefined;
}

/**
 * A rule as a sentence: the action, the kind narrowed by rarity, set, slot, gem and material, then a clause for each of
 * the level, modifier tier, modifier count and map modifier, as in `Stash rare gear, item level 4 or more`.
 */
export function describeRule(rule: LootRule): string {
  const grade = rule.grade !== undefined ? GEM_GRADE_LABELS[rule.grade].toLowerCase() : undefined;
  const noun = rule.slot !== undefined ? SLOT_WORDS[rule.slot]
    : rule.gem !== undefined ? GEM_WORDS[rule.gem]
    : rule.rune !== undefined ? RUNE_WORDS[rule.rune]
    : rule.material !== undefined ? MATERIAL_LABELS[rule.material]
    : grade !== undefined ? 'gems'
    : KIND_WORDS[rule.kind];
  const subject = [rule.rarity, rule.set, grade, noun].filter((w) => w !== undefined).join(' ');
  const clauses: string[] = [];
  const level = rule.level !== undefined ? rangeWords(rule.level) : undefined;
  if (level !== undefined) clauses.push(`${rule.kind === 'map' ? 'tier' : 'item level'} ${level}`);
  if (rule.modTier !== undefined) clauses.push(`with a modifier at T${rule.modTier} or above`);
  if (rule.modTierGap !== undefined) {
    clauses.push(rule.modTierGap === 0
      ? 'with every modifier at the top tier'
      : `with every modifier within ${rule.modTierGap} ${rule.modTierGap === 1 ? 'tier' : 'tiers'} of the top`);
  }
  const mods = rule.mods !== undefined ? rangeWords(rule.mods) : undefined;
  if (mods !== undefined) clauses.push(`with ${mods} ${mods === '1' || mods === 'up to 1' ? 'modifier' : 'modifiers'}`);
  if (rule.mapMod !== undefined) clauses.push(`with ${MAP_MOD_LABELS[rule.mapMod]}`);
  return [`${ACTION_WORDS[rule.action]} ${subject}`, ...clauses].join(', ');
}

type RuleField = Exclude<keyof LootRule, 'kind' | 'action'>;
const GEAR_OR_MAP: readonly (LootKind | 'any')[] = ['gear', 'map', 'any'];
// The kinds each field may be set with: a field no item of the kind can have would make the rule dead.
const FIELD_KINDS: Readonly<Record<RuleField, readonly (LootKind | 'any')[]>> = {
  set: ['gear'], slot: ['gear'],
  rarity: GEAR_OR_MAP, level: GEAR_OR_MAP, modTier: GEAR_OR_MAP, modTierGap: GEAR_OR_MAP, mods: GEAR_OR_MAP,
  mapMod: ['map', 'any'], gem: ['gem', 'any'], grade: ['gem', 'any'], rune: ['rune', 'any'], material: ['material', 'any'],
};

const isOrdered = (range: LootRange | undefined): boolean =>
  range?.min === undefined || range.max === undefined || range.min <= range.max;

/** Whether a rule can hold: each field fits its kind, materials are only kept or stashed, and each range is in order. */
export function ruleValid(rule: LootRule): boolean {
  for (const [field, kinds] of Object.entries(FIELD_KINDS) as [RuleField, readonly (LootKind | 'any')[]][]) {
    if (rule[field] !== undefined && !kinds.includes(rule.kind)) return false;
  }
  if (rule.kind === 'map' && rule.rarity === 'legendary') return false;
  if ((rule.kind === 'material' || rule.material !== undefined) && rule.action !== 'keep' && rule.action !== 'stash') return false;
  return isOrdered(rule.level) && isOrdered(rule.mods);
}

// The Plan 9 rule: a rarity, a target (a gear set, a slot, gems, or anything but a map) and one of three actions.
interface OldRule { rarity: Rarity | 'any'; target: GearSet | Slot | 'gem' | 'any'; action: 'keep' | 'sell' | 'salvage' }
const OLD_TARGETS: readonly string[] = ['any', 'gem', ...GEAR_SETS, ...MINING_SLOTS, ...BATTLE_SLOTS];
const OLD_ACTIONS: readonly string[] = ['keep', 'sell', 'salvage'];
const OLD_RARITIES: readonly string[] = ['any', ...RARITIES];

function isOldRule(x: unknown): x is OldRule {
  if (typeof x !== 'object' || x === null) return false;
  const { rarity, target, action } = x as Record<string, unknown>;
  return (
    typeof rarity === 'string' && OLD_RARITIES.includes(rarity) && typeof target === 'string' && OLD_TARGETS.includes(target) &&
    typeof action === 'string' && OLD_ACTIONS.includes(action)
  );
}

/** Whether `x` is a Plan 9 loot filter: a list of old rules, each well formed. */
export function isOldLootFilter(x: unknown): x is unknown[] {
  return Array.isArray(x) && x.every(isOldRule);
}

/**
 * The rules that act exactly as an old one did (it never matched a map): none, one, or two for the old catch-all, which
 * matched gear and gems alike. A malformed rule gives none.
 */
export function migrateRule(old: unknown): LootRule[] {
  if (!isOldRule(old)) return [];
  const { rarity, target, action } = old;
  const rarityField = rarity === 'any' ? {} : { rarity };
  switch (target) {
    // a gem has no rarity, so a gem rule with one matched nothing
    case 'gem': return rarity === 'any' ? [{ kind: 'gem', action }] : [];
    case 'any': return rarity === 'any' ? [{ kind: 'gear', action }, { kind: 'gem', action }] : [{ kind: 'gear', ...rarityField, action }];
    case 'mining':
    case 'battle': return [{ kind: 'gear', set: target, ...rarityField, action }];
    default: return [{ kind: 'gear', slot: target, ...rarityField, action }];
  }
}

/** An old filter's rules, each migrated in its place, cut at MAX_LOOT_RULES; anything not an old filter gives none. */
export function migrateLootFilter(old: unknown): LootRule[] {
  return isOldLootFilter(old) ? old.flatMap(migrateRule).slice(0, MAX_LOOT_RULES) : [];
}
