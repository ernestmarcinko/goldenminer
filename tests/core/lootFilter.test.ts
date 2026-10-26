import { expect, it } from 'vitest';
import { lootAction, type Loot } from '../../src/core/loot';
import { DEFAULT_LOOT_FILTER, describeRule, migrateLootFilter, migrateRule, ruleMatches, ruleValid } from '../../src/core/lootFilter';
import { newGame } from '../../src/core/newGame';
import { BATTLE_SLOTS, GEAR_SETS, MINING_SLOTS, RARITIES, setOfSlot } from '../../src/core/items';
import type { Item, MapItem, MapMod, MaterialItem, Rarity } from '../../src/core/items';
import type { LootAction, LootRule } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

// The Plan 9 rule shape, and the action Plan 9's lootAction gave for one rule: maps were never matched.
interface OldRule { rarity: Rarity | 'any'; target: string; action: 'keep' | 'sell' | 'salvage' }
function oldMatch(rule: OldRule, item: Loot): boolean {
  if (item.type === 'map') return false;
  const rarityOk = rule.rarity === 'any' || (item.type === 'gear' && item.rarity === rule.rarity);
  const targetOk = rule.target === 'any'
    || (item.type === 'gear' ? rule.target === item.slot || rule.target === setOfSlot(item.slot) : rule.target === 'gem');
  return rarityOk && targetOk;
}

const s = newGame(1, 0);
const mapOf = (tier: number, rarity: MapItem['rarity'] = 'normal', mods: MapMod[] = []): MapItem =>
  ({ id: s.nextId++, type: 'map', tier, metre: tier * 10, rarity, mods });
const material = (m: MaterialItem['material'], count = 3): MaterialItem => ({ id: s.nextId++, type: 'material', material: m, count });
const rule = (p: Partial<LootRule>): LootRule => ({ kind: 'any', action: 'keep', ...p });
const mod = (kind: MapMod['kind'], tier = 1): MapMod => ({ kind, tier, value: 10 });

it('migrates every old rule shape to rules that act the same', () => {
  const items: Loot[] = [
    ...RARITIES.flatMap((rarity) => (['pickaxe', 'boots', 'ring', 'weapon'] as const).map((slot) => gear(s, slot, { rarity }))),
    gem(s, 'ruby', { count: 4 }),
    mapOf(3),
    mapOf(4, 'rare', [mod('hardened')]),
  ];
  const targets = ['any', ...GEAR_SETS, 'gem', ...MINING_SLOTS, ...BATTLE_SLOTS];
  const actions = ['keep', 'sell', 'salvage'] as const;
  // a fallback after the rule tells "no match" from "matched, keep"; it never names a map, as the old filter never did
  const fallback: LootRule[] = [{ kind: 'gear', action: 'salvage' }, { kind: 'gem', action: 'salvage' }];
  for (const rarity of ['any', ...RARITIES] as const) {
    for (const target of targets) {
      for (const action of actions) {
        const old: OldRule = { rarity, target, action };
        const migrated = migrateRule(old);
        for (const item of items) {
          const name = `${rarity}/${target}/${action} on ${item.type} ${item.type === 'gear' ? `${item.rarity} ${item.slot}` : ''}`;
          const matched = oldMatch(old, item);
          expect(lootAction(migrated, item), name).toBe(matched ? action : 'keep');
          const behind: LootAction = matched ? action : item.type === 'map' ? 'keep' : 'salvage';
          expect(lootAction([...migrated, ...fallback], item), name).toBe(behind);
        }
      }
    }
  }
  expect(migrateRule({ rarity: 'normal', target: 'any', action: 'sell' })).toEqual([{ kind: 'gear', rarity: 'normal', action: 'sell' }]);
  expect(migrateRule({ rarity: 'any', target: 'any', action: 'keep' }))
    .toEqual([{ kind: 'gear', action: 'keep' }, { kind: 'gem', action: 'keep' }]);
  expect(migrateRule({ rarity: 'magic', target: 'mining', action: 'salvage' }))
    .toEqual([{ kind: 'gear', set: 'mining', rarity: 'magic', action: 'salvage' }]);
  expect(migrateRule({ rarity: 'legendary', target: 'boots', action: 'keep' }))
    .toEqual([{ kind: 'gear', slot: 'boots', rarity: 'legendary', action: 'keep' }]);
  expect(migrateRule({ rarity: 'any', target: 'gem', action: 'keep' })).toEqual([{ kind: 'gem', action: 'keep' }]);
  expect(migrateRule({ rarity: 'rare', target: 'gem', action: 'salvage' })).toEqual([]);
  expect(migrateLootFilter('x')).toEqual([]);
  expect(migrateLootFilter([{ rarity: 'any', target: 'any', action: 'keep' }, 7])).toEqual([]);
  // 20 old catch-alls split into 40 rules, the most a filter holds
  expect(migrateLootFilter(Array.from({ length: 20 }, () => ({ rarity: 'any', target: 'any', action: 'sell' })))).toHaveLength(40);
  expect(migrateLootFilter(Array.from({ length: 21 }, () => ({ rarity: 'any', target: 'any', action: 'sell' })))).toHaveLength(40);
  expect(DEFAULT_LOOT_FILTER).toEqual([]);
});

it('matches on every field, and a field that does not apply fails the match', () => {
  const boots = gear(s, 'boots', { rarity: 'rare' });
  const ruby = gem(s, 'ruby', { grade: 'small' });
  const tin = material('tin');
  const holds = (r: LootRule, item: Item): boolean => ruleMatches(r, item);

  const bootsOnly = rule({ slot: 'boots' });
  expect([holds(bootsOnly, ruby), holds(bootsOnly, mapOf(3)), holds(bootsOnly, boots)]).toEqual([false, false, true]);
  expect(holds(rule({ set: 'mining' }), boots)).toBe(true);
  expect(holds(rule({ set: 'battle' }), boots)).toBe(false);

  const rare = rule({ rarity: 'rare' });
  expect([holds(rare, boots), holds(rare, mapOf(3, 'rare')), holds(rare, mapOf(3, 'magic')), holds(rare, ruby)])
    .toEqual([true, true, false, false]);
  const legendary = rule({ rarity: 'legendary' });
  for (const r of ['normal', 'magic', 'rare'] as const) expect(holds(legendary, mapOf(4, r))).toBe(false);

  const band = rule({ kind: 'gear', level: { min: 4, max: 6 } });
  expect([3, 4, 5, 6, 7].map((ilvl) => holds(band, gear(s, 'ring', { ilvl })))).toEqual([false, true, true, true, false]);
  expect(holds(rule({ kind: 'map', level: { min: 5 } }), mapOf(5))).toBe(true);
  expect(holds(rule({ kind: 'map', level: { min: 5 } }), mapOf(4))).toBe(false);
  expect(holds(rule({ level: { min: 1 } }), ruby)).toBe(false);

  const t3 = rule({ kind: 'gear', modTier: 3 });
  expect(holds(t3, gear(s, 'ring', { affixes: [{ stat: 'life', value: 5, tier: 1 }, { stat: 'armor', value: 5, tier: 3, crafted: true }] }))).toBe(true);
  expect(holds(t3, gear(s, 'ring', { affixes: [{ stat: 'life', value: 5, tier: 1 }, { stat: 'armor', value: 5, tier: 2 }] }))).toBe(false);
  expect(holds(rule({ kind: 'map', modTier: 2 }), mapOf(4, 'magic', [mod('hardened', 2)]))).toBe(true);

  const fewMods = rule({ kind: 'map', mods: { max: 2 } });
  expect(holds(fewMods, mapOf(4, 'magic', [mod('hardened'), mod('monsterLife')]))).toBe(true);
  expect(holds(fewMods, mapOf(4, 'rare', [mod('hardened'), mod('monsterLife'), mod('bossPower')]))).toBe(false);
  expect(holds(rule({ kind: 'gear', mods: { min: 1 } }), gear(s, 'ring'))).toBe(false);

  const hardened = rule({ kind: 'map', mapMod: 'hardened' });
  expect([holds(hardened, mapOf(4, 'magic', [mod('hardened')])), holds(hardened, mapOf(4, 'magic', [mod('bossPower')]))])
    .toEqual([true, false]);
  expect(holds(rule({ mapMod: 'hardened' }), boots)).toBe(false);

  const smallRuby = rule({ kind: 'gem', gem: 'ruby', grade: 'small' });
  expect([holds(smallRuby, ruby), holds(smallRuby, gem(s, 'ruby')), holds(smallRuby, gem(s, 'sapphire', { grade: 'small' }))])
    .toEqual([true, false, false]);
  expect(holds(rule({ gem: 'ruby' }), boots)).toBe(false);

  const tinRule = rule({ kind: 'material', material: 'tin' });
  expect([holds(tinRule, tin), holds(tinRule, material('copper')), holds(tinRule, ruby)]).toEqual([true, false, false]);
  // materials are crafting currency: a catch-all that sells or salvages passes them by
  expect(holds(rule({ action: 'sell' }), tin)).toBe(false);
  expect(holds(rule({ action: 'salvage' }), tin)).toBe(false);
  expect(holds(rule({ action: 'stash' }), tin)).toBe(true);
  expect(holds(rule({ kind: 'gear' }), tin)).toBe(false);
});

it('refuses rules that cannot hold', () => {
  const invalid: LootRule[] = [
    { kind: 'gem', slot: 'boots', action: 'keep' },
    { kind: 'map', set: 'mining', action: 'keep' },
    { kind: 'any', set: 'mining', action: 'keep' },
    { kind: 'map', rarity: 'legendary', action: 'keep' },
    { kind: 'gem', rarity: 'rare', action: 'keep' },
    { kind: 'gear', gem: 'ruby', action: 'keep' },
    { kind: 'gear', mapMod: 'hardened', action: 'keep' },
    { kind: 'map', material: 'tin', action: 'keep' },
    { kind: 'material', level: { min: 1 }, action: 'keep' },
    { kind: 'material', action: 'sell' },
    { kind: 'material', action: 'salvage' },
    { kind: 'any', material: 'tin', action: 'sell' },
    { kind: 'gear', level: { min: 6, max: 4 } },
    { kind: 'map', mods: { min: 3, max: 2 }, action: 'keep' },
  ].map((r) => ({ action: 'keep', ...r }) as LootRule);
  for (const r of invalid) expect(ruleValid(r), JSON.stringify(r)).toBe(false);
  const valid: LootRule[] = [
    { kind: 'material', action: 'stash' },
    { kind: 'material', material: 'tin', action: 'keep' },
    { kind: 'any', action: 'sell' },
    { kind: 'any', rarity: 'legendary', level: { min: 2, max: 2 }, modTier: 1, mods: { max: 3 }, action: 'salvage' },
    { kind: 'gear', set: 'battle', slot: 'ring', rarity: 'rare', level: { min: 4 }, modTier: 3, mods: { min: 2 }, action: 'sell' },
    { kind: 'map', rarity: 'rare', level: { max: 9 }, mapMod: 'bossPower', action: 'stash' },
    { kind: 'gem', gem: 'emerald', grade: 'perfect', action: 'keep' },
  ];
  for (const r of valid) expect(ruleValid(r), JSON.stringify(r)).toBe(true);
});

it('describes a rule as a sentence', () => {
  const said = (r: LootRule): string => describeRule(r);
  expect(said({ kind: 'gear', rarity: 'normal', action: 'sell' })).toBe('Sell normal gear');
  expect(said({ kind: 'gear', rarity: 'magic', set: 'mining', action: 'salvage' })).toBe('Salvage magic mining gear');
  expect(said({ kind: 'gem', action: 'keep' })).toBe('Keep gems');
  expect(said({ kind: 'gear', rarity: 'rare', level: { min: 4 }, modTier: 3, action: 'stash' }))
    .toBe('Stash rare gear, item level 4 or more, with a modifier at T3 or above');
  expect(said({ kind: 'map', level: { min: 5, max: 8 }, action: 'stash' })).toBe('Stash maps, tier 5 to 8');
  expect(said({ kind: 'material', material: 'tin', action: 'keep' })).toBe('Keep Tin ore');
  expect(said({ kind: 'any', mods: { min: 5 }, action: 'stash' })).toBe('Stash items, with 5 or more modifiers');

  expect(said({ kind: 'gear', slot: 'boots', rarity: 'legendary', action: 'keep' })).toBe('Keep legendary boots');
  expect(said({ kind: 'gem', gem: 'ruby', grade: 'small', action: 'sell' })).toBe('Sell small rubies');
  expect(said({ kind: 'gear', level: { max: 6 }, mods: { min: 2, max: 4 }, action: 'sell' }))
    .toBe('Sell gear, item level up to 6, with 2 to 4 modifiers');
  expect(said({ kind: 'gear', level: { min: 4, max: 6 }, mods: { max: 2 }, action: 'salvage' }))
    .toBe('Salvage gear, item level 4 to 6, with up to 2 modifiers');
  expect(said({ kind: 'map', rarity: 'rare', mods: { min: 3 }, mapMod: 'hardened', action: 'keep' }))
    .toBe('Keep rare maps, with 3 or more modifiers, with Hardened');
  expect(said({ kind: 'material', action: 'stash' })).toBe('Stash materials');
});

it('a rune rule matches only its kind and names it', () => {
  const fehu = { id: s.nextId++, type: 'rune' as const, rune: 'fehu' as const, count: 1 };
  const isa = { id: s.nextId++, type: 'rune' as const, rune: 'isa' as const, count: 1 };
  const fehuRule = rule({ kind: 'rune', rune: 'fehu' });
  expect([ruleMatches(fehuRule, fehu), ruleMatches(fehuRule, isa), ruleMatches(fehuRule, gem(s, 'ruby'))])
    .toEqual([true, false, false]);
  expect(ruleMatches(rule({ kind: 'rune', rune: 'fehu', action: 'sell' }), fehu)).toBe(true);
  expect(describeRule({ kind: 'rune', rune: 'fehu', action: 'sell' })).toBe('Sell Fehu runes');
  expect(describeRule({ kind: 'rune', action: 'keep' })).toBe('Keep runes');
  expect(ruleValid({ kind: 'rune', rune: 'fehu', action: 'keep' })).toBe(true);
  expect(ruleValid({ kind: 'rune', gem: 'ruby', action: 'keep' })).toBe(false);
});
