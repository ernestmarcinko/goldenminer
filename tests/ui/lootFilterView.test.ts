import { expect, it } from 'vitest';
import type { LootRule } from '../../src/core/types';
import { ruleValid } from '../../src/core/lootFilter';
import {
  ACTION_OPTIONS, NEW_RULE, RARITY_OPTIONS, TARGET_OPTIONS, addRule, moveRule, removeRule, targetOf, updateRule, withRarity, withTarget,
} from '../../src/ui/character/lootFilterView';

it('edits the rule list without mutating it', () => {
  const a: LootRule = { kind: 'gear', rarity: 'normal', action: 'sell' };
  const b: LootRule = { kind: 'gem', action: 'salvage' };
  const rules = [a, b];
  expect(moveRule(rules, 1, -1)).toEqual([b, a]);
  expect(moveRule(rules, 0, -1)).toBe(rules);
  expect(removeRule(rules, 0)).toEqual([b]);
  expect(updateRule(rules, 1, { action: 'keep' })).toEqual([a, { ...b, action: 'keep' }]);
  expect(addRule(rules)).toEqual([a, b, NEW_RULE]);
  expect(rules).toEqual([a, b]);
  expect(addRule(Array.from({ length: 40 }, () => a))).toHaveLength(40);
});

it('reads and writes a rule through the interim item select', () => {
  const mining: LootRule = { kind: 'gear', set: 'mining', rarity: 'magic', action: 'salvage' };
  expect(targetOf(mining)).toBe('mining');
  expect(targetOf({ kind: 'gem', action: 'keep' })).toBe('gem');
  expect(targetOf({ kind: 'gear', slot: 'boots', action: 'keep' })).toBe('boots');
  expect(targetOf({ kind: 'gear', action: 'keep' })).toBe('any');
  expect(targetOf(NEW_RULE)).toBe('any');
  expect(NEW_RULE).toEqual({ kind: 'gear', rarity: 'normal', action: 'sell' });
  expect(withTarget(mining, 'boots')).toEqual({ kind: 'gear', slot: 'boots', rarity: 'magic', action: 'salvage' });
  expect(withTarget(mining, 'battle')).toEqual({ kind: 'gear', set: 'battle', rarity: 'magic', action: 'salvage' });
  expect(withTarget(mining, 'gem')).toEqual({ kind: 'gem', action: 'salvage' });
  expect(withTarget({ kind: 'gem', action: 'keep' }, 'any')).toEqual({ kind: 'any', action: 'keep' });
  expect(withRarity(mining, 'any')).toEqual({ kind: 'gear', set: 'mining', action: 'salvage' });
  expect(withRarity({ kind: 'gear', action: 'keep' }, 'rare')).toEqual({ kind: 'gear', rarity: 'rare', action: 'keep' });
  for (const target of TARGET_OPTIONS.map((o) => o.value)) expect(ruleValid(withTarget(mining, target)), target).toBe(true);
  expect(ACTION_OPTIONS.map((o) => o.value)).toEqual(['keep', 'sell', 'salvage']);
  expect(RARITY_OPTIONS.map((o) => o.value)).toEqual(['any', 'normal', 'magic', 'rare', 'legendary']);
});
