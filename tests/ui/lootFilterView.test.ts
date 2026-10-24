import { expect, it } from 'vitest';
import type { LootRule } from '../../src/core/types';
import { NEW_RULE, addRule, moveRule, removeRule, updateRule } from '../../src/ui/character/lootFilterView';

it('edits the rule list without mutating it', () => {
  const a: LootRule = { rarity: 'normal', target: 'any', action: 'sell' };
  const b: LootRule = { rarity: 'any', target: 'gem', action: 'salvage' };
  const rules = [a, b];
  expect(moveRule(rules, 1, -1)).toEqual([b, a]);
  expect(moveRule(rules, 0, -1)).toBe(rules);
  expect(removeRule(rules, 0)).toEqual([b]);
  expect(updateRule(rules, 1, { action: 'keep' })).toEqual([a, { ...b, action: 'keep' }]);
  expect(addRule(rules)).toEqual([a, b, NEW_RULE]);
  expect(rules).toEqual([a, b]);
  expect(addRule(Array.from({ length: 20 }, () => a))).toHaveLength(20);
});
