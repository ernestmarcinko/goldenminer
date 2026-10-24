import { TAB_LOCK_STALE_MS } from '../core/balance';
import { TAB_KEY, type StorageLike } from './storage';

interface LockRecord { id: string; beat: number }

export class TabLock {
  /** True once this tab's record was written; a missing record after that means the lock was lost. */
  private written = false;

  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number,
    private readonly id: string,
  ) {}

  private read(): LockRecord | null {
    try {
      const raw = this.storage.getItem(TAB_KEY);
      if (raw === null) return null;
      const rec: unknown = JSON.parse(raw);
      if (typeof rec !== 'object' || rec === null) return null;
      const { id, beat } = rec as Record<string, unknown>;
      if (typeof id !== 'string' || typeof beat !== 'number' || !Number.isFinite(beat)) return null;
      return { id, beat };
    } catch {
      return null;
    }
  }

  private write(): void {
    try {
      this.storage.setItem(TAB_KEY, JSON.stringify({ id: this.id, beat: this.now() }));
      this.written = true;
    } catch {
      this.written = false;
      // an unwritable lock cannot exclude anyone; stay playable
    }
  }

  tryAcquire(): boolean {
    const rec = this.read();
    if (rec === null || rec.id === this.id || this.now() - rec.beat > TAB_LOCK_STALE_MS) {
      this.write();
      return true;
    }
    return false;
  }

  heartbeat(): boolean {
    const rec = this.read();
    if (rec !== null && rec.id !== this.id) return false;
    if (rec === null && this.written) return false;
    this.write();
    return true;
  }

  takeOver(): void {
    this.write();
  }

  release(): void {
    try {
      if (this.read()?.id === this.id) this.storage.removeItem(TAB_KEY);
    } catch {
      // nothing to release
    }
  }
}
