export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export const SAVE_KEY = 'goldenminer.save';
export const BACKUP_PREFIX = 'goldenminer.save.backup.';
export const TAB_KEY = 'goldenminer.tab';
const PROBE_KEY = 'goldenminer.probe';

export class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();

  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }

  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }

  removeItem(k: string): void {
    this.data.delete(k);
  }

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
}

export function safeStorage(getLocal: () => Storage): { storage: StorageLike; available: boolean } {
  try {
    const local = getLocal();
    local.setItem(PROBE_KEY, '1');
    local.removeItem(PROBE_KEY);
    return { storage: local, available: true };
  } catch {
    return { storage: new MemoryStorage(), available: false };
  }
}
