/** Read once: on a Mac, Ctrl+click is the context menu, so Cmd+click (`metaKey`) sells instead. */
export const IS_MAC: boolean = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The key that sells with a click, as the hover card names it. */
export function sellKey(mac: boolean): string {
  return mac ? '⌘' : 'Ctrl';
}

let pointerType = 'mouse';

// Installed as the module loads, so the tap that opened a view already counts when its first cells mount.
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => { pointerType = e.pointerType; }, { capture: true });
}

/**
 * The kind of pointer last pressed anywhere on the page ('mouse' until one is). A cell that mounts under a resting
 * pointer has no pointerdown of its own to ask, and a touch leaves `:hover` stuck where it tapped.
 */
export function lastPointerType(): string {
  return pointerType;
}
