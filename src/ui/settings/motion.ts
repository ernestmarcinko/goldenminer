import { useEffect, useState } from 'react';
import type { MotionSettings } from '../../core/types';

const QUERY = '(prefers-reduced-motion: reduce)';

/** The motion the player actually gets: a system request for reduced motion turns every setting off. */
export function effectiveMotion(m: MotionSettings, reduced: boolean): MotionSettings {
  return reduced ? { floats: false, pops: false, lampFlicker: false, shaft: 'off' } : m;
}

function query(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

/** Follows the system's reduced-motion preference, including changes while the game is open. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const mql = query();
    if (!mql) return undefined;
    const onChange = (): void => setReduced(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
