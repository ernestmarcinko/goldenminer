import { expect, it } from 'vitest';
import { compressToBase64 } from 'lz-string';
import fixture from '../fixtures/save-schema-1.txt?raw';
import { applyTicks } from '../../src/core/dig';
import { newGame } from '../../src/core/newGame';
import { decodeSave, encodeSave, migrate } from '../../src/core/save';
import { deriveStats } from '../../src/core/stats';
import type { GemType } from '../../src/core/items';
import type { BagFullMode, FindRecord, GameState, LootAction } from '../../src/core/types';
import { gear, gem } from '../helpers/items';

const raw = (env: unknown) => compressToBase64(JSON.stringify(env));

it('round-trips a game', () => {
  const s = newGame(9, 123);
  s.gold = 2480;
  const r = decodeSave(encodeSave(s, 456));
  expect(r).toEqual({ ok: true, state: s, savedAt: 456 });
});

it('rejects garbage as corrupt', () => {
  expect(decodeSave('not a save')).toEqual({ ok: false, reason: 'corrupt' });
  expect(decodeSave('')).toEqual({ ok: false, reason: 'corrupt' });
});

it('refuses saves from a newer version', () => {
  expect(decodeSave(raw({ schema: 99, savedAt: 0, state: newGame(1, 0) }))).toEqual({ ok: false, reason: 'future' });
});

it('rejects impossible states', () => {
  const bad = [
    { ...newGame(1, 0), gold: Number.NaN },
    { ...newGame(1, 0), diamonds: -1 },
    { ...newGame(1, 0), depth: 5, deepest: 3 },
    { ...newGame(1, 0), progress: 1 },
  ];
  for (const state of bad) expect(decodeSave(raw({ schema: 1, savedAt: 0, state }))).toEqual({ ok: false, reason: 'invalid' });
});

it('migrations run in order', () => {
  const out = migrate({ v: [] }, 1, 3, {
    1: (s) => ({ v: [...(s as { v: number[] }).v, 1] }),
    2: (s) => ({ v: [...(s as { v: number[] }).v, 2] }),
  });
  expect(out).toEqual({ v: [1, 2] });
  expect(() => migrate({}, 1, 3, { 1: (s) => s })).toThrow();
});

it('migrates a real schema-1 save', () => {
  const r = decodeSave(fixture.trim());
  if (!r.ok) throw new Error(`fixture rejected: ${r.reason}`);
  const s = r.state;
  expect(r.savedAt).toBe(1_761_206_300_000);
  expect(s).toMatchObject({ gold: 10_972, diamonds: 119, depth: 123, deepest: 125, tickCount: 6300, goldCarry: 0, nextId: 31 });
  expect([s.equipped, s.bags, s.stash, s.overflow, s.lootTally, s.settings]).toEqual([
    { mining: {}, battle: {} }, { mining: [], battle: [] }, [], [],
    { kept: 0, sold: 0, salvaged: 0 }, { lootFilter: [], bagFull: 'sellWorst' },
  ]);
  expect(s.finds.map((f) => f.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  expect(s.finds[0]).toEqual({ id: 1, depth: 2, kind: 'map', amount: 0, tick: 50 });
  applyTicks(s, 100, deriveStats(s));
  expect(s.tickCount).toBe(6400);
});

function stocked(): GameState {
  const s = newGame(1, 0);
  s.equipped.mining.pickaxe = gear(s, 'pickaxe', { sockets: 1, gems: [gem(s, 'ruby')] });
  s.bags.mining.push(gem(s, 'emerald'));
  s.bags.battle.push(gear(s, 'weapon', { rarity: 'rare', affixes: [{ stat: 'critChance', value: 3 }, { stat: 'life', value: 20 }, { stat: 'armor', value: 12 }] }));
  s.stash.push(gear(s, 'boots', { rarity: 'legendary', name: 'Long Voyage', uniqueId: 'longVoyage' }));
  s.settings.lootFilter.push({ rarity: 'normal', target: 'any', action: 'sell' });
  s.settings.bagFull = 'stop';
  return s;
}

it('round-trips gear, gems, the stash and settings', () => {
  const s = stocked();
  expect(decodeSave(encodeSave(s, 9))).toEqual({ ok: true, state: s, savedAt: 9 });
});

it('rejects impossible inventories', () => {
  const cases: [string, (s: GameState) => void][] = [
    ['battle gear in the mining bag', (s) => { s.bags.mining.push(gear(s, 'weapon')); }],
    ['an overfull bag', (s) => { for (let i = 0; i < 25; i++) s.bags.mining.push(gem(s)); }],
    ['an overfull stash', (s) => { for (let i = 0; i < 60; i++) s.stash.push(gem(s)); }],
    ['worn under the wrong slot', (s) => { s.equipped.mining.lamp = gear(s, 'pickaxe'); }],
    ['worn in the wrong set', (s) => { s.equipped.battle.pickaxe = gear(s, 'pickaxe'); }],
    ['a shared id', (s) => { const g = gem(s); g.id = s.bags.mining[0]!.id; s.stash.push(g); }],
    ['an id from the future', (s) => { s.stash.push(gem(s, 'ruby', { id: 999 })); }],
    ['more gems than sockets', (s) => { s.equipped.mining.pickaxe!.gems.push(gem(s)); }],
    ['a battle stat on mining gear', (s) => { s.equipped.mining.pickaxe!.affixes.push({ stat: 'damage', value: 3 }); }],
    ['a fractional stat', (s) => { s.equipped.mining.pickaxe!.implicit.value = 2.5; }],
    ['an unknown gem', (s) => { s.bags.mining.push({ ...gem(s), gem: 'opal' as GemType }); }],
    ['an unknown loot action', (s) => { s.settings.lootFilter.push({ rarity: 'any', target: 'any', action: 'burn' as LootAction }); }],
    ['too many loot rules', (s) => { for (let i = 0; i < 20; i++) s.settings.lootFilter.push({ rarity: 'any', target: 'gem', action: 'keep' }); }],
    ['an unknown bag-full mode', (s) => { s.settings.bagFull = 'maybe' as BagFullMode; }],
    ['a find without an id', (s) => { s.finds.push({ depth: 0, kind: 'chest', amount: 0, tick: 0 } as FindRecord); }],
    ['a whole Gold left in the carry', (s) => { s.goldCarry = 1; }],
    ['held loot for the wrong bag', (s) => { s.overflow.push({ bag: 'mining', item: gear(s, 'ring') }); }],
  ];
  for (const [name, mutate] of cases) {
    const s = stocked();
    mutate(s);
    expect(decodeSave(raw({ schema: 2, savedAt: 0, state: s })), name).toEqual({ ok: false, reason: 'invalid' });
  }
});
