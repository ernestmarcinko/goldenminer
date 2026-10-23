import { OFFLINE_SUMMARY_MIN_TICKS } from '../core/balance';
import { advance, ClickLimiter, clickTicks } from '../core/clock';
import { moveTo as coreMoveTo } from '../core/dig';
import { newGame } from '../core/newGame';
import { decodeSave, encodeSave, type DecodeResult } from '../core/save';
import { deriveStats } from '../core/stats';
import { summarize } from '../core/summary';
import type { FindRecord, GameState, OfflineSummary, Stats, TickEvent } from '../core/types';
import { BACKUP_PREFIX, SAVE_KEY, type StorageLike } from './storage';

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
const emptyFeedback = (): Feedback => ({ gold: 0, diamonds: 0, finds: [] });

export class GameStore {
  private _state: GameState;
  private _stats: Stats;
  private _version = 0;
  private _summary: OfflineSummary | null = null;
  private _notice: Notice = null;
  private _unreadable: string | null = null;
  private feedback: Feedback = emptyFeedback();
  private readonly listeners = new Set<() => void>();
  private limiter = new ClickLimiter();

  constructor(private readonly deps: Deps) {
    this._state = newGame(deps.newSeed(), deps.now());
    this._stats = deriveStats(this._state);
  }

  get state(): GameState { return this._state; }
  get stats(): Stats { return this._stats; }
  get version(): number { return this._version; }
  get offlineSummary(): OfflineSummary | null { return this._summary; }
  get notice(): Notice { return this._notice; }
  get unreadableSave(): string | null { return this._unreadable; }

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
      this._summary = summarize(before, state, elapsed, ticks);
    }
    return ticks;
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
      this.replaceState(newGame(this.deps.newSeed(), now()));
    } else {
      const result = decodeSave(raw);
      if (result.ok) {
        this.replaceState(result.state);
      } else {
        const backupKey = BACKUP_PREFIX + now();
        let backedUp = true;
        try { storage.setItem(backupKey, raw); } catch { backedUp = false; }
        this.replaceState(newGame(this.deps.newSeed(), now()));
        this._unreadable = backedUp ? null : raw;
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
      this._summary = null;
      this.feedback = emptyFeedback();
      this.changed();
    }
    return result;
  }

  hardReset(): void {
    this._unreadable = null;
    this.replaceState(newGame(this.deps.newSeed(), this.deps.now()));
    this._summary = null;
    this.feedback = emptyFeedback();
    this.changed();
    this.save();
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
