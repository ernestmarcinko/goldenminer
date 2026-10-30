import { describe, expect, it } from 'vitest';
import { GameStore } from '../../src/store/gameStore';
import { MemoryStorage, SAVE_KEY, BACKUP_PREFIX, safeStorage } from '../../src/store/storage';
import { decodeSave, encodeSave } from '../../src/core/save';
import { compressToBase64 } from 'lz-string';
import fixture5 from '../fixtures/save-schema-5.txt?raw';
import { newGame } from '../../src/core/newGame';
import { isValidCharacterName } from '../../src/core/names';
import { PASSIVE_NODE_BY_ID, START_NODE_ID } from '../../src/core/passives';
import { refundPrice } from '../../src/core/respec';
import { startMap } from '../../src/core/maps';
import { advance } from '../../src/core/clock';
import { freshWorld } from '../../src/core/seed';
import { deriveBattleStats } from '../../src/core/battle';
import { deriveStats } from '../../src/core/stats';
import { xpToNext } from '../../src/core/levels';
import { isValidSeedText, seedFromText } from '../../src/core/seed';
import { ASCEND_LEVEL, MAX_LOOT_RULES } from '../../src/core/balance';
import { ascendancyPoints, ASCENDANCY_NODE_BY_ID, ASCENDANCY_START_ID } from '../../src/core/ascendancy';
import type { MapItem } from '../../src/core/items';
import type { LootRule, TickEvent } from '../../src/core/types';
import { gear, gem, stashMap } from '../helpers/items';

function make(now = { t: 0 }, storage = new MemoryStorage(), available = true) {
  const store = new GameStore({ storage, storageAvailable: available, now: () => now.t, newSeed: () => 7 });
  return { store, storage, now };
}

/** Node ids on a path from the start to `target`, in allocation order (the start excluded, `target` last). */
function pathTo(target: string): string[] {
  const prev = new Map<string, string>();
  const seen = new Set([START_NODE_ID]);
  const queue = [START_NODE_ID];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const l of PASSIVE_NODE_BY_ID.get(cur)!.links) {
      if (seen.has(l)) continue;
      seen.add(l);
      prev.set(l, cur);
      queue.push(l);
    }
  }
  const path: string[] = [];
  let cur: string | undefined = target;
  while (cur !== undefined && cur !== START_NODE_ID) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

describe('GameStore', () => {
  it('starts a new game when there is no save', () => {
    const { store } = make();
    store.load();
    expect(store.state.worldSeed).toMatch(/^[a-z]+-[a-z]+-\d{1,3}$/);
    expect(store.state.seed).toBe(seedFromText(store.state.worldSeed));
    expect(store.notice).toBeNull();
    expect(store.offlineSummary).toBeNull();
  });

  it('saves and restores', () => {
    const { store, storage, now } = make();
    store.load(); now.t = 5000; store.pump(); store.save();
    const again = make(now, storage).store; again.load();
    expect(again.state.gold).toBe(store.state.gold);
  });

  it('shows an offline summary only for long absences', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, encodeSave(newGame(1, 0), 0));
    const short = make({ t: 100_000 }, storage).store; short.load();
    expect(short.offlineSummary).toBeNull();
    const long = make({ t: 600_000 }, storage).store; long.load();
    expect(long.offlineSummary?.ticks).toBe(600);
  });

  it('keeps an unreadable save as a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const { store } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'corrupt', backupKey: BACKUP_PREFIX + '42' });
    expect(storage.getItem(BACKUP_PREFIX + '42')).toBe('garbage');
    store.save();
    expect(storage.getItem(BACKUP_PREFIX + '42')).toBe('garbage');
  });

  it('survives storage that refuses writes', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    const { store } = make({ t: 0 }, storage); store.load();
    expect(() => store.save()).not.toThrow();
    expect(store.notice).toEqual({ kind: 'saveFailed' });
  });

  it('reports when storage is unavailable', () => {
    const { store } = make({ t: 0 }, new MemoryStorage(), false); store.load();
    expect(store.notice).toEqual({ kind: 'storageUnavailable' });
    const probe = safeStorage(() => { throw new Error('SecurityError'); });
    expect(probe.available).toBe(false);
  });

  it('a bad import leaves the game untouched', () => {
    const { store, now } = make(); store.load(); now.t = 3000; store.pump();
    const gold = store.state.gold;
    expect(store.importSave('nope')).toEqual({ ok: false, reason: 'corrupt' });
    expect(store.state.gold).toBe(gold);
    const other = newGame(2, 0); other.gold = 999;
    expect(store.importSave(encodeSave(other, 0)).ok).toBe(true);
    expect(store.state.seed).toBe(2);
  });

  it('caps clicks at 10 per second', () => {
    const { store } = make(); store.load();
    for (let i = 0; i < 11; i++) store.click();
    expect(store.state.tickCount).toBe(10);
  });

  it('aggregates feedback between drains', () => {
    const { store, now } = make(); store.load();
    store.state.ahead[1] = { feature: 'goldVein', amount: 7, hardRock: false };
    now.t = 30_000; store.pump();   // 30 ticks dig metre 1 and its vein
    const fb = store.drainFeedback();
    expect(fb.gold).toBe(7);
    expect(fb.finds.map((f) => f.kind)).toEqual(['goldVein']);
    expect(store.drainFeedback()).toEqual({ gold: 0, diamonds: 0, finds: [], strikes: [], hurt: 0, digs: 0 });
  });

  it('fold sums dig ticks into feedback.digs and a drain resets it', () => {
    const { store, now } = make(); store.load();
    store.state.ahead[1] = { feature: null, amount: 0, hardRock: false };
    now.t = 5000; store.pump();   // 5 ticks, all digging
    const fb = store.drainFeedback();
    expect(fb.digs).toBe(5);
    expect(store.drainFeedback().digs).toBe(0);
  });

  it('never loses an unreadable save when its backup cannot be written', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const real = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      if (k.startsWith(BACKUP_PREFIX)) throw new Error('QuotaExceededError');
      real(k, v);
    };
    const { store } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'corrupt', backupKey: null });
    expect(store.unreadableSave).toBe('garbage');
    store.save();
    expect(storage.getItem(SAVE_KEY)).toBe('garbage');
    store.newWorld('Miner', null);
    expect(store.unreadableSave).toBeNull();
    expect(storage.getItem(SAVE_KEY)).not.toBe('garbage');
    expect(decodeSave(storage.getItem(SAVE_KEY) ?? '').ok).toBe(true);
  });

  it('a future save is never overwritten', () => {
    const storage = new MemoryStorage();
    const future = compressToBase64(JSON.stringify({ schema: 99, savedAt: 0, state: {} }));
    storage.setItem(SAVE_KEY, future);
    const { store, now } = make({ t: 42 }, storage); store.load();
    expect(store.notice).toEqual({ kind: 'loadFailed', reason: 'future', backupKey: BACKUP_PREFIX + '42' });
    expect(store.unreadableSave).toBe(future);
    now.t = 5000; store.pump(); store.save();
    expect(storage.getItem(SAVE_KEY)).toBe(future);
    // a stale build reloading again does not pile up backup keys
    now.t = 9000;
    const again = make(now, storage).store; again.load();
    expect(again.notice).toEqual({ kind: 'loadFailed', reason: 'future', backupKey: BACKUP_PREFIX + '42' });
    expect(storage.getItem(BACKUP_PREFIX + '9000')).toBeNull();
    store.newWorld('Miner', null);
    expect(store.notice).toBeNull();
    expect(storage.getItem(SAVE_KEY)).not.toBe(future);
    expect(decodeSave(storage.getItem(SAVE_KEY) ?? '').ok).toBe(true);
  });

  it('importing or resetting clears a load-failed notice', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    const { store } = make({ t: 1 }, storage); store.load();
    expect(store.notice?.kind).toBe('loadFailed');
    expect(store.importSave(encodeSave(newGame(2, 0), 0)).ok).toBe(true);
    expect(store.notice).toBeNull();
    storage.setItem(SAVE_KEY, 'garbage');
    store.load();
    expect(store.notice?.kind).toBe('loadFailed');
    store.newWorld('Miner', null);
    expect(store.notice).toBeNull();
  });
});

describe('inventory intents', () => {
  it('an action bumps the version and lets held loot into the room it made', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag = s.bag.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    const held = gear(s, 'pickaxe');
    s.overflow.push(held);
    const v = store.version;
    expect(store.sell({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(s.overflow).toEqual([]);
    expect(s.bag[0]).toBe(held);
  });

  it('a refused action changes nothing', () => {
    const { store } = make();
    store.load();
    const v = store.version;
    expect(store.unequip('pickaxe')).toBe('invalid');
    expect(store.version).toBe(v);
  });

  it('equipping into an empty slot leaves a notice; a swap does not', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe', { name: 'Stonebiter' });
    s.bag[1] = gear(s, 'pickaxe');
    s.bag[2] = gear(s, 'lamp', { name: 'Oil Lamp Helm' });
    expect(store.equipNotice).toBeNull();
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.equipNotice).toEqual({ id: 1, slot: 'pickaxe', name: 'Stonebiter', rarity: 'magic' });
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('ok');
    expect(store.equipNotice?.id).toBe(1);
    expect(store.drop({ where: 'bag', index: 2 }, { where: 'worn', slot: 'lamp' })).toBe('ok');
    expect(store.equipNotice).toEqual({ id: 2, slot: 'lamp', name: 'Oil Lamp Helm', rarity: 'magic' });
  });

  it('replacing the game clears the equip notice', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe');
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.equipNotice).not.toBeNull();
    expect(store.importSave(store.exportSave()).ok).toBe(true);
    expect(store.equipNotice).toBeNull();
    store.state.bag[0] = gear(store.state, 'lamp');
    store.equip({ where: 'bag', index: 0 });
    expect(store.equipNotice?.id).toBe(2);
    expect(store.newWorld('Miner', null)).toBe(true);
    expect(store.equipNotice).toBeNull();
  });

  it('a refused equip leaves no notice, and unequipping does not either', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe');
    s.bag[1] = gear(s, 'boots');
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'worn', slot: 'pickaxe' })).toBe('wrongSlot');
    expect(store.equipNotice).toBeNull();
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.unequip('pickaxe')).toBe('ok');
    expect(store.equipNotice?.id).toBe(1);
  });

  it('the other moves go through the store and bump the version', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gem(s, 'ruby', { count: 5 });
    const v = store.version;
    expect(store.sendItem({ where: 'bag', index: 0 }, 'stash')).toBe('ok');
    expect(s.stash.gems.ruby.tiny).toBe(5);
    expect(store.sendItem({ where: 'gems', gem: 'ruby', grade: 'tiny' }, 'bag')).toBe('ok');
    expect(s.bag[0]).toMatchObject({ gem: 'ruby', count: 5 });
    expect(store.moveItem({ where: 'bag', index: 0 }, { where: 'bag', index: 9 })).toBe('ok');
    expect(store.salvage({ where: 'bag', index: 9 })).toBe('ok');
    expect(store.version).toBe(v + 4);
    expect(store.moveItem({ where: 'bag', index: 9 }, { where: 'stash', index: 0 })).toBe('invalid');
    expect(store.version).toBe(v + 4);
  });

  it('settings keep at most 40 rules, only rules that can hold, and a new filter drains the held loot it sells', () => {
    const { store } = make();
    store.load();
    const rule: LootRule = { kind: 'gear', rarity: 'normal', action: 'sell' };
    const s = store.state;
    s.bag = s.bag.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    s.overflow.push(gear(s, 'pickaxe', { rarity: 'normal' }));
    store.setLootFilter([{ kind: 'material', action: 'sell' }, ...Array.from({ length: 45 }, () => rule)]);
    expect(store.state.settings.lootFilter).toHaveLength(MAX_LOOT_RULES);
    expect(store.state.settings.lootFilter.every((r) => r.kind === 'gear')).toBe(true);
    expect(s.overflow).toEqual([]);
    expect('setBagFull' in store).toBe(false);
  });

  it('a new world from a typed name and seed, or refused when either is empty', () => {
    const { store } = make(); store.load();
    expect(store.newWorld('Gorvash', '  Golden Mole ')).toBe(true);
    expect([store.state.worldSeed, store.state.seed, store.state.characterName]).toEqual(['Golden Mole', 2_552_287_895, 'Gorvash']);
    expect(store.newWorld('   ', 'Golden Mole')).toBe(false);
    expect(store.newWorld('Gorvash', '   ')).toBe(false);
    expect([store.state.worldSeed, store.state.characterName]).toEqual(['Golden Mole', 'Gorvash']);
    expect(store.newWorld('Miner', null)).toBe(true);
    expect(store.state.worldSeed).toMatch(/^[a-z]+-[a-z]+-\d{1,3}$/);
    expect(store.state.characterName).toBe('Miner');
  });

  it('newWorld trims the name and keeps the exact seed text', () => {
    const { store } = make(); store.load();
    expect(store.newWorld('  Thulmar  ', 'amber-fox-427')).toBe(true);
    expect(store.state.characterName).toBe('Thulmar');
    expect(store.state.worldSeed).toBe('amber-fox-427');
    expect(store.state.seed).toBe(seedFromText('amber-fox-427'));
  });

  it('a refused newWorld leaves the world unchanged', () => {
    const { store } = make(); store.load();
    const before = structuredClone(store.state);
    expect(store.newWorld('', 'amber-fox-427')).toBe(false);
    expect(store.newWorld('   ', 'amber-fox-427')).toBe(false);
    expect(store.newWorld('Gorvash', '')).toBe(false);
    expect(store.state).toEqual(before);
  });

  it('two same-seed worlds with different names build the same mine', () => {
    const a = make().store; a.load();
    const b = make().store; b.load();
    a.newWorld('Gorvash', 'amber-fox-427');
    b.newWorld('Thulmar', 'amber-fox-427');
    expect(a.state.characterName).toBe('Gorvash');
    expect(b.state.characterName).toBe('Thulmar');
    expect([a.state.seed, a.state.rng, a.state.uniqueRng, a.state.runeRng, a.state.nextId, a.state.ahead]).toEqual(
      [b.state.seed, b.state.rng, b.state.uniqueRng, b.state.runeRng, b.state.nextId, b.state.ahead],
    );
  });

  it('hasSave is true only when a save exists under SAVE_KEY', () => {
    const storage = new MemoryStorage();
    expect(make({ t: 0 }, storage).store.hasSave()).toBe(false);
    storage.setItem(SAVE_KEY, 'x');
    expect(make({ t: 0 }, storage).store.hasSave()).toBe(true);
    storage.getItem = () => { throw new Error('blocked'); };
    expect(make({ t: 0 }, storage).store.hasSave()).toBe(false);
  });

  it('randomName and randomSeedText draw valid values', () => {
    const { store } = make(); store.load();
    const name = store.randomName();
    const seed = store.randomSeedText();
    expect(name.length).toBeGreaterThan(0);
    expect(isValidCharacterName(name)).toBe(true);
    expect(isValidSeedText(seed)).toBe(true);
  });

  it('setMotion applies a patch and skips undefined entries', () => {
    const { store } = make(); store.load();
    store.setMotion({ floats: false, shaft: 'smooth' });
    store.setMotion({ shaft: undefined, pops: false });
    expect(store.state.settings.motion).toEqual({ floats: false, pops: false, lampFlicker: true, shaft: 'smooth' });
    // the next save must still be readable
    expect(make().store.importSave(store.exportSave()).ok).toBe(true);
  });
});

describe('crafting', () => {
  it('a craft bumps the version and is kept as the last craft; a refusal is kept but changes nothing', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe', { rarity: 'normal', ilvl: 4 });
    s.diamonds = 10;
    expect(store.lastCraft).toBeNull();
    const v = store.version;
    expect(store.craft({ where: 'bag', index: 0 }, 'makeMagic')).toEqual({ check: 'ok' });
    expect(store.version).toBe(v + 1);
    expect(store.lastCraft).toEqual({ id: 1, target: { where: 'bag', index: 0 }, kind: 'makeMagic', check: 'ok' });
    expect(s.diamonds).toBe(8);
    expect(store.craft({ where: 'bag', index: 0 }, 'makeMagic')).toEqual({ check: 'wrongRarity' });
    expect(store.version).toBe(v + 1);
    expect(store.lastCraft).toEqual({ id: 2, target: { where: 'bag', index: 0 }, kind: 'makeMagic', check: 'wrongRarity' });
  });

  it('a material dropped on gear crafts through the store and keeps the check', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', ilvl: 4 });
    s.bag[1] = { id: s.nextId++, type: 'material', material: 'tin', count: 5 };
    const v = store.version;
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'bag', index: 0 })).toBe('craftRefused');
    expect(store.version).toBe(v);
    expect(store.lastCraft).toMatchObject({ id: 1, kind: 'tin', check: 'wrongRarity' });
    s.bag[1] = { id: s.nextId++, type: 'material', material: 'mithril', count: 5 };
    s.bag[0] = gear(s, 'pickaxe', { rarity: 'rare', affixes: [{ stat: 'goldYield', value: 4 }] });
    expect(store.drop({ where: 'bag', index: 1 }, { where: 'bag', index: 0 })).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(store.lastCraft).toMatchObject({ id: 2, kind: 'mithril', check: 'ok' });
    expect(store.importSave(store.exportSave()).ok).toBe(true);
    expect(store.lastCraft).toBeNull();
  });
});

describe('stash pages', () => {
  it('buying a General page with enough Gold bumps the version and adds the cells', () => {
    const { store } = make();
    store.load();
    store.state.gold = 5000;
    const v = store.version;
    expect(store.buyStashPage()).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(store.state.stash.general).toHaveLength(180);
    expect(store.state.stash.bought).toEqual({ general: 1 });
    expect(store.state.gold).toBe(0);
  });

  it('a refused purchase changes nothing', () => {
    const { store } = make();
    store.load();
    store.state.gold = 4999;
    const v = store.version;
    expect(store.buyStashPage()).toBe('noGold');
    expect(store.version).toBe(v);
    expect(store.state.stash.general).toHaveLength(120);
  });

  it('a bought page leaves held loot held: only the bag takes it', () => {
    const { store } = make();
    store.load();
    const s = store.state;
    s.bag = s.bag.map(() => gem(s));
    s.stash.general = s.stash.general.map(() => gear(s, 'ring'));
    const held = gear(s, 'pickaxe');
    s.overflow.push(held);
    s.gold = 5000;
    expect(store.buyStashPage()).toBe('ok');
    expect([s.overflow, s.stash.general[120]]).toEqual([[held], null]);
  });
});

describe('held loot and maps', () => {
  /** A full bag with a map in cell 17, and `n` held finds. */
  const fullWithMap = (n: number) => {
    const { store, now } = make();
    store.load();
    const s = store.state;
    s.bag = s.bag.map(() => gear(s, 'ring'));
    const map: MapItem = { id: s.nextId++, type: 'map', tier: 1, metre: 2, rarity: 'normal', mods: [] };
    s.bag[17] = map;
    const held = Array.from({ length: n }, () => gear(s, 'boots'));
    s.overflow.push(...held);
    return { store, now, s, map, held };
  };

  it('starting a map from the bag lets the oldest held find into its cell at once', () => {
    const { store, s, map, held } = fullWithMap(2);
    expect(store.startMap(map.id)).toBe('ok');
    expect([s.bag[17]?.id, s.overflow.map((i) => i.id)]).toEqual([held[0]?.id, [held[1]?.id]]);
  });

  it('a cell freed with no drain still lets held loot in, and digging resumes after the run', () => {
    const { store, now, s, map, held } = fullWithMap(1);
    // started past the store, so nothing drained: the dig gate heals itself
    expect(startMap(s, map.id)).toBe('ok');
    expect([s.bag[17], s.overflow]).toEqual([null, held]);
    expect(store.leaveMap()).toBe(true);
    const deepest = s.deepest;
    now.t += 600_000;
    store.pump();
    // it digs until the next find is held, as the bag is full again
    expect(s.bag[17]?.id).toBe(held[0]?.id);
    expect(s.deepest).toBeGreaterThan(deepest);
    expect(s.overflow.map((i) => i.id)).not.toContain(held[0]?.id);
  });
});

describe('a migrated save with held loot', () => {
  // Schema 6 frees room (one bag of 60, two General pages), so the loot the old bags held can go in at once.
  const decoded = () => { const r = decodeSave(fixture5.trim()); if (!r.ok) throw new Error(r.reason); return r.state; };

  it('loading lets the held items into the room the migration made, and digging goes on', () => {
    const before = decoded();
    expect(before.overflow).toHaveLength(2);
    const held = before.overflow.map((i) => i.id);
    const now = { t: before.lastTickAt };
    const { store, storage } = make(now);
    storage.setItem(SAVE_KEY, fixture5.trim());
    store.load();
    const s = store.state;
    expect(s.overflow).toEqual([]);
    expect(s.bag.filter((c) => c !== null).map((c) => c.id)).toEqual(expect.arrayContaining(held));
    expect(store.leaveMap()).toBe(true);
    now.t += 2_000_000;
    store.pump();
    expect(s.deepest).toBeGreaterThan(before.deepest);
  });

  it('importing it does the same', () => {
    const { store } = make();
    store.load();
    expect(store.importSave(fixture5.trim()).ok).toBe(true);
    expect(store.state.overflow).toEqual([]);
  });
});

describe('maps', () => {
  it('a click in a map does nothing: no strike, no dig', () => {
    const { store } = make(); store.load();
    const map = stashMap(store.state, 1, 2);
    expect(store.startMap(map.id)).toBe('ok');
    const before = structuredClone(store.state);
    const version = store.version;
    for (let i = 0; i < 20; i++) expect(store.click()).toEqual([]);
    expect(store.state).toEqual(before);
    expect(store.version).toBe(version);
  });

  it('leaving and dismissing', () => {
    const { store } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
    expect(store.leaveMap()).toBe(true);
    expect(store.state.lastRun).toMatchObject({ outcome: 'left', seen: false });
    store.dismissRun();
    expect(store.state.lastRun?.seen).toBe(true);
  });

  it('auto strikes reach the feedback', () => {
    const { store, now } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
    now.t = 3000; store.pump();
    const fb = store.drainFeedback();
    expect(fb.strikes.length).toBeGreaterThan(0);
  });

  /** The same run on a plain core game, pumped at the same moments, with every event it produced. */
  function runEvents(seconds: number): TickEvent[] {
    const reference = freshWorld(() => 7, 0);
    startMap(reference, stashMap(reference, 1, 2).id);
    const events: TickEvent[] = [];
    for (let t = 250; t <= seconds * 1000; t += 250) advance(reference, t, deriveStats(reference), events);
    expect(reference.activity.kind).toBe('map');
    return events;
  }

  function pumpedRun(seconds: number) {
    const { store, now } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
    for (now.t = 250; now.t <= seconds * 1000; now.t += 250) store.pump();
    expect(store.state.activity.kind).toBe('map');
    return store;
  }

  it('keeps only the newest 6 auto strikes', () => {
    const struck = runEvents(10).flatMap((e) => (e.kind === 'strike' ? [{ amount: e.amount, crit: e.crit }] : []));
    expect(struck.length).toBeGreaterThan(6);
    expect(pumpedRun(10).drainFeedback().strikes).toEqual(struck.slice(-6));
  });

  it('sums the damage taken and starts again after a drain', () => {
    const hurt = runEvents(10).reduce((sum, e) => sum + (e.kind === 'hurt' ? e.amount : 0), 0);
    expect(hurt).toBeGreaterThan(0);
    const store = pumpedRun(10);
    expect(store.drainFeedback().hurt).toBeCloseTo(hurt, 6);
    expect(store.drainFeedback().hurt).toBe(0);
  });

  it('a click after the run has ended digs again', () => {
    const { store } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
    store.leaveMap();
    expect(store.state.activity.kind).toBe('dig');
    const ticks = store.state.tickCount;
    store.click();
    expect(store.state.tickCount).toBeGreaterThan(ticks);
  });

  it('dismissing with no run, or an already seen one, changes nothing', () => {
    const { store } = make(); store.load();
    let v = store.version;
    store.dismissRun();
    expect(store.state.lastRun).toBeNull();
    expect(store.version).toBe(v);
    store.startMap(stashMap(store.state, 1, 2).id);
    store.leaveMap();
    store.dismissRun();
    v = store.version;
    store.dismissRun();
    expect(store.version).toBe(v);
  });

  it('a dismissed run stays dismissed across a save and load', () => {
    const { store, storage, now } = make(); store.load();
    store.startMap(stashMap(store.state, 1, 2).id);
    store.leaveMap();
    store.dismissRun();
    store.save();
    const again = make(now, storage).store; again.load();
    expect(again.state.lastRun).toMatchObject({ outcome: 'left', seen: true });
  });
});

describe('battle stats', () => {
  it('start from the fresh game and follow worn battle gear', () => {
    const { store } = make(); store.load();
    expect(store.battle).toEqual(deriveBattleStats(store.state));
    const before = store.battle.damageMin;
    store.state.bag[0] = gear(store.state, 'weapon');
    expect(store.equip({ where: 'bag', index: 0 })).toBe('ok');
    expect(store.battle.damageMin).toBeGreaterThan(before);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
  });

  it('follow a level gained inside a pump', () => {
    const { store, now } = make(); store.load();
    const before = store.battle.maxLife;
    store.state.xp = xpToNext(store.state.level) - 1;
    store.startMap(stashMap(store.state, 1, 2).id);
    for (now.t = 250; store.state.level === 1 && now.t <= 60_000; now.t += 250) store.pump();
    expect(store.state.level).toBeGreaterThan(1);
    expect(store.battle.maxLife).toBeGreaterThan(before);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
  });

  it('follow an imported save and a new world', () => {
    const { store } = make(); store.load();
    const other = newGame(2, 0);
    other.level = 5;
    expect(store.importSave(encodeSave(other, 0)).ok).toBe(true);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
    expect(store.battle.maxLife).toBeGreaterThan(deriveBattleStats(newGame(2, 0)).maxLife);
    expect(store.newWorld('Miner', null)).toBe(true);
    expect(store.battle).toEqual(deriveBattleStats(store.state));
    expect(store.battle.maxLife).toBe(deriveBattleStats(newGame(2, 0)).maxLife);
  });
});

describe('pausing', () => {
  const dug = (s: { deepest: number; progress: number }) => [s.deepest, s.progress];

  it('offline catch-up digs unless the player pressed Pause', () => {
    const storage = new MemoryStorage();
    const paused = newGame(1, 0);
    paused.paused = true;
    storage.setItem(SAVE_KEY, encodeSave(paused, 0));
    const away = make({ t: 600_000 }, storage).store;
    // the view the game was left on doesn't matter offline
    away.setViewPaused(true);
    away.load();
    expect(dug(away.state)).toEqual([0, 0]);
    expect(away.state.tickCount).toBe(600);
    expect(away.offlineSummary?.paused).toBe(true);
    expect(away.offlineSummary?.metres).toBe(0);

    storage.setItem(SAVE_KEY, encodeSave(newGame(1, 0), 0));
    const digging = make({ t: 600_000 }, storage).store;
    digging.setViewPaused(true);
    digging.load();
    expect(digging.state.deepest).toBeGreaterThan(0);
    expect(digging.offlineSummary?.paused).toBe(false);
  });

  it('the view pause gates live ticks only, and a hidden tab digs', () => {
    const { store, now } = make(); store.load();
    store.setViewPaused(true);
    expect(store.digPaused).toBe(true);
    now.t = 10_000; store.pump();
    expect(dug(store.state)).toEqual([0, 0]);
    expect(store.state.tickCount).toBe(10);

    store.setHidden(true);
    expect(store.digPaused).toBe(false);
    now.t = 20_000; store.pump();
    const hidden = dug(store.state);
    expect(hidden).not.toEqual([0, 0]);

    store.setHidden(false);
    store.setViewPaused(false);
    expect(store.digPaused).toBe(false);
    now.t = 30_000; store.pump();
    expect(dug(store.state)).not.toEqual(hidden);

    // the player's Pause holds even while hidden
    store.setPaused(true);
    store.setHidden(true);
    expect(store.digPaused).toBe(true);
  });

  it('setPaused writes the save flag and bumps the version; the view pause and hidden do not', () => {
    const { store } = make(); store.load();
    const v = store.version;
    store.setPaused(true);
    expect(store.state.paused).toBe(true);
    expect(store.version).toBe(v + 1);
    store.setViewPaused(true);
    store.setHidden(true);
    expect(store.version).toBe(v + 1);
    expect(store.state.paused).toBe(true);
    store.setPaused(false);
    expect(store.state.paused).toBe(false);
  });

  it('an imported save digs its time away even from a paused view, unless the save itself is paused', () => {
    const hour = 3_600_000;
    const { store, now } = make({ t: hour });
    store.load();
    store.setViewPaused(true);
    expect(store.importSave(encodeSave(newGame(1, 0), 0)).ok).toBe(true);
    expect(store.state.lastTickAt).toBe(hour);
    expect(store.state.deepest).toBeGreaterThan(0);
    expect(store.offlineSummary?.paused).toBe(false);
    // the next live tick is the view's to pause
    const dugThen = dug(store.state);
    now.t += 10_000; store.pump();
    expect(dug(store.state)).toEqual(dugThen);

    const paused = newGame(1, 0);
    paused.paused = true;
    expect(store.importSave(encodeSave(paused, now.t - hour)).ok).toBe(true);
    expect(dug(store.state)).toEqual([0, 0]);
    expect(store.state.lastTickAt).toBe(now.t);
  });

  it('a gap of more than 5 minutes between live ticks is dug as time away, unless the player pressed Pause', () => {
    const minute = 60_000;
    const { store, now } = make(); store.load();
    store.setViewPaused(true);
    // the computer slept on the Inventory view
    now.t += 6 * minute; store.pump();
    expect(store.state.deepest).toBeGreaterThan(0);
    expect(store.offlineSummary).not.toBeNull();
    expect(store.offlineSummary?.paused).toBe(false);

    store.setPaused(true);
    const dugThen = dug(store.state);
    now.t += 6 * minute; store.pump();
    expect(dug(store.state)).toEqual(dugThen);
    expect(store.offlineSummary?.paused).toBe(true);

    // 4 minutes is no gap: the view still pauses it
    store.setPaused(false);
    now.t += 4 * minute; store.pump();
    expect(dug(store.state)).toEqual(dugThen);
  });

  it('the player\'s Pause survives a save and a load', () => {
    const { store, storage, now } = make(); store.load();
    store.setPaused(true);
    store.save();
    now.t = 600_000;
    const again = make(now, storage).store; again.load();
    expect(again.state.paused).toBe(true);
    expect(dug(again.state)).toEqual(dug(store.state));
  });
});

describe('passive web intents', () => {
  const start = PASSIVE_NODE_BY_ID.get(START_NODE_ID)!;
  const ring1 = start.links[0]!;
  const ring2 = PASSIVE_NODE_BY_ID.get(ring1)!.links.find((l) => l !== START_NODE_ID)!;

  it('allocate, refund and reset change the state and re-derive stats', () => {
    const { store } = make();
    store.load();
    store.state.level = 3;
    store.state.gold = 1000;
    store.state.diamonds = 100;
    expect(store.allocate(ring1)).toBe('ok');
    expect(store.state.passives.allocated).toEqual([ring1]);
    expect(store.allocate(ring2)).toBe('ok');
    expect(store.refund(ring2)).toBe('ok');
    expect(store.state.passives.allocated).toEqual([ring1]);
    expect(store.resetWeb()).toBe('ok');
    expect(store.state.passives.allocated).toEqual([]);
  });

  it('allocateMany and refundMany apply a staged set in one step', () => {
    const { store } = make();
    store.load();
    store.state.level = 5;
    store.state.gold = 5000;
    expect(store.allocateMany([ring1, ring2])).toBe('ok');
    expect(store.state.passives.allocated).toEqual([ring1, ring2]);
    expect(store.refundMany([ring1, ring2])).toBe('ok');
    expect(store.state.passives.allocated).toEqual([]);
    expect(store.state.gold).toBe(5000 - 2 * refundPrice(5));
  });

  it('an allocation persists across a save and a load', () => {
    const { store, storage, now } = make();
    store.load();
    store.state.level = 3;
    expect(store.allocate(ring1)).toBe('ok');
    store.save();
    const again = make(now, storage).store;
    again.load();
    expect(again.state.passives.allocated).toEqual([ring1]);
  });
});

describe('ascension intent', () => {
  it('refuses below the ascend level and resets the store at it', () => {
    const { store } = make();
    store.load();
    store.state.level = ASCEND_LEVEL - 1;
    store.state.deepest = 1000;
    const v = store.version;
    expect(store.ascend()).toBe('notReady');
    expect(store.version).toBe(v);
    expect(store.state.level).toBe(ASCEND_LEVEL - 1);
    expect(store.state.deepest).toBe(1000);

    store.state.level = ASCEND_LEVEL;
    expect(store.ascend()).toBe('ok');
    expect(store.version).toBe(v + 1);
    expect(store.state.level).toBe(1);
    expect(store.state.deepest).toBe(0);
    expect(store.state.ascendancy.points).toBe(ascendancyPoints(1000, ASCEND_LEVEL, 0));
    expect(store.stats).toEqual(deriveStats(store.state));
    expect(store.battle).toEqual(deriveBattleStats(store.state));
  });
});

describe('ascendancy and auto-map intents', () => {
  const start = ASCENDANCY_NODE_BY_ID.get(ASCENDANCY_START_ID);
  if (start === undefined) throw new Error('the ascendancy tree has no start');
  const ring1 = start.links[0];
  const ring1b = start.links[1];
  if (ring1 === undefined || ring1b === undefined) throw new Error('the ascendancy start has too few links');

  it('allocates a first-ring node for a point; a repeat and an unaffordable node are refused', () => {
    const { store } = make();
    store.load();
    store.state.ascendancy.points = 1;
    const v = store.version;
    expect(store.allocateAscendancy(ring1)).toBe('ok');
    expect(store.state.ascendancy.allocated).toEqual([ring1]);
    expect(store.state.ascendancy.points).toBe(0);
    expect(store.version).toBe(v + 1);
    expect(store.allocateAscendancy(ring1)).toBe('allocated');
    expect(store.state.ascendancy.allocated).toEqual([ring1]);
    expect(store.version).toBe(v + 1);
    expect(store.allocateAscendancy(ring1b)).toBe('noPoints');
    expect(store.state.ascendancy.allocated).toEqual([ring1]);
    expect(store.version).toBe(v + 1);
  });

  it('an ascendancy allocation persists across a save and a load', () => {
    const { store, storage, now } = make();
    store.load();
    store.state.ascendancy.points = 1;
    expect(store.allocateAscendancy(ring1)).toBe('ok');
    store.save();
    const again = make(now, storage).store;
    again.load();
    expect(again.state.ascendancy.allocated).toEqual([ring1]);
  });

  it('a queued map persists across a save and a load', () => {
    const { store, storage, now } = make();
    store.load();
    const path = pathTo('surveyor');
    store.state.level = path.length + 1;
    store.state.xp = 0;
    store.state.passives.allocated = path;
    const map = stashMap(store.state, 1, 2);
    expect(store.queueForAutoMap(map.id)).toBe('ok');
    expect(store.state.autoMap.queue).toEqual([map]);
    store.save();
    const again = make(now, storage).store;
    again.load();
    expect(again.state.autoMap.queue).toEqual([map]);
  });

  it('startAutoMap is a trigger: it starts the first queued map at once', () => {
    const { store } = make();
    store.load();
    const path = pathTo('surveyor');
    store.state.level = path.length + 1;
    store.state.passives.allocated = path;
    const map = stashMap(store.state, 1, 2);
    expect(store.queueForAutoMap(map.id)).toBe('ok');
    expect(store.startAutoMap()).toBe('ok');
    expect(store.state.autoMap.on).toBe(true);
    expect(store.state.activity.kind).toBe('map');
    expect(store.state.activity.kind === 'map' && store.state.activity.run.map.id).toBe(map.id);
  });

  it('startAutoMap is locked without Surveyor, and starts nothing without an eligible map', () => {
    const { store } = make();
    store.load();
    const map = stashMap(store.state, 1, 2);
    expect(store.startAutoMap()).toBe('locked');
    store.state.passives.allocated = pathTo('surveyor');
    expect(store.startAutoMap()).toBe('nothing');   // nothing queued
    expect(store.state.autoMap.on).toBe(false);
    expect(store.queueForAutoMap(map.id)).toBe('ok');
  });

  it('allocating, queueing and unqueueing leave both RNG streams untouched', () => {
    const { store } = make();
    store.load();
    const rng = store.state.rng;
    const uniqueRng = store.state.uniqueRng;
    const map = stashMap(store.state, 1, 2);
    store.state.ascendancy.points = 1;
    store.state.passives.allocated = ['surveyor'];
    expect(store.allocateAscendancy(ring1)).toBe('ok');
    expect(store.queueForAutoMap(map.id)).toBe('ok');
    expect(store.state.rng).toBe(rng);
    expect(store.state.uniqueRng).toBe(uniqueRng);
    expect(store.unqueueForAutoMap(map.id)).toBe('ok');
    expect(store.state.rng).toBe(rng);
    expect(store.state.uniqueRng).toBe(uniqueRng);
  });

  it('unqueueing an id that was never queued is refused and changes nothing', () => {
    const { store } = make();
    store.load();
    const v = store.version;
    expect(store.unqueueForAutoMap(1234)).toBe('notQueued');
    expect(store.state.autoMap.queue).toEqual([]);
    expect(store.version).toBe(v);
  });

  it('achievements a load re-earns retroactively are silent', () => {
    const s = newGame(7, 0);
    s.deepest = 10;
    s.ahead = {};
    s.achievements.earned = ['clicks.7'];   // a retired id: dropped on load
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, compressToBase64(JSON.stringify({ schema: 24, savedAt: 0, state: s })));
    const { store } = make({ t: 0 }, storage);
    store.load();
    expect(store.state.achievements.earned).toContain('depth.10');
    expect(store.state.achievements.earned).not.toContain('clicks.7');
    expect(store.notifications).toEqual([]);
    const imported = make().store;
    imported.load();
    expect(imported.importSave(compressToBase64(JSON.stringify({ schema: 24, savedAt: 0, state: s }))).ok).toBe(true);
    expect(imported.state.achievements.earned).toContain('depth.10');
    expect(imported.notifications).toEqual([]);
  });
});
