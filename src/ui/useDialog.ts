import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { isTopDialog, nextDialogId, nextFocusIndex, popDialog, pushDialog } from './dialogStack';

const FOCUSABLE = 'button, input, select, textarea, [href], [tabindex]';

/** The dialog's tabbable descendants in document order (a radio group counts once, at its checked button). */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.getAttribute('tabindex') === '-1' || el.matches(':disabled')) return false;
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name !== '' && !el.checked) {
      return root.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`) === null;
    }
    return true;
  });
}

/** Where focus stands in `list`; between two entries (on a tabindex -1 element), the slot Tab should move from. */
function focusIndex(list: HTMLElement[], active: Element | null, backwards: boolean): number {
  if (active === null) return -1;
  const at = list.indexOf(active as HTMLElement);
  if (at >= 0) return at;
  const before = list.filter((el) => (el.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).length;
  return backwards ? before : before - 1;
}

/**
 * The element a dialog closing right before this one mounts had focus returned for. Settings swaps between its main
 * view and a sub-dialog by unmounting one and mounting the other, and the opener must survive that swap. It also
 * covers React StrictMode's double effect run (cleanup, then setup again), which is why the timeout re-checks
 * `handover === opener` before clearing it.
 */
let handover: HTMLElement | null = null;

/**
 * Keeps keyboard focus in a modal dialog. On open it focuses the element behind the returned ref and remembers who
 * had focus. While it is the topmost dialog, Escape closes it and Tab / Shift+Tab cycle through `dialogRef`'s
 * focusable descendants. On close, focus goes back to the remembered element if it would otherwise be lost.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void, dialogRef: RefObject<HTMLElement | null>) {
  const focusRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const id = nextDialogId();
    pushDialog(id);
    const active = document.activeElement;
    const opener = handover ?? (active instanceof HTMLElement && active !== document.body ? active : null);
    handover = null;
    focusRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (!isTopDialog(id)) return;
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      const root = dialogRef.current;
      if (e.key !== 'Tab' || root === null) return;
      const list = focusables(root);
      const next = list[nextFocusIndex(list.length, focusIndex(list, document.activeElement, e.shiftKey), e.shiftKey)];
      e.preventDefault();
      next?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      popDialog(id);
      handover = opener;
      setTimeout(() => {
        if (handover === opener) handover = null;
        const now = document.activeElement;
        if (opener?.isConnected && (now === null || now === document.body)) opener.focus();
      }, 0);
    };
  }, [dialogRef]);
  return focusRef;
}
