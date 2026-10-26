import { MAX_LOOT_RULES, OFFLINE_SUMMARY_MIN_TICKS } from '../core/balance';
import { deriveBattleStats, type BattleStats } from '../core/battle';
import { advance, ClickLimiter, clickTicks } from '../core/clock';
import { clickHit } from '../core/combat';
import { craft as coreCraft } from '../core/crafting';
import * as inv from '../core/inventory';
import { itemName } from '../core/itemData';
import { BATTLE_SLOTS, MINING_SLOTS, setOfSlot } from '../core/items';
import type { GearItem, Slot } from '../core/items';
import { drainOverflow } from '../core/loot';
import { leaveMap as coreLeaveMap, startMap as coreStartMap } from '../core/maps';
import { gamble as coreGamble, type GambleResult } from '../core/merchant';
import { newGame } from '../core/newGame';
import { soulUpgrade as coreSoulUpgrade, type SoulUpgradeCheck } from '../core/soulUpgrade';
import { buyStashPage as coreBuyStashPage } from '../core/stashPages';
import { decodeSave, encodeSave, type DecodeResult } from '../core/save';
import { freshWorld, isValidSeedText, seedFromText } from '../core/seed';
import { deriveStats } from '../core/stats';
import { summarize } from '../core/summary';
import type {
  CraftCheck, CraftKind, CraftResult, DropTarget, FindRecord, GameState, InvResult, ItemLoc, LootRule, MotionSettings,
  OfflineSummary, Stats, TemperOutcome, TickEvent,
} from '../core/types';
import { BACKUP_PREFIX, SAVE_KEY, type StorageLike } from './storage';

/** Gear just worn into a slot that was empty; `id` counts up so the UI can tell one from the next. */
export interface EquipNotice { id: number; slot: Slot; name: string; rarity: GearItem['rarity'] }

/** The newest craft, refused or not, for the crafting message; `id` counts up so the UI can tell one from the next. */
export interface CraftNotice { id: number; target: ItemLoc; kind: CraftKind; check: CraftCheck; temper?: TemperOutcome }

export interface Feedback {
  gold: number;
  diamonds: number;
  finds: FindRecord[];
  /** The newest auto strikes of a map; click strikes are not here, the click already showed them. */
  strikes: { amount: number; crit: boolean }[];
  /** Damage the player took, summed. */
  hurt: number;
}

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
const MAX_STRIKES = 6;
const ALL_SLOTS: readonly Slot[] = [...MINING_SLOTS, ...BATTLE_SLOTS];
const emptyFeedback = (): Feedback => ({ gold: 0, diamonds: 0, finds: [], strikes: [], hurt: 0 });

export class GameStore {
  private _state: GameState;
  private _stats: Stats;
  private _battle: BattleStats;
  private _version = 0;
  private _summary: OfflineSummary | null = null;
  private _notice: Notice = null;
  private _unreadable: string | null = null;
  private _equipNotice: EquipNotice | null = null;
  private noticeCount = 0;
  private _lastCraft: CraftNotice | null = null;
  private craftCount = 0;
  private _lastGamble: GearItem | null = null;
  private feedback: Feedback = emptyFeedback();
  private readonly listeners = new Set<() => void>();
  private limiter = new ClickLimiter();
  // UI state, never saved: another view pauses live digging, and a hidden tab lifts that, since away counts as idle.
  private viewPaused = false;
  private hidden = false;

  constructor(private readonly deps: Deps) {
    this._state = freshWorld(deps.newSeed, deps.now());
    this._stats = deriveStats(this._state);
    this._battle = deriveBattleStats(this._state);
  }

  get state(): GameState { return this._state; }
  get stats(): Stats { return this._stats; }
  get battle(): BattleStats { return this._battle; }
  get version(): number { return this._version; }
  get offlineSummary(): OfflineSummary | null { return this._summary; }
  get notice(): Notice { return this._notice; }
  get unreadableSave(): string | null { return this._unreadable; }
  get equipNotice(): EquipNotice | null { return this._equipNotice; }
  get lastCraft(): CraftNotice | null { return this._lastCraft; }
  /** The newest item bought from the merchant, for its "You got" panel. */
  get lastGamble(): GearItem | null { return this._lastGamble; }
  /** Whether live ticks dig: the player's Pause always holds, the view pause only while the tab is on screen. */
  get digPaused(): boolean { return this._state.paused || (this.viewPaused && !this.hidden); }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private changed(): void {
    this._stats = deriveStats(this._state);
    this._battle = deriveBattleStats(this._state);
    this._version++;
    for (const fn of [...this.listeners]) fn();
  }

  // A loaded save may hold loot that now has room (schema 6 gave it a bigger bag), so `load` and `importSave` drain it.
  private replaceState(state: GameState): void {
    this._state = state;
    this._equipNotice = null;
    this._lastCraft = null;
    this._lastGamble = null;
    this._stats = deriveStats(state);
    this._battle = deriveBattleStats(state);
  }

  /**
   * Advances to now; returns the ticks applied. Clones a "before" snapshot only when a summary is possible.
   * Offline catch-up gates digging on the player's Pause alone: the view the game was left on doesn't matter.
   */
  private catchUp(events?: TickEvent[], live = false): number {
    const now = this.deps.now();
    const state = this._state;
    const stats = this._stats;
    const summaryPossible =
      now - state.lastTickAt >= (OFFLINE_SUMMARY_MIN_TICKS * 1000) / stats.autoTicksPerSecond;
    const before = summaryPossible ? structuredClone(state) : null;
    const elapsed = now - state.lastTickAt;
    const ticks = advance(state, now, stats, events, live ? this.digPaused : state.paused);
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
        drainOverflow(this._state);
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
    const ticks = this.catchUp(events, true);
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
      else if (e.kind === 'strike' && !e.click) fb.strikes.push({ amount: e.amount, crit: e.crit });
      else if (e.kind === 'hurt') fb.hurt += e.amount;
    }
    if (fb.finds.length > MAX_FINDS) fb.finds = fb.finds.slice(-MAX_FINDS);
    if (fb.strikes.length > MAX_STRIKES) fb.strikes = fb.strikes.slice(-MAX_STRIKES);
  }

  click(): TickEvent[] {
    if (!this.limiter.tryClick(this.deps.now())) return [];
    const events: TickEvent[] = [];
    // A map click is one strike; digging ticks would fast-forward the fight.
    if (this._state.activity.kind === 'map') clickHit(this._state, events);
    else clickTicks(this._state, this._stats, events);
    this.changed();
    return events;
  }

  startMap(mapId: number): 'ok' | 'busy' | 'invalid' {
    const result = coreStartMap(this._state, mapId);
    if (result === 'ok') {
      // a map from the bag frees its cell: the oldest held find takes it, before any of the run's drops
      drainOverflow(this._state);
      this.changed();
    }
    return result;
  }

  leaveMap(): boolean {
    const left = coreLeaveMap(this._state);
    if (left) this.changed();
    return left;
  }

  dismissRun(): void {
    const run = this._state.lastRun;
    if (run === null || run.seen) return;
    run.seen = true;
    this.changed();
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
  sendItem(from: ItemLoc, to: 'stash' | 'bag'): InvResult { return this.act(() => inv.sendItem(this._state, from, to)); }
  socketGem(gem: ItemLoc, into: ItemLoc): InvResult { return this.act(() => inv.socketGem(this._state, gem, into)); }
  sell(from: ItemLoc): InvResult { return this.act(() => inv.sell(this._state, from)); }
  salvage(from: ItemLoc): InvResult { return this.act(() => inv.salvage(this._state, from)); }
  drop(from: ItemLoc, to: DropTarget): InvResult {
    return this.act(() => inv.dropItem(this._state, from, to, (target, item, result) => this.noteCraft(target, item.material, result)));
  }

  /** Crafts on gear or a map; only an 'ok' changes anything, but either way it is the last craft. */
  craft(target: ItemLoc, kind: CraftKind, from?: ItemLoc): CraftResult {
    let result: CraftResult = { check: 'notGear' };
    this.act(() => {
      result = coreCraft(this._state, target, kind, from);
      this.noteCraft(target, kind, result);
      return result.check === 'ok' ? 'ok' : 'craftRefused';
    });
    return result;
  }

  /** Raises battle gear an item level for Souls; only an 'ok' changes anything. */
  soulUpgrade(target: ItemLoc): SoulUpgradeCheck {
    const result = coreSoulUpgrade(this._state, target);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Gambles Gold on an item of `slot`; only an 'ok' changes anything. */
  gamble(slot: Slot): { result: GambleResult; item?: GearItem } {
    const outcome = coreGamble(this._state, slot);
    if (outcome.item !== undefined) {
      // a snapshot: the panel shows what was bought, not what later crafts or moves make of it
      this._lastGamble = structuredClone(outcome.item);
      this.changed();
    }
    return outcome;
  }

  private noteCraft(target: ItemLoc, kind: CraftKind, result: CraftResult): void {
    this._lastCraft = { id: ++this.craftCount, target: { ...target }, kind, ...result };
  }

  /** A bought General page is new room, so held loot may come in. */
  buyStashPage(): 'ok' | 'noGold' | 'full' {
    const result = coreBuyStashPage(this._state);
    if (result === 'ok') {
      drainOverflow(this._state);
      this.changed();
    }
    return result;
  }

  setLootFilter(rules: LootRule[]): void {
    this._state.settings.lootFilter = rules.slice(0, MAX_LOOT_RULES).map((r) => ({ ...r }));
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
      drainOverflow(this._state);
      this._unreadable = null;
      this.clearLoadFailed();
      this._summary = null;
      this.feedback = emptyFeedback();
      // the save's time away is dug now, as on load: the next live tick may be paused by the view it was imported from
      this.catchUp();
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

  /** The player's Pause; it is saved, so a paused game stays paused after a reload. */
  setPaused(paused: boolean): void {
    this._state.paused = paused;
    this.changed();
  }

  setViewPaused(paused: boolean): void { this.viewPaused = paused; }
  setHidden(hidden: boolean): void { this.hidden = hidden; }

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
