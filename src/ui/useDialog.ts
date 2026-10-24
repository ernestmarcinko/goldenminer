import { useEffect, useRef } from 'react';

/** Focuses the element behind the returned ref on open and calls onClose on Escape. */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const focusRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    focusRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return focusRef;
}
