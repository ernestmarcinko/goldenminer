import { ascend as coreAscend } from '../core/ascend';
import { allocateAscendancy as coreAllocateAscendancy } from '../core/ascendancy';
import { ACHIEVEMENT_BY_ID, achievementIcon, checkFeats } from '../core/achievements';
import { autoMapping, queueForAutoMap as coreQueueForAutoMap, tryAutoMap, unqueueForAutoMap as coreUnqueueForAutoMap } from '../core/autoMap';
import { LONG_GAP_MS, MAX_LOOT_RULES, OFFLINE_SUMMARY_MIN_TICKS } from '../core/balance';
import { deriveBattleStats, type BattleStats } from '../core/battle';
import { advance, ClickLimiter, clickTicks } from '../core/clock';
import { craft as coreCraft, targetedCraft as coreTargetedCraft } from '../core/crafting';
import * as inv from '../core/inventory';
import { itemName } from '../core/itemData';
import { BATTLE_SLOTS, MINING_SLOTS, orbKey, orbName, setOfSlot } from '../core/items';
import type { GearItem, Material, OrbFamily, OrbSide, OrbTier, Slot } from '../core/items';
import { drainOverflow } from '../core/loot';
import { ruleValid } from '../core/lootFilter';
import { leaveMap as coreLeaveMap, startMap as coreStartMap } from '../core/maps';
import { gamble as coreGamble, type GambleResult } from '../core/merchant';
import { isValidCharacterName, randomCharacterName } from '../core/names';
import { newGame } from '../core/newGame';
import { buyOrb as coreBuyOrb, tradeOres as coreTradeOres, type MarketResult } from '../core/oreMarket';
import type { IconGlyphId } from '../core/skillIcons';
import {
  allocate as coreAllocate, allocateMany as coreAllocateMany, refund as coreRefund, refundMany as coreRefundMany,
  resetWeb as coreResetWeb,
} from '../core/respec';
import { soulUpgrade as coreSoulUpgrade, type SoulUpgradeCheck } from '../core/soulUpgrade';
import { buyStashPage as coreBuyStashPage } from '../core/stashPages';
import { testCheat as coreTestCheat, type TestCheat } from '../core/testCheat';
import { decodeSave, encodeSave, type DecodeResult } from '../core/save';
import { freshWorld, isValidSeedText, randomSeedText as coreRandomSeedText, seedFromText } from '../core/seed';
import { buyStock as coreBuyStock, type BuyResult } from '../core/trader';
import { deriveStats } from '../core/stats';
import { summarize } from '../core/summary';
import type {
  CraftCheck, CraftKind, CraftResult, DropTarget, FindRecord, GameState, InvResult, ItemLoc, LootRule, MotionSettings,
  OfflineSummary, Stats, TargetedCraft, TemperOutcome, TickEvent,
} from '../core/types';
import { BACKUP_PREFIX, SAVE_KEY, type StorageLike } from './storage';
import type { SpriteName } from '../sprites/atlas';
import { itemSprite, orbSprite } from '../ui/character/itemView';

/** Gear just worn into a slot that was empty; `id` counts up so the UI can tell one from the next. */
export interface EquipNotice { id: number; slot: Slot; name: string; rarity: GearItem['rarity'] }

/** The newest craft, refused or not, for the crafting message; `id` counts up so the UI can tell one from the next. */
export interface CraftNotice { id: number; target: ItemLoc; kind: CraftKind; check: CraftCheck; temper?: TemperOutcome }

/** The newest successful vendor buy, for the fly-in animation; `id` counts up so React re-triggers it. */
export interface BuyNotice { id: number; key: string; name: string; sprite: SpriteName; from: 'refiner' | 'trader' }

/** An earned achievement queued for a pop-down toast; transient store state, never written into the save. */
export interface AchievementNotification { id: number; icon: IconGlyphId; name: string; desc: string }

export interface Feedback {
  gold: number;
  diamonds: number;
  finds: FindRecord[];
  /** The newest strikes of a map. */
  strikes: { amount: number; crit: boolean }[];
  /** Damage the player took, summed. */
  hurt: number;
  /** Dig ticks since the last drain, one per tick that advanced the face. */
  digs: number;
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
const emptyFeedback = (): Feedback => ({ gold: 0, diamonds: 0, finds: [], strikes: [], hurt: 0, digs: 0 });

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
  private _lastBuy: BuyNotice | null = null;
  private buyCount = 0;
  private feedback: Feedback = emptyFeedback();
  private readonly listeners = new Set<() => void>();
  private limiter = new ClickLimiter();
  // UI state, never saved: another view pauses live digging, and a hidden tab lifts that, since away counts as idle.
  private viewPaused = false;
  private hidden = false;
  // Transient achievement-toast queue, never saved: newest first, capped for display by the stack. `notifId` counts up so
  // React can tell one toast from the next; `lastEarned` is how many of the append-only `earned` ids are already queued.
  private _notifications: AchievementNotification[] = [];
  private notifId = 0;
  private lastEarned = 0;

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
  /** The newest vendor buy, for the fly-in animation. */
  get lastBuy(): BuyNotice | null { return this._lastBuy; }
  /** The queued achievement toasts, newest first. Transient: never written into the save. */
  get notifications(): readonly AchievementNotification[] { return this._notifications; }
  /** Whether live ticks dig: the player's Pause always holds, the view pause only while the tab is on screen. */
  get digPaused(): boolean { return this._state.paused || (this.viewPaused && !this.hidden); }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Whether a save exists in storage; false on a first launch (or when storage cannot be read). */
  hasSave(): boolean {
    try {
      return this.deps.storage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /** A random character name, drawn from the same RNG stream the game uses. */
  randomName(): string {
    return randomCharacterName(this.deps.newSeed);
  }

  /** A random seed text, drawn from the same RNG stream the game uses. */
  randomSeedText(): string {
    return coreRandomSeedText(this.deps.newSeed);
  }

  private changed(): void {
    this._stats = deriveStats(this._state);
    this._battle = deriveBattleStats(this._state);
    this.enqueueNewAchievements();
    this._version++;
    for (const fn of [...this.listeners]) fn();
  }

  /**
   * Diffs the append-only `state.achievements.earned`: any id past `lastEarned` was earned by the mutation that just ran,
   * so map it to its def and queue a toast. Reading the tail never reads or advances `state.rng`, so the loot stream is
   * untouched and a no-achievement mutation enqueues nothing.
   */
  private enqueueNewAchievements(): void {
    const earned = this._state.achievements.earned;
    if (earned.length <= this.lastEarned) {
      this.lastEarned = earned.length;
      return;
    }
    const fresh = earned.slice(this.lastEarned);
    this.lastEarned = earned.length;
    for (const id of fresh) {
      const def = ACHIEVEMENT_BY_ID.get(id);
      if (def === undefined) continue;
      this._notifications.unshift({
        id: ++this.notifId,
        icon: achievementIcon(def),
        name: def.name,
        desc: def.desc,
      });
    }
  }

  // A loaded save may hold loot that now has room (schema 6 gave it a bigger bag), so `load` and `importSave` drain it.
  private replaceState(state: GameState): void {
    this._state = state;
    this._equipNotice = null;
    this._lastCraft = null;
    this._lastGamble = null;
    this._lastBuy = null;
    this._notifications = [];
    this.lastEarned = state.achievements.earned.length;
    this._stats = deriveStats(state);
    this._battle = deriveBattleStats(state);
  }

  /**
   * Advances to now; returns the ticks applied. Clones a "before" snapshot only when a summary is possible.
   * Offline catch-up gates digging on the player's Pause alone: the view the game was left on doesn't matter. So does a
   * live tick after a long gap, as the computer slept and the player was away whatever view was showing.
   */
  private catchUp(events?: TickEvent[], live = false): number {
    const now = this.deps.now();
    const state = this._state;
    const stats = this._stats;
    const summaryPossible =
      now - state.lastTickAt >= (OFFLINE_SUMMARY_MIN_TICKS * 1000) / stats.autoTicksPerSecond;
    const before = summaryPossible ? structuredClone(state) : null;
    const elapsed = now - state.lastTickAt;
    const away = !live || elapsed > LONG_GAP_MS;
    const ticks = advance(state, now, stats, events, away ? state.paused : this.digPaused, away);
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
      else if (e.kind === 'strike') fb.strikes.push({ amount: e.amount, crit: e.crit });
      else if (e.kind === 'hurt') fb.hurt += e.amount;
      else if (e.kind === 'dig') fb.digs += 1;
    }
    if (fb.finds.length > MAX_FINDS) fb.finds = fb.finds.slice(-MAX_FINDS);
    if (fb.strikes.length > MAX_STRIKES) fb.strikes = fb.strikes.slice(-MAX_STRIKES);
  }

  click(): TickEvent[] {
    // A map's fight is automatic, and digging ticks would fast-forward it: a click there does nothing.
    if (this._state.activity.kind === 'map') return [];
    if (!this.limiter.tryClick(this.deps.now())) return [];
    const events: TickEvent[] = [];
    clickTicks(this._state, this._stats, events);
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
  socketGem(gem: ItemLoc, into: ItemLoc): InvResult { return this.act(() => inv.socketInto(this._state, gem, into)); }
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

  /** A targeted craft on gear; only an 'ok' changes anything. */
  targetedCraft(target: ItemLoc, action: TargetedCraft): CraftResult {
    let result: CraftResult = { check: 'notGear' };
    this.act(() => {
      result = coreTargetedCraft(this._state, target, action);
      return result.check === 'ok' ? 'ok' : 'craftRefused';
    });
    return result;
  }

  /** Buys an orb from the Refiner; only an 'ok' changes anything, and records the buy for the fly-in animation. */
  buyOrb(family: OrbFamily, side: OrbSide | undefined, tier: OrbTier | undefined): MarketResult {
    const result = coreBuyOrb(this._state, family, side, tier);
    if (result === 'ok') {
      this._lastBuy = {
        id: ++this.buyCount, key: orbKey(family, side, tier),
        name: orbName({ id: 0, type: 'orb', family, side, tier, count: 1 }), sprite: orbSprite(family, side, tier), from: 'refiner',
      };
      this.changed();
    }
    return result;
  }

  /** Exchanges ores at the Refiner; only an 'ok' changes anything. */
  tradeOres(from: Material, to: Material, amount: number): MarketResult {
    const result = coreTradeOres(this._state, from, to, amount);
    if (result === 'ok') this.changed();
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

  /** Buys a slot of the Trader's stock; only an 'ok' changes anything, and records the buy for the fly-in animation. */
  buyStock(index: number): BuyResult {
    const { result, item } = coreBuyStock(this._state, index);
    if (result === 'ok') {
      if (item !== undefined) {
        this._lastBuy = {
          id: ++this.buyCount, key: String(item.id), name: itemName(item), sprite: itemSprite(item), from: 'trader',
        };
      }
      this.changed();
    }
    return result;
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

  /** Allocates a passive node; only an 'ok' changes anything. */
  allocate(id: string): ReturnType<typeof coreAllocate> {
    const result = coreAllocate(this._state, id);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Allocates a staged sequence of passive nodes; only an 'ok' changes anything. */
  allocateMany(ids: readonly string[]): ReturnType<typeof coreAllocateMany> {
    const result = coreAllocateMany(this._state, ids);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Refunds a passive node for Gold; only an 'ok' changes anything. */
  refund(id: string): ReturnType<typeof coreRefund> {
    const result = coreRefund(this._state, id);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Refunds a staged set of passive nodes for Gold; only an 'ok' changes anything. */
  refundMany(ids: readonly string[]): ReturnType<typeof coreRefundMany> {
    const result = coreRefundMany(this._state, ids);
    if (result === 'ok') this.changed();
    return result;
  }

  /** A full web reset for Diamonds; only an 'ok' changes anything. */
  resetWeb(): ReturnType<typeof coreResetWeb> {
    const result = coreResetWeb(this._state);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Trades a finished run for permanent ascendancy points; only an 'ok' changes anything. */
  ascend(): ReturnType<typeof coreAscend> {
    const result = coreAscend(this._state);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Allocates an ascendancy node for a permanent point; only an 'ok' changes anything. */
  allocateAscendancy(id: string): ReturnType<typeof coreAllocateAscendancy> {
    const result = coreAllocateAscendancy(this._state, id);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Queues a held map for away-time auto-mapping; only an 'ok' changes anything. */
  queueForAutoMap(id: number): ReturnType<typeof coreQueueForAutoMap> {
    const result = coreQueueForAutoMap(this._state, id);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Takes a map id out of the auto-map queue; only an 'ok' changes anything. */
  unqueueForAutoMap(id: number): ReturnType<typeof coreUnqueueForAutoMap> {
    const result = coreUnqueueForAutoMap(this._state, id);
    if (result === 'ok') this.changed();
    return result;
  }

  /** Turns auto-mapping on or off; only a real change notifies. */
  setAutoMap(on: boolean): void {
    if (this._state.autoMap.on === on) return;
    this._state.autoMap.on = on;
    this.changed();
  }

  /** Turns auto-mapping on and starts the first eligible queued map at once, so the trigger begins the battle now. */
  startAutoMap(): 'ok' | 'locked' | 'nothing' {
    if (!autoMapping(this._state)) return 'locked';
    this._state.autoMap.on = true;
    const started = tryAutoMap(this._state);
    this.changed();
    return started ? 'ok' : 'nothing';   // 'nothing' means the chain found nothing eligible and switched itself off
  }

  /** Applies a test cheat (dev-only Test tool); always notifies. */
  testCheat(action: TestCheat): void {
    coreTestCheat(this._state, action);
    this.changed();
  }

  setLootFilter(rules: LootRule[]): void {
    // a rule that could never match is dropped, so a save never holds one
    this._state.settings.lootFilter = rules.filter(ruleValid).slice(0, MAX_LOOT_RULES).map((r) => ({ ...r }));
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

  /** Starts a new world named `name` from typed seed text, or a random one for `null`; refuses an invalid name or text. */
  newWorld(name: string, seedText: string | null): boolean {
    const trimmed = name.trim();
    if (!isValidCharacterName(trimmed)) return false;
    const { newSeed, now } = this.deps;
    let world: GameState;
    if (seedText === null) {
      world = freshWorld(newSeed, now());
      world.characterName = trimmed;
    } else if (isValidSeedText(seedText)) {
      const text = seedText.trim();
      world = newGame(seedFromText(text), now(), { seedText: text, lootSeed: newSeed(), name: trimmed });
    } else {
      return false;
    }
    this._unreadable = null;
    this.clearLoadFailed();
    this.replaceState(world);
    checkFeats(this._state, { kind: 'rename', name: trimmed });
    this._summary = null;
    this.feedback = emptyFeedback();
    this.changed();
    this.save();
    return true;
  }

  /** Renames the current miner (trimmed); refuses an invalid name and leaves the old one. The rename feats see every change. */
  renameCharacter(name: string): boolean {
    const trimmed = name.trim();
    if (!isValidCharacterName(trimmed)) return false;
    this._state.characterName = trimmed;
    checkFeats(this._state, { kind: 'rename', name: trimmed });
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

  /** Removes one queued toast; a no-op when its id is already gone. */
  dismissNotification(id: number): void {
    const next = this._notifications.filter((n) => n.id !== id);
    if (next.length === this._notifications.length) return;
    this._notifications = next;
    this.changed();
  }

  /** Removes every queued toast at once. */
  dismissAll(): void {
    if (this._notifications.length === 0) return;
    this._notifications = [];
    this.changed();
  }
}
