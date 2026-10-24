import { useEffect, useState } from 'react';
import type { EquipNotice, GameStore } from '../store/gameStore';
import { useGame } from './useGame';

export const EQUIP_TOAST_MS = 2000;

/** The latest equip into an empty slot for `EQUIP_TOAST_MS` after it happens; it is gone at once if the state is replaced. */
export function useRecentEquip(store: GameStore): EquipNotice | null {
  const latest = useGame(store).equipNotice;
  const [shown, setShown] = useState<EquipNotice | null>(null);
  const id = latest?.id;
  useEffect(() => {
    setShown(store.equipNotice);
    if (id === undefined) return undefined;
    const timer = setTimeout(() => setShown(null), EQUIP_TOAST_MS);
    return () => clearTimeout(timer);
  }, [store, id]);
  return shown !== null && shown.id === id ? shown : null;
}

/** "Equipped <name>" for a moment after an item goes into an empty slot. Appears and goes without animating. */
export function Toast({ store }: { store: GameStore }) {
  const notice = useRecentEquip(store);
  if (notice === null) return null;
  return (
    <div className="gm-toast" role="status">
      <span className="gm-toast__dot" aria-hidden="true" />
      <span>
        Equipped{' '}
        <strong className="gm-toast__name" data-rarity={notice.rarity}>{notice.name}</strong>
      </span>
    </div>
  );
}
