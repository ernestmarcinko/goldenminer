import { expect, it } from 'vitest';
import type { LootKind, LootRule } from '../../src/core/types';
import type { RuleField } from '../../src/ui/character/lootFilterView';
import { ruleValid } from '../../src/core/lootFilter';
import {
  ACTION_OPTIONS, GEM_OPTIONS, GRADE_OPTIONS, KIND_OPTIONS, MAP_MOD_LABELS, MAP_MOD_OPTIONS, MATERIAL_OPTIONS, NEW_RULE,
  RARITY_OPTIONS, SET_OPTIONS, SLOT_OPTIONS, actionOptionsFor, addRow, boxProblems, fieldsFor, levelLabel, moveRow, moveTarget,
  rarityOptionsFor, removeRow, ruleProblems, rowsOf, rulesOf, setRange, slotOptionsFor, withKind, withModTier, withPick,
} from '../../src/ui/character/lootFilterView';

const values = <T>(options: readonly { value: T }[]): T[] => options.map((o) => o.value);
const KINDS: readonly (LootKind | 'any')[] = ['any', 'gear', 'gem', 'map', 'material'];

it('names the kinds, actions and picks, Any first', () => {
  expect(KIND_OPTIONS.map((o) => o.label)).toEqual(['Any item', 'Gear', 'Gems', 'Maps', 'Materials']);
  expect(values(KIND_OPTIONS)).toEqual(['any', 'gear', 'gem', 'map', 'material']);
  expect(values(ACTION_OPTIONS)).toEqual(['keep', 'sell', 'salvage', 'stash']);
  expect(ACTION_OPTIONS[3]?.label).toBe('Stash in its tab');
  expect(Object.values(MAP_MOD_LABELS)).toEqual(['Monster life', 'Monster damage', 'Monster speed', 'Boss power', 'Weak healing', 'Hardened']);
  for (const options of [SET_OPTIONS, SLOT_OPTIONS, RARITY_OPTIONS, GEM_OPTIONS, GRADE_OPTIONS, MATERIAL_OPTIONS, MAP_MOD_OPTIONS]) {
    expect(options[0]).toEqual({ value: 'any', label: 'Any' });
  }
  expect(values(SLOT_OPTIONS)).toHaveLength(10);
  expect(values(MAP_MOD_OPTIONS).slice(1)).toEqual(Object.keys(MAP_MOD_LABELS));
  expect(NEW_RULE).toEqual({ kind: 'gear', action: 'keep' });
});

it('shows the fields and actions that fit each kind', () => {
  expect(fieldsFor('gear')).toEqual(['set', 'slot', 'rarity', 'level', 'modTier', 'mods']);
  expect(fieldsFor('map')).toEqual(['rarity', 'level', 'modTier', 'mods', 'mapMod']);
  expect(fieldsFor('gem')).toEqual(['gem', 'grade']);
  expect(fieldsFor('material')).toEqual(['material']);
  expect(fieldsFor('any')).toEqual(['rarity', 'level', 'modTier', 'mods']);
  expect((['gear', 'map', 'any'] as const).map((k) => levelLabel(k))).toEqual(['Item level', 'Tier', 'Item level or tier']);
  expect(values(actionOptionsFor('material'))).toEqual(['keep', 'stash']);
  for (const kind of ['any', 'gear', 'gem', 'map'] as const) expect(actionOptionsFor(kind)).toBe(ACTION_OPTIONS);
  expect(values(rarityOptionsFor({ kind: 'gear', action: 'keep' }))).toEqual(['any', 'normal', 'magic', 'rare', 'legendary']);
  expect(values(rarityOptionsFor({ kind: 'map', action: 'keep' }))).toEqual(['any', 'normal', 'magic', 'rare']);
  // a map rule that came over from gear with Legendary still shows it, so its problem can be read and fixed
  expect(values(rarityOptionsFor({ kind: 'map', rarity: 'legendary', action: 'keep' }))).toContain('legendary');
});

it('keeps only what the new kind allows', () => {
  expect(withKind({ kind: 'gear', slot: 'boots', action: 'sell' }, 'material')).toEqual({ kind: 'material', action: 'keep' });
  expect(withKind({ kind: 'gear', slot: 'boots', rarity: 'rare', level: { min: 2 }, action: 'sell' }, 'any'))
    .toEqual({ kind: 'any', rarity: 'rare', level: { min: 2 }, action: 'sell' });
  expect(withKind({ kind: 'material', material: 'tin', action: 'stash' }, 'gem')).toEqual({ kind: 'gem', action: 'stash' });
  expect(withKind({ kind: 'map', mapMod: 'hardened', mods: { max: 3 }, action: 'salvage' }, 'gear'))
    .toEqual({ kind: 'gear', mods: { max: 3 }, action: 'salvage' });
});

it('sets each end of a range, and drops a range with no ends', () => {
  const rule: LootRule = { kind: 'gear', action: 'keep' };
  const low = setRange(rule, 'level', 'min', '4');
  expect(low).toEqual({ kind: 'gear', level: { min: 4 }, action: 'keep' });
  expect(setRange(low, 'level', 'max', '')).toEqual({ kind: 'gear', level: { min: 4 }, action: 'keep' });
  expect(setRange(setRange(low, 'level', 'max', '9'), 'level', 'min', 'x')).toEqual({ kind: 'gear', level: { max: 9 }, action: 'keep' });
  expect(setRange(low, 'level', 'min', '')).toEqual(rule);
  expect(setRange(setRange(rule, 'mods', 'min', '0'), 'mods', 'max', '2')).toEqual({ kind: 'gear', mods: { min: 0, max: 2 }, action: 'keep' });
  // an item level or tier is never below 1, and a fraction is never a count: neither could match
  expect(setRange(rule, 'level', 'max', '0')).toEqual(rule);
  expect(setRange(rule, 'mods', 'max', '1.5')).toEqual(rule);
  expect(rule).toEqual({ kind: 'gear', action: 'keep' });
});

it('takes a modifier tier of 1 or more, and clears it otherwise', () => {
  const rule: LootRule = { kind: 'map', action: 'keep' };
  expect(withModTier(rule, '3')).toEqual({ kind: 'map', modTier: 3, action: 'keep' });
  for (const text of ['', '0', '-2', '2.5', 'T3']) expect(withModTier({ ...rule, modTier: 4 }, text), text).toEqual(rule);
});

it('offers only the chosen set\'s slots, and moves the set to a slot of the other one', () => {
  const mining: LootRule = { kind: 'gear', set: 'mining', action: 'keep' };
  expect(values(slotOptionsFor(mining))).toEqual(['any', 'pickaxe', 'lamp', 'gloves', 'boots']);
  expect(values(slotOptionsFor({ kind: 'gear', set: 'battle', action: 'keep' }))).toEqual(['any', 'weapon', 'armor', 'helm', 'ring', 'amulet']);
  expect(slotOptionsFor({ kind: 'gear', action: 'keep' })).toBe(SLOT_OPTIONS);
  expect(withPick({ ...mining, slot: 'boots' }, 'set', 'battle')).toEqual({ kind: 'gear', set: 'battle', action: 'keep' });
  expect(withPick({ ...mining, slot: 'boots' }, 'set', 'any')).toEqual({ kind: 'gear', slot: 'boots', action: 'keep' });
  expect(withPick(mining, 'slot', 'gloves')).toEqual({ kind: 'gear', set: 'mining', slot: 'gloves', action: 'keep' });
  expect(withPick(mining, 'slot', 'weapon')).toEqual({ kind: 'gear', set: 'battle', slot: 'weapon', action: 'keep' });
  expect(withPick({ ...mining, slot: 'boots' }, 'slot', 'any')).toEqual(mining);
  expect(withPick({ kind: 'gem', gem: 'ruby', action: 'keep' }, 'gem', 'any')).toEqual({ kind: 'gem', action: 'keep' });
  expect(withPick({ kind: 'gem', action: 'keep' }, 'grade', 'perfect')).toEqual({ kind: 'gem', grade: 'perfect', action: 'keep' });
});

it('makes only rules that can match', () => {
  const picks = [
    ['set', SET_OPTIONS], ['slot', SLOT_OPTIONS], ['gem', GEM_OPTIONS], ['grade', GRADE_OPTIONS], ['material', MATERIAL_OPTIONS],
    ['mapMod', MAP_MOD_OPTIONS],
  ] as const;
  for (const kind of KINDS) {
    for (const action of values(actionOptionsFor(kind))) {
      const base = withKind({ ...NEW_RULE, action }, kind);
      expect(ruleValid(base), `${kind} ${action}`).toBe(true);
      for (const [field, options] of picks) {
        if (!fieldsFor(kind).includes(field)) continue;
        for (const o of options) expect(ruleValid(withPick(base, field, o.value)), `${kind} ${field} ${o.value}`).toBe(true);
      }
      if (!fieldsFor(kind).includes('rarity')) continue;
      for (const o of rarityOptionsFor(base)) expect(ruleValid(withPick(base, 'rarity', o.value)), `${kind} ${o.value}`).toBe(true);
    }
  }
});

it('says why a rule can\'t be saved', () => {
  const sold: LootRule = { kind: 'material', action: 'sell' };
  const legendaryMap: LootRule = { kind: 'map', rarity: 'legendary', action: 'keep' };
  const backwards: LootRule = { kind: 'gear', mods: { min: 4, max: 2 }, action: 'keep' };
  expect(ruleProblems(sold)).toEqual(['Materials can\'t be sold or salvaged.']);
  expect(ruleProblems({ kind: 'material', action: 'salvage' })).toEqual(['Materials can\'t be sold or salvaged.']);
  expect(ruleProblems(legendaryMap)).toEqual(['Legendary doesn\'t apply to maps.']);
  expect(ruleProblems(backwards)).toEqual(['The low end is above the high end.']);
  expect(ruleProblems({ kind: 'map', rarity: 'legendary', level: { min: 6, max: 5 }, action: 'keep' }))
    .toEqual(['Legendary doesn\'t apply to maps.', 'The low end is above the high end.']);
  const valid: LootRule = { kind: 'gear', rarity: 'rare', level: { min: 4, max: 4 }, modTier: 3, action: 'stash' };
  expect(ruleProblems(valid)).toEqual([]);
  for (const r of [sold, legendaryMap, backwards, valid, NEW_RULE]) expect(ruleValid(r)).toBe(ruleProblems(r).length === 0);
});

it('keeps a removed rule\'s row empty, so no row moves', () => {
  const a: LootRule = { kind: 'gear', rarity: 'normal', action: 'sell' };
  const b: LootRule = { kind: 'gem', action: 'keep' };
  const c: LootRule = { kind: 'map', action: 'stash' };
  const rules = [a, b, c];
  const rows = rowsOf(rules);
  expect(rows).toEqual(rules);
  expect(rulesOf(rows)).toEqual(rules);
  const removed = removeRow(rows, 1);
  expect(removed).toEqual([a, null, c]);
  expect(rows).toEqual([a, b, c]);
  expect(rulesOf(removed)).toEqual([a, c]);
  // a move steps over the empty row to the next rule
  expect(moveRow(removed, 2, -1)).toEqual([c, null, a]);
  expect(moveRow(removed, 0, 1)).toEqual([c, null, a]);
  expect(moveRow(removed, 0, -1)).toBe(removed);
  expect(moveTarget(removed, 2, -1)).toBe(0);
  expect(moveTarget(removed, 2, 1)).toBeUndefined();
  const lone = removeRow(removed, 2);
  expect(moveRow(lone, 0, 1)).toBe(lone);
  expect(moveRow(removed, 1, 1)).toBe(removed);
  expect(addRow(removed)).toEqual([a, null, c, NEW_RULE]);
  const full = rowsOf(Array.from({ length: 40 }, () => a));
  expect(addRow(full)).toBe(full);
  expect(addRow(removeRow(full, 3))).toHaveLength(41);
});

it('shows only fields the kind may set, so every field set at once still makes a rule that can match', () => {
  const sample: { [F in RuleField]-?: NonNullable<LootRule[F]> } = {
    set: 'mining', slot: 'pickaxe', rarity: 'rare', level: { min: 1, max: 5 }, modTier: 2, mods: { min: 1 }, mapMod: 'hardened',
    gem: 'ruby', grade: 'small', material: 'tin',
  };
  for (const kind of KINDS) {
    for (const field of fieldsFor(kind)) {
      expect(ruleValid({ kind, action: 'keep', [field]: sample[field] }), `${kind} ${field}`).toBe(true);
    }
    const every: LootRule = { kind, action: 'keep' };
    for (const field of fieldsFor(kind)) Object.assign(every, { [field]: sample[field] });
    expect(ruleValid(every), kind).toBe(true);
  }
});

it('says when a number box holds a number it can\'t use, for the boxes the kind shows', () => {
  const line = 'Use whole numbers; an item level or tier starts at 1.';
  expect(boxProblems({}, 'gear')).toEqual([]);
  expect(boxProblems({ 'level.min': '4', 'mods.max': '0', modTier: '' }, 'gear')).toEqual([]);
  expect(boxProblems({ 'level.min': '0' }, 'gear')).toEqual([line]);
  expect(boxProblems({ 'mods.max': '1.5' }, 'map')).toEqual([line]);
  expect(boxProblems({ modTier: '0', 'level.max': '-1' }, 'any')).toEqual([line]);
  // a box the kind no longer shows says nothing
  expect(boxProblems({ 'level.min': '0' }, 'gem')).toEqual([]);
});
