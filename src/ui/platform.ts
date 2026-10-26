/** Read once: on a Mac, Ctrl+click is the context menu, so Cmd+click (`metaKey`) sells instead. */
export const IS_MAC: boolean = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The key that sells with a click, as the hover card names it. */
export function sellKey(mac: boolean): string {
  return mac ? '⌘' : 'Ctrl';
}
