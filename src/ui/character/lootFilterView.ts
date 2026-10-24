import { MAX_LOOT_RULES } from '../../core/balance';
import type { LootAction, LootRule, LootTarget } from '../../core/types';
import type { Rarity } from '../../core/items';
import { SLOT_LABELS } from './itemView';

export const NEW_RULE: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };

export function addRule(rules: readonly LootRule[]): LootRule[] {
  return rules.length >= MAX_LOOT_RULES ? [...rules] : [...rules, NEW_RULE];
}

export const removeRule = (rules: readonly LootRule[], i: number): LootRule[] => rules.filter((_, j) => j !== i);

/** The same array when the move would leave the list, so callers can skip a pointless save. */
export function moveRule(rules: readonly LootRule[], i: number, delta: number): readonly LootRule[] {
  const to = i + delta;
  const rule = rules[i];
  if (rule === undefined || to < 0 || to >= rules.length) return rules;
  const next = rules.filter((_, j) => j !== i);
  next.splice(to, 0, rule);
  return next;
}

export const updateRule = (rules: readonly LootRule[], i: number, patch: Partial<LootRule>): LootRule[] =>
  rules.map((r, j) => (j === i ? { ...r, ...patch } : r));

export const RARITY_OPTIONS: readonly { value: Rarity | 'any'; label: string }[] = [
  { value: 'any', label: 'Any rarity' },
  { value: 'normal', label: 'Normal' },
  { value: 'magic', label: 'Magic' },
  { value: 'rare', label: 'Rare' },
  { value: 'legendary', label: 'Legendary' },
];

export const TARGET_OPTIONS: readonly { value: LootTarget; label: string }[] = [
  { value: 'any', label: 'Any item' },
  { value: 'mining', label: 'Mining gear' },
  { value: 'battle', label: 'Battle gear' },
  { value: 'gem', label: 'Gems' },
  { value: 'pickaxe', label: SLOT_LABELS.pickaxe },
  { value: 'lamp', label: SLOT_LABELS.lamp },
  { value: 'gloves', label: SLOT_LABELS.gloves },
  { value: 'boots', label: SLOT_LABELS.boots },
  { value: 'weapon', label: SLOT_LABELS.weapon },
  { value: 'armor', label: SLOT_LABELS.armor },
  { value: 'helm', label: SLOT_LABELS.helm },
  { value: 'ring', label: SLOT_LABELS.ring },
  { value: 'amulet', label: SLOT_LABELS.amulet },
];

export const ACTION_OPTIONS: readonly { value: LootAction; label: string }[] = [
  { value: 'keep', label: 'Keep' },
  { value: 'sell', label: 'Sell for Gold' },
  { value: 'salvage', label: 'Salvage for Diamonds' },
];
