import { useEffect, useState } from 'react';
import { ICON_GLYPHS, ICON_PALETTE, type IconGlyphId } from '../../core/skillIcons';
import type { AchievementNotification, GameStore } from '../../store/gameStore';
import { iconDataUrl } from '../PixelArt';
import { effectiveMotion, usePrefersReducedMotion } from '../settings/motion';
import { useGame } from '../useGame';
import './achievements.css';

/** How long an untouched toast lingers before it fades itself out. */
export const ACHIEVEMENT_TOAST_MS = 6000;
/** The slide-down / fade-out duration, kept short so the mine never waits on it. */
export const ACHIEVEMENT_TOAST_LEAVE_MS = 240;
/** The most toasts on screen at once; the rest wait in the store's queue. */
export const ACHIEVEMENT_TOAST_CAP = 5;

/** The family's pixel glyph, drawn at `size` px with crisp nearest-neighbour scaling. */
function AchievementGlyph({ id, size }: { id: IconGlyphId; size: number }) {
  const glyph = ICON_GLYPHS[id];
  return (
    <img
      className="gm-ach-toast__icon"
      src={iconDataUrl(glyph.grid, ICON_PALETTE)}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      alt=""
      draggable={false}
    />
  );
}

/** One toast: icon, eyebrow, name, description and an X that closes it; auto-dismisses after a short pause. */
function AchievementToast({ notification, onDismiss }: {
  notification: AchievementNotification;
  onDismiss: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  // Untouched, the toast fades itself out after the pause; the X starts the same leave sequence early.
  useEffect(() => {
    if (leaving) return undefined;
    const timer = setTimeout(() => setLeaving(true), ACHIEVEMENT_TOAST_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  // Once leaving, let the fade play, then remove the toast from the store's queue.
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => onDismiss(notification.id), ACHIEVEMENT_TOAST_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDismiss, notification.id]);
  return (
    <div className="gm-ach-toast" data-leaving={leaving} role="status">
      <AchievementGlyph id={notification.icon} size={36} />
      <div className="gm-ach-toast__body">
        <span className="gm-ach-toast__eyebrow">Achievement</span>
        <strong className="gm-ach-toast__name">{notification.name}</strong>
        <span className="gm-ach-toast__desc">{notification.desc}</span>
      </div>
      <button type="button" className="gm-ach-toast__close" aria-label="Dismiss" onClick={() => setLeaving(true)}>
        ×
      </button>
    </div>
  );
}

/** The fixed top-of-screen stack: FIFO, capped, newest on top, only the toasts themselves catch the pointer. */
export function AchievementToastStack({ store }: { store: GameStore }) {
  useGame(store);
  const reduced = usePrefersReducedMotion();
  const motion = effectiveMotion(store.state.settings.motion, reduced);
  const visible = store.notifications.slice(0, ACHIEVEMENT_TOAST_CAP);
  if (visible.length === 0) return null;
  return (
    <div className="gm-ach-toasts" data-motion={motion.floats ? 'on' : 'off'}>
      <button
        type="button"
        className="gm-ach-toasts__clear"
        onClick={() => store.dismissAll()}
      >
        Dismiss all
      </button>
      {visible.map((notification) => (
        <AchievementToast
          key={notification.id}
          notification={notification}
          onDismiss={(id) => store.dismissNotification(id)}
        />
      ))}
    </div>
  );
}
