import { describe, expect, it } from 'vitest';
import { BAG_SIZE, GAMBLE_GOLD } from '../../src/core/balance';
import { firstEmpty } from '../../src/core/cells';
import { rollGear } from '../../src/core/itemGen';
import { LEGENDARIES } from '../../src/core/itemData';
import { BATTLE_SLOTS, MINING_SLOTS, RARITIES, isGear, setOfSlot, type GearItem, type Rarity } from '../../src/core/items';
import { gamble, gamblePrice } from '../../src/core/merchant';
import { newGame } from '../../src/core/newGame';
import { encodeSave, validateState } from '../../src/core/save';
import type { GameState } from '../../src/core/types';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage } from '../../src/store/storage';
import { gear } from '../helpers/items';

const SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS];

/** Deepest 1,100 is tier 7, so a gamble costs 14,700; bag cells 0 and 1 are taken. */
function atTier7(gold = 100_000): GameState {
  const s = newGame(5, 0);
  s.deepest = 1_100;
  s.ahead = {}; // the metres it rolled ahead lie above the new depth now
  s.gold = gold;
  s.bag[0] = gear(s, 'pickaxe');
  s.bag[1] = gear(s, 'weapon');
  return s;
}

describe('the gamble price', () => {
  it('is GAMBLE_GOLD × tier², at least tier 1', () => {
    expect(GAMBLE_GOLD).toBe(300);
    const s = newGame(1, 0);
    s.deepest = 1_100;
    expect(gamblePrice(s)).toBe(14_700);
    s.deepest = 0;
    expect(gamblePrice(s)).toBe(300);
  });
});

describe('a gamble', () => {
  it('puts an item of the slot at the deepest tier in the first empty bag cell, and takes the price', () => {
    const s = atTier7();
    const r = gamble(s, 'ring');
    expect(r.result).toBe('ok');
    const item = s.bag[2] as GearItem;
    expect(r.item).toBe(item);
    expect(item.slot).toBe('ring');
    expect(item.ilvl).toBe(7);
    expect(s.gold).toBe(100_000 - 14_700);
    expect(firstEmpty(s.bag)).toBe(3);
    expect(validateState(s)).toBe(true);
  });

  it('rolls every slot, mining and battle', () => {
    const s = atTier7(10_000_000);
    for (const slot of SLOTS) {
      const r = gamble(s, slot);
      expect(r.result).toBe('ok');
      expect(r.item?.slot).toBe(slot);
    }
    expect(validateState(s)).toBe(true);
  });

  it('never runs the loot filter', () => {
    const s = atTier7();
    s.settings.lootFilter = [{ kind: 'gear', slot: 'ring', action: 'sell' }];
    expect(gamble(s, 'ring').result).toBe('ok');
    expect(s.bag[2]).toMatchObject({ type: 'gear', slot: 'ring' });
    expect(s.gold).toBe(100_000 - 14_700);
  });

  it('refuses a full bag and changes nothing, rng and ids included', () => {
    const s = atTier7();
    for (let i = 0; i < BAG_SIZE; i++) s.bag[i] ??= gear(s, 'boots');
    const before = structuredClone(s);
    expect(gamble(s, 'ring')).toEqual({ result: 'bagFull' });
    expect(s).toEqual(before);
  });

  it('refuses 1 Gold short and changes nothing, rng and ids included', () => {
    const s = atTier7(14_699);
    const before = structuredClone(s);
    expect(gamble(s, 'ring')).toEqual({ result: 'noGold' });
    expect(s).toEqual(before);
    s.gold = 14_700;
    expect(gamble(s, 'ring').result).toBe('ok');
    expect(s.gold).toBe(0);
  });
});

describe('rolling for a slot', () => {
  it('a legendary at a low item level drops only a tier-1 legendary, higher tiers gated deeper', () => {
    const s = newGame(2, 0);
    for (let i = 0; i < 50; i++) {
      const helm = rollGear(s, 7, 'battle', 'legendary', 'helm');
      expect(helm).toMatchObject({ slot: 'helm', rarity: 'legendary', ilvl: 7 });
      const def = LEGENDARIES.find((d) => d.id === helm.uniqueId);
      expect(def?.tier).toBe(1);
    }
  });

  it('gives the slot its own legendary', () => {
    const s = newGame(2, 0);
    const ring = rollGear(s, 7, 'battle', 'legendary', 'ring');
    expect(ring).toMatchObject({ slot: 'ring', rarity: 'legendary' });
    expect(LEGENDARIES.some((d) => d.id === ring.uniqueId && d.slot === 'ring')).toBe(true);
    const lamp = rollGear(s, 7, 'mining', 'legendary', 'lamp');
    expect(lamp).toMatchObject({ slot: 'lamp', rarity: 'legendary' });
    expect(LEGENDARIES.some((d) => d.id === lamp.uniqueId && d.slot === 'lamp')).toBe(true);
  });

  it('gives valid gear for every slot at every rarity, through a gamble and through rollGear', () => {
    const s = atTier7(10_000_000);
    s.bag = s.bag.map(() => null);
    for (const slot of SLOTS) {
      for (const rarity of RARITIES) {
        const item = rollGear(s, 7, setOfSlot(slot), rarity, slot);
        expect(item.slot).toBe(slot);
        s.bag[firstEmpty(s.bag)] = item;
        expect(validateState(s)).toBe(true);
      }
      expect(gamble(s, slot).result).toBe('ok');
      expect(validateState(s)).toBe(true);
    }
  });

  it('keeps every slot for each rarity', () => {
    const s = newGame(9, 0);
    for (const rarity of RARITIES) {
      for (const slot of ['gloves', 'amulet', 'helm'] as const) {
        const item = rollGear(s, 12, slot === 'gloves' ? 'mining' : 'battle', rarity, slot);
        expect(item.slot).toBe(slot);
        expect(isGear(item)).toBe(true);
      }
    }
  });

  // The hash was taken from the code before rollGear learnt slots, so drops elsewhere roll exactly as they did.
  // Re-pinned for Plan 30 (damage types): maxResist joined the battle suffix pool, so the affixes roll differently;
  // the RNG draw count (and so the rng state stream) is unchanged.
  it('leaves rolls without a slot byte-identical', async () => {
    const out: unknown[] = [];
    for (let i = 0; i < 200; i++) {
      const s = { rng: 1_000_003 * (i + 1), nextId: 1 + i };
      const rarity: Rarity | undefined = i % 5 === 4 ? undefined : RARITIES[i % 5];
      const item = rollGear(s, 1 + ((i * 7) % 40), i % 2 === 0 ? 'mining' : 'battle', rarity);
      out.push([item, s.rng, s.nextId]);
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(out)));
    expect(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''))
      .toBe('d8c2b58dfea8f8eef6708cfd186788b8eab00dd072988d615f3bc45cbd08c811');
  });
});

describe('the store', () => {
  it('gambles, keeps the last item and bumps the version only on ok', () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    const s = store.state;
    s.deepest = 1_100;
    s.gold = 20_000;
    expect(store.lastGamble).toBeNull();
    const version = store.version;
    const ok = store.gamble('ring');
    expect(ok.result).toBe('ok');
    expect(ok.item?.slot).toBe('ring');
    expect(store.lastGamble).toEqual(ok.item);
    expect(store.version).toBe(version + 1);
    expect(store.gamble('ring')).toEqual({ result: 'noGold' });
    expect(store.version).toBe(version + 1);
    expect(store.lastGamble).toEqual(ok.item);
    // another world has none
    expect(store.importSave(encodeSave(newGame(3, 0), 0)).ok).toBe(true);
    expect(store.lastGamble).toBeNull();
  });

  it('keeps the gambled item as it was bought, whatever happens to it in the bag', () => {
    const store = new GameStore({ storage: new MemoryStorage(), storageAvailable: true, now: () => 0, newSeed: () => 7 });
    store.load();
    const s = store.state;
    s.deepest = 1_100;
    s.gold = 20_000;
    s.souls = 1_000_000;
    const ok = store.gamble('ring');
    const bought = structuredClone(ok.item);
    const index = s.bag.findIndex((c) => c?.id === bought?.id);
    expect(store.soulUpgrade({ where: 'bag', index })).toBe('ok');
    expect(s.bag[index]).toMatchObject({ ilvl: 8 });
    expect(store.sendItem({ where: 'bag', index }, 'stash')).toBe('ok');
    expect(s.bag[index]).toBeNull();
    expect(store.lastGamble).toEqual(bought);
    expect(store.lastGamble?.ilvl).toBe(7);
  });
});
