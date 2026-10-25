import { describe, expect, it } from 'vitest';
import { MAX_ITEM_LEVEL } from '../../src/core/balance';
import { deriveBattleStats } from '../../src/core/battle';
import { mapTick } from '../../src/core/combat';
import { addMap, startMap } from '../../src/core/maps';
import { newGame } from '../../src/core/newGame';
import { validateState } from '../../src/core/save';
import { canUpgrade, soulUpgrade, soulUpgradeCost } from '../../src/core/soulUpgrade';
import { deriveStats } from '../../src/core/stats';
import type { GameState, ItemLoc } from '../../src/core/types';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { gear, gem } from '../helpers/items';

const bag = (index: number): ItemLoc => ({ where: 'bag', index });

/** A battle ring at ilvl 6 in bag[0], with a T8 line (its ilvl + 2), and `souls` Souls. */
function withRing(souls = 1_000): GameState {
  const s = newGame(1, 0);
  s.bag[0] = gear(s, 'ring', {
    rarity: 'rare', ilvl: 6, name: 'Brass Loop', sockets: 2, gems: [{ gem: 'ruby', grade: 'tiny' }],
    affixes: [{ stat: 'damage', value: 40, tier: 8 }, { stat: 'critChance', value: 3, tier: 2 }],
  });
  s.souls = souls;
  return s;
}

describe('Soul upgrade cost', () => {
  it('is 5 × ilvl²', () => {
    expect(soulUpgradeCost(6)).toBe(180);
    expect(soulUpgradeCost(7)).toBe(245);
    expect(soulUpgradeCost(1)).toBe(5);
  });
});

describe('an upgrade', () => {
  it('raises the item level by 1, takes the Souls and changes nothing else', () => {
    const s = withRing(1_000);
    const before = structuredClone(s);
    expect(canUpgrade(s, bag(0))).toBe('ok');
    expect(soulUpgrade(s, bag(0))).toBe('ok');
    expect(s.souls).toBe(820);
    expect((s.bag[0] as { ilvl: number }).ilvl).toBe(7);
    expect(s).toEqual({ ...before, souls: 820, bag: before.bag.map((c, i) => (i === 0 ? { ...c, ilvl: 7 } : c)) });
  });

  it('works on worn battle gear, General-tab gear and legendaries', () => {
    const s = withRing(10_000);
    s.equipped.battle.weapon = gear(s, 'weapon', { ilvl: 3 });
    s.stash.general[4] = gear(s, 'helm', { ilvl: 2 });
    s.bag[1] = { ...gear(s, 'amulet', { ilvl: 5, affixes: [{ stat: 'life', value: 20, tier: 0 }] }), rarity: 'legendary' };
    expect(soulUpgrade(s, { where: 'worn', slot: 'weapon' })).toBe('ok');
    expect(soulUpgrade(s, { where: 'stash', index: 4 })).toBe('ok');
    expect(soulUpgrade(s, bag(1))).toBe('ok');
    expect(s.equipped.battle.weapon?.ilvl).toBe(4);
    expect(s.stash.general[4]).toMatchObject({ ilvl: 3 });
    expect(s.bag[1]).toMatchObject({ ilvl: 6, rarity: 'legendary' });
    expect(s.souls).toBe(10_000 - 45 - 20 - 125);
    expect(validateState(s)).toBe(true);
  });

  it('keeps a line at ilvl + 2 valid, and lets a crafted line sit at the new ilvl + 2', () => {
    const s = withRing(1_000);
    expect(validateState(s)).toBe(true);
    const ring = s.bag[0] as { affixes: { stat: string; value: number; tier: number; crafted?: true }[] };
    ring.affixes.push({ stat: 'lifeRegen', value: 9, tier: 9, crafted: true });
    expect(validateState(s)).toBe(false);   // tier 9 is over ilvl 6 + 2
    ring.affixes.pop();
    expect(soulUpgrade(s, bag(0))).toBe('ok');
    expect(validateState(s)).toBe(true);
    ring.affixes.push({ stat: 'lifeRegen', value: 9, tier: 9, crafted: true });
    expect(validateState(s)).toBe(true);
  });
});

describe('a refused upgrade', () => {
  const refused = (s: GameState, target: ItemLoc, check: ReturnType<typeof canUpgrade>): void => {
    const before = structuredClone(s);
    expect(canUpgrade(s, target)).toBe(check);
    expect(soulUpgrade(s, target)).toBe(check);
    expect(s).toEqual(before);
  };

  it('refuses mining gear, worn or carried', () => {
    const s = withRing(10_000);
    s.bag[1] = gear(s, 'pickaxe', { ilvl: 6 });
    s.equipped.mining.lamp = gear(s, 'lamp', { ilvl: 6 });
    refused(s, bag(1), 'notBattle');
    refused(s, { where: 'worn', slot: 'lamp' }, 'notBattle');
  });

  it('refuses sealed gear', () => {
    const s = withRing(10_000);
    (s.bag[0] as { sealed?: true }).sealed = true;
    refused(s, bag(0), 'sealed');
  });

  it('refuses with too few Souls', () => {
    refused(withRing(179), bag(0), 'noSouls');
    expect(soulUpgrade(withRing(180), bag(0))).toBe('ok');
  });

  it('refuses an item at the highest item level', () => {
    const s = withRing(Number.MAX_SAFE_INTEGER);
    (s.bag[0] as { ilvl: number }).ilvl = MAX_ITEM_LEVEL;
    refused(s, bag(0), 'maxLevel');
  });

  it('refuses what is not gear, and empty or other places', () => {
    const s = withRing(10_000);
    s.bag[1] = gem(s);
    s.bag[2] = { id: s.nextId++, type: 'material', material: 'copper', count: 5 };
    s.bag[3] = { id: s.nextId++, type: 'map', tier: 3, metre: 40, rarity: 'normal', mods: [] };
    const inTab = addMap(s, 3, 41);
    s.stash.gems.ruby.tiny = 3;
    s.stash.materials.copper = 3;
    refused(s, bag(1), 'invalid');
    refused(s, bag(2), 'invalid');
    refused(s, bag(3), 'invalid');
    refused(s, bag(9), 'invalid');
    refused(s, { where: 'worn', slot: 'armor' }, 'invalid');
    refused(s, { where: 'gems', gem: 'ruby', grade: 'tiny' }, 'invalid');
    refused(s, { where: 'materials', material: 'copper' }, 'invalid');
    refused(s, { where: 'maps', index: s.stash.maps.indexOf(inTab) }, 'invalid');
  });
});

describe('an upgrade during a run', () => {
  it('upgrades the worn weapon, and the next map tick fights with the stats derived after it', () => {
    const s = newGame(3, 0);
    s.equipped.battle.weapon = gear(s, 'weapon', { ilvl: 4, affixes: [{ stat: 'damage', value: 8, tier: 2 }] });
    s.souls = 500;
    expect(startMap(s, addMap(s, 2, 30).id)).toBe('ok');
    // what the state should be: the same, with the upgrade written by hand
    const expected = structuredClone(s);
    expected.souls -= 80;
    (expected.equipped.battle.weapon as { ilvl: number }).ilvl = 5;
    expect(soulUpgrade(s, { where: 'worn', slot: 'weapon' })).toBe('ok');
    expect(s).toEqual(expected);
    expect(deriveBattleStats(s)).toEqual(deriveBattleStats(expected));
    for (let i = 0; i < 20; i++) {
      mapTick(s, deriveStats(s));
      mapTick(expected, deriveStats(expected));
    }
    expect(s).toEqual(expected);
    expect(validateState(s)).toBe(true);
  });

  it('through the store: the stats it holds are derived again', () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    const s = store.state;
    s.equipped.battle.weapon = gear(s, 'weapon', { ilvl: 4 });
    s.souls = 500;
    expect(store.startMap(addMap(s, 2, 30).id)).toBe('ok');
    const version = store.version;
    expect(store.soulUpgrade({ where: 'worn', slot: 'weapon' })).toBe('ok');
    expect(store.version).toBe(version + 1);
    expect(s.equipped.battle.weapon?.ilvl).toBe(5);
    expect(store.battle).toEqual(deriveBattleStats(s));
    expect(store.stats).toEqual(deriveStats(s));
    s.souls = 0;
    expect(store.soulUpgrade({ where: 'worn', slot: 'weapon' })).toBe('noSouls');
    expect(store.version).toBe(version + 1);
  });
});
