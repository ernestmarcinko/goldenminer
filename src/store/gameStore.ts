import { MAX_LOOT_RULES, OFFLINE_SUMMARY_MIN_TICKS } from '../core/balance';
import { advance, ClickLimiter, clickTicks } from '../core/clock';
import { moveTo as coreMoveTo } from '../core/dig';
import * as inv from '../core/inventory';
import { itemName } from '../core/itemData';
import { BATTLE_SLOTS, MINING_SLOTS, setOfSlot } from '../core/items';
import type { GearItem, GearSet, Slot } from '../core/items';
import { drainOverflow } from '../core/loot';
import { newGame } from '../core/newGame';
import { decodeSave, encodeSave, type DecodeResult } from '../core/save';
import { freshWorld, isValidSeedText, seedFromText } from '../core/seed';
import { deriveStats } from '../core/stats';
import { summarize } from '../core/summary';
import type {
  BagFullMode, DropTarget, FindRecord, GameState, InvResult, ItemLoc, LootRule, MotionSettings, OfflineSummary, Stats, TickEvent,
} from '../core/types';
import { BACKUP_PREFIX, SAVE_KEY, type StorageLike } from './storage';

/** Gear just worn into a slot that was empty; `id` counts up so the UI can tell one from the next. */
export interface EquipNotice { id: number; slot: Slot; name: string; rarity: GearItem['rarity'] }

export interface Feedback { gold: number; diamonds: number; finds: FindRecord[] }

export type Notice =
  | { kind: 'loadFailed'; reason: 'corrupt' | 'future' | 'invalid'; backupKey: string | null }
  | { kind: 'saveFailed' }
  | { kind: 'storageUnavailable' }
  | null;

interface Deps {
  storage: StorageLike;
  storageAvailable: boolean;
  now: () => number;
  newSeed: () => number;
}

const MAX_FINDS = 3;
const ALL_SLOTS: readonly Slot[] = [...MINING_SLOTS, ...BATTLE_SLOTS];
const emptyFeedback = (): Feedback => ({ gold: 0, diamonds: 0, finds: [] });

export class GameStore {
  private _state: GameState;
  private _stats: Stats;
  private _version = 0;
  private _summary: OfflineSummary | null = null;
  private _notice: Notice = null;
  private _unreadable: string | null = null;
  private _equipNotice: EquipNotice | null = null;
  private noticeCount = 0;
  private feedback: Feedback = emptyFeedback();
  private readonly listeners = new Set<() => void>();
  private limiter = new ClickLimiter();

  constructor(private readonly deps: Deps) {
    this._state = freshWorld(deps.newSeed, deps.now());
    this._stats = deriveStats(this._state);
  }

  get state(): GameState { return this._state; }
  get stats(): Stats { return this._stats; }
  get version(): number { return this._version; }
  get offlineSummary(): OfflineSummary | null { return this._summary; }
  get notice(): Notice { return this._notice; }
  get unreadableSave(): string | null { return this._unreadable; }
  get equipNotice(): EquipNotice | null { return this._equipNotice; }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private changed(): void {
    this._stats = deriveStats(this._state);
    this._version++;
    for (const fn of [...this.listeners]) fn();
  }

  private replaceState(state: GameState): void {
    this._state = state;
    this._equipNotice = null;
    this._stats = deriveStats(state);
  }

  /** Advances to now; returns the ticks applied. Clones a "before" snapshot only when a summary is possible. */
  private catchUp(events?: TickEvent[]): number {
    const now = this.deps.now();
    const state = this._state;
    const stats = this._stats;
    const summaryPossible =
      now - state.lastTickAt >= (OFFLINE_SUMMARY_MIN_TICKS * 1000) / stats.autoTicksPerSecond;
    const before = summaryPossible ? structuredClone(state) : null;
    const elapsed = now - state.lastTickAt;
    const ticks = advance(state, now, stats, events);
    if (before && ticks >= OFFLINE_SUMMARY_MIN_TICKS) {
      this._summary = summarize(before, state, elapsed, ticks, stats.offlineCapMs);
    }
    return ticks;
  }

  /** The newest backup key, if that backup already holds exactly `raw`. */
  private newestBackupKey(raw: string): string | null {
    const { storage } = this.deps;
    try {
      let newest: string | null = null;
      let newestAt = -Infinity;
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k === null || !k.startsWith(BACKUP_PREFIX)) continue;
        const at = Number(k.slice(BACKUP_PREFIX.length));
        if (Number.isFinite(at) && at >= newestAt) { newest = k; newestAt = at; }
      }
      return newest !== null && storage.getItem(newest) === raw ? newest : null;
    } catch {
      return null;
    }
  }

  private clearLoadFailed(): void {
    if (this._notice?.kind === 'loadFailed') this._notice = null;
  }

  load(): void {
    const { storage, now } = this.deps;
    let raw: string | null = null;
    try { raw = storage.getItem(SAVE_KEY); } catch { raw = null; }
    this._notice = null;
    this._unreadable = null;
    this._summary = null;
    this.feedback = emptyFeedback();
    if (raw === null) {
      this.replaceState(freshWorld(this.deps.newSeed, now()));
    } else {
      const result = decodeSave(raw);
      if (result.ok) {
        this.replaceState(result.state);
      } else {
        let backupKey = this.newestBackupKey(raw);
        let backedUp = true;
        if (backupKey === null) {
          backupKey = BACKUP_PREFIX + now();
          try { storage.setItem(backupKey, raw); } catch { backedUp = false; }
        }
        this.replaceState(freshWorld(this.deps.newSeed, now()));
        this._unreadable = backedUp && result.reason !== 'future' ? null : raw;
        this._notice = { kind: 'loadFailed', reason: result.reason, backupKey: backedUp ? backupKey : null };
      }
    }
    this.catchUp();
    if (!this.deps.storageAvailable && this._notice === null) {
      this._notice = { kind: 'storageUnavailable' };
    }
    this.changed();
  }

  pump(): void {
    const events: TickEvent[] = [];
    const ticks = this.catchUp(events);
    if (ticks === 0) return;
    this.fold(events);
    this.changed();
  }

  private fold(events: TickEvent[]): void {
    const fb = this.feedback;
    for (const e of events) {
      if (e.kind === 'gold') fb.gold += e.amount;
      else if (e.kind === 'diamond') fb.diamonds += e.amount;
      else if (e.kind === 'find') fb.finds.push(e.find);
    }
    if (fb.finds.length > MAX_FINDS) fb.finds = fb.finds.slice(-MAX_FINDS);
  }

  click(): TickEvent[] {
    if (!this.limiter.tryClick(this.deps.now())) return [];
    const events: TickEvent[] = [];
    clickTicks(this._state, this._stats, events);
    this.changed();
    return events;
  }

  moveTo(depth: number): boolean {
    const moved = coreMoveTo(this._state, depth);
    if (moved) this.changed();
    return moved;
  }

  /** Runs an inventory change; if it filled a slot that was empty, that is the new equip notice. */
  private act(change: () => InvResult): InvResult {
    const wornSlots = (): Slot[] => ALL_SLOTS.filter((s) => this._state.equipped[setOfSlot(s)][s] !== undefined);
    const before = wornSlots();
    const result = change();
    if (result === 'ok') {
      for (const slot of wornSlots()) {
        const item = this._state.equipped[setOfSlot(slot)][slot];
        if (before.includes(slot) || item === undefined) continue;
        this._equipNotice = { id: ++this.noticeCount, slot, name: itemName(item), rarity: item.rarity };
      }
      drainOverflow(this._state);
      this.changed();
    }
    return result;
  }

  equip(from: ItemLoc): InvResult { return this.act(() => inv.equip(this._state, from)); }
  unequip(slot: Slot, to?: ItemLoc): InvResult { return this.act(() => inv.unequip(this._state, slot, to)); }
  moveItem(from: ItemLoc, to: ItemLoc): InvResult { return this.act(() => inv.moveItem(this._state, from, to)); }
  sendItem(from: ItemLoc, to: 'stash' | GearSet): InvResult { return this.act(() => inv.sendItem(this._state, from, to)); }
  socketGem(gem: ItemLoc, into: ItemLoc): InvResult { return this.act(() => inv.socketGem(this._state, gem, into)); }
  sell(from: ItemLoc): InvResult { return this.act(() => inv.sell(this._state, from)); }
  salvage(from: ItemLoc): InvResult { return this.act(() => inv.salvage(this._state, from)); }
  drop(from: ItemLoc, to: DropTarget): InvResult { return this.act(() => inv.dropItem(this._state, from, to)); }

  setLootFilter(rules: LootRule[]): void {
    this._state.settings.lootFilter = rules.slice(0, MAX_LOOT_RULES).map((r) => ({ ...r }));
    drainOverflow(this._state);
    this.changed();
  }

  setBagFull(mode: BagFullMode): void {
    this._state.settings.bagFull = mode;
    drainOverflow(this._state);
    this.changed();
  }

  drainFeedback(): Feedback {
    const fb = this.feedback;
    this.feedback = emptyFeedback();
    return fb;
  }

  save(): void {
    if (this._unreadable !== null) return;
    try {
      this.deps.storage.setItem(SAVE_KEY, encodeSave(this._state, this.deps.now()));
    } catch {
      this._notice = { kind: 'saveFailed' };
      this.changed();
      return;
    }
    if (this._notice?.kind === 'saveFailed') {
      this._notice = null;
      this.changed();
    }
  }

  exportSave(): string {
    return encodeSave(this._state, this.deps.now());
  }

  importSave(text: string): DecodeResult {
    const result = decodeSave(text);
    if (result.ok) {
      this.replaceState(result.state);
      this._unreadable = null;
      this.clearLoadFailed();
      this._summary = null;
      this.feedback = emptyFeedback();
      this.changed();
    }
    return result;
  }

  /** Starts a new world from typed seed text, or a random one for `null`; refuses text with no usable characters. */
  newWorld(seedText: string | null): boolean {
    const { newSeed, now } = this.deps;
    let world: GameState;
    if (seedText === null) {
      world = freshWorld(newSeed, now());
    } else if (isValidSeedText(seedText)) {
      const text = seedText.trim();
      world = newGame(seedFromText(text), now(), { seedText: text, lootSeed: newSeed() });
    } else {
      return false;
    }
    this._unreadable = null;
    this.clearLoadFailed();
    this.replaceState(world);
    this._summary = null;
    this.feedback = emptyFeedback();
    this.changed();
    this.save();
    return true;
  }

  setMotion(patch: Partial<MotionSettings>): void {
    // An explicit undefined must not overwrite a setting: it would make the next save invalid.
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    this._state.settings.motion = { ...this._state.settings.motion, ...defined };
    this.changed();
  }

  dismissSummary(): void {
    this._summary = null;
    this.changed();
  }

  dismissNotice(): void {
    this._notice = null;
    this.changed();
  }
}
