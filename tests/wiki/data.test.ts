import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_BOOST, FAMILY_LABELS } from '../../src/core/achievements';
import { ASCENDANCY_NODES } from '../../src/core/ascendancy';
import {
  CRAFT_COST, ESSENCE_COST, EXCHANGE_DOWN, EXCHANGE_UP, MAP_MOD_CAPS, MAP_MOD_TIERS, MATERIAL_TABLE, ORB_COST,
  PREMIUM_CAP, PREMIUM_DECAY_KEEP, PREMIUM_STEP, oreForTier,
} from '../../src/core/balance';
import { LEGENDARIES, MATERIAL_LABELS, STAT_NAMES } from '../../src/core/itemData';
import { ESSENCE_TIER_MAX, MAP_MOD_KINDS, MAP_SPECIALS, MATERIALS } from '../../src/core/items';
import { MAP_MOD_LABELS, MAP_SPECIAL_TEXT, mapModRange } from '../../src/core/mapMods';
import { newGame } from '../../src/core/newGame';
import { PASSIVE_NODES } from '../../src/core/passives';
import { deriveCharacterSheet } from '../../src/core/stats';
import { UNIQUE_LINES } from '../../src/core/uniques';

import { achievementBoostPercent, achievementFamilies, achievementTotal } from '../../src/wiki/data/achievements';
import { craftCosts, essenceRecipes, materialRows, oreExchange, orePremium } from '../../src/wiki/data/materials';
import { MAP_MOD_TIERS_SHOWN, mapModRows, mapSpecialRows } from '../../src/wiki/data/maps';
import { ascendancyNodes, keystoneNodes, notableNodes, smallNodes } from '../../src/wiki/data/skills';
import { freshCharacterSheet } from '../../src/wiki/data/stats';
import { uniqueRows } from '../../src/wiki/data/uniques';

describe('materials', () => {
  it('the ore table matches MATERIAL_TABLE and MATERIAL_LABELS', () => {
    expect(materialRows()).toEqual(MATERIALS.map((material, index) => ({
      material, label: MATERIAL_LABELS[material], index, ...MATERIAL_TABLE[material],
    })));
  });

  it('the essence recipes match oreForTier and ESSENCE_COST', () => {
    const expected = [];
    for (let tier = 1; tier <= ESSENCE_TIER_MAX; tier++) {
      const ore = oreForTier(tier);
      expected.push({ tier, ore, oreLabel: ore === undefined ? '—' : MATERIAL_LABELS[ore], cost: ESSENCE_COST[tier] ?? 0 });
    }
    expect(essenceRecipes()).toEqual(expected);
  });

  it('the craft costs match CRAFT_COST', () => {
    const kinds = Object.keys(CRAFT_COST) as (keyof typeof CRAFT_COST)[];
    expect(craftCosts().map((r) => r.kind)).toEqual(kinds);
    for (const row of craftCosts()) {
      expect(row.base).toBe(CRAFT_COST[row.kind].base);
      expect(row.per).toBe(CRAFT_COST[row.kind].per);
    }
  });

  it('the exchange and premium constants match the core', () => {
    expect(oreExchange).toEqual({ up: EXCHANGE_UP, down: EXCHANGE_DOWN, orbCost: ORB_COST });
    expect(orePremium).toEqual({ step: PREMIUM_STEP, cap: PREMIUM_CAP, decayKeep: PREMIUM_DECAY_KEEP });
  });
});

describe('uniques', () => {
  it('match LEGENDARIES and UNIQUE_LINES', () => {
    const rows = uniqueRows();
    const defs = [...LEGENDARIES];
    expect(rows).toHaveLength(defs.length);
    for (let i = 0; i < defs.length; i++) {
      const row = rows[i];
      const def = defs[i];
      if (row === undefined || def === undefined) throw new Error('length mismatch');
      expect(row.id).toBe(def.id);
      expect(row.name).toBe(def.name);
      expect(row.slot).toBe(def.slot);
      expect(row.slotLabel.length).toBeGreaterThan(0);
      expect(row.effect).toBe(UNIQUE_LINES[def.id]);
      expect(row.lines.map((l) => [l.stat, l.kind, l.value, l.statName])).toEqual(
        def.lines.map((line) => {
          const kind = 'scale' in line ? 'scale' : 'fixed';
          const value = 'scale' in line ? line.scale : line.fixed;
          return [line.stat, kind, value, STAT_NAMES[line.stat]];
        }),
      );
    }
  });
});

describe('skills', () => {
  it('keystones, notables and smalls match PASSIVE_NODES', () => {
    expect(keystoneNodes()).toEqual(PASSIVE_NODES.filter((n) => n.kind === 'keystone'));
    expect(notableNodes()).toEqual(PASSIVE_NODES.filter((n) => n.kind === 'notable'));
    expect(smallNodes()).toEqual(PASSIVE_NODES.filter((n) => n.kind === 'small'));
  });

  it('ascendancy nodes match ASCENDANCY_NODES', () => {
    expect(ascendancyNodes()).toEqual([...ASCENDANCY_NODES]);
  });
});

describe('maps', () => {
  it('map mods match MAP_MOD_TIERS and mapModRange', () => {
    expect(mapModRows().map((r) => r.kind)).toEqual([...MAP_MOD_KINDS]);
    for (const row of mapModRows()) {
      expect(row.label).toBe(MAP_MOD_LABELS[row.kind]);
      expect(row.base).toBe(MAP_MOD_TIERS[row.kind].base);
      expect(row.step).toBe(MAP_MOD_TIERS[row.kind].step);
      expect(row.cap).toBe(MAP_MOD_CAPS[row.kind]);
      expect(row.tiers).toHaveLength(MAP_MOD_TIERS_SHOWN);
      for (let tier = 1; tier <= MAP_MOD_TIERS_SHOWN; tier++) {
        expect(row.tiers[tier - 1]).toEqual(mapModRange(row.kind, tier));
      }
    }
  });

  it('map specials match MAP_SPECIALS', () => {
    expect(mapSpecialRows()).toEqual(MAP_SPECIALS.map((special) => ({ special, text: MAP_SPECIAL_TEXT[special] })));
  });
});

describe('achievements', () => {
  it('the families cover every achievement and match FAMILY_LABELS', () => {
    const families = achievementFamilies();
    expect(families.map((f) => f.family).sort()).toEqual(Object.keys(FAMILY_LABELS).sort());
    expect(families.reduce((n, f) => n + f.count, 0)).toBe(ACHIEVEMENTS.length);
    for (const f of families) {
      expect(f.label).toBe(FAMILY_LABELS[f.family]);
      expect(f.count).toBeGreaterThan(0);
      expect(f.min).toBeLessThanOrEqual(f.max);
    }
  });

  it('reports the total and the per-achievement boost', () => {
    expect(achievementTotal()).toBe(ACHIEVEMENTS.length);
    expect(achievementBoostPercent()).toBe(ACHIEVEMENT_BOOST * 100);
  });
});

describe('stats', () => {
  it('the fresh sheet labels and formats match deriveCharacterSheet', () => {
    const core = deriveCharacterSheet(newGame(123, 0));
    const wiki = freshCharacterSheet();
    expect(wiki.mining.map((r) => [r.label, r.format])).toEqual(core.mining.map((r) => [r.label, r.format]));
    expect(wiki.battle.map((r) => [r.label, r.format])).toEqual(core.battle.map((r) => [r.label, r.format]));
  });

  it('the fresh sheet values match deriveCharacterSheet for the same seed', () => {
    expect(freshCharacterSheet()).toEqual(deriveCharacterSheet(newGame(0, 0)));
  });
});
