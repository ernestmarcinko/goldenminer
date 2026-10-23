import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SpriteAtlas } from './atlas';
import { buildPlaceholderAtlas } from './placeholderAtlas';

const AtlasContext = createContext<SpriteAtlas | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  const atlas = useMemo(() => buildPlaceholderAtlas(), []);
  return <AtlasContext.Provider value={atlas}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): SpriteAtlas {
  const atlas = useContext(AtlasContext);
  if (!atlas) throw new Error('useAtlas must be used inside <AtlasProvider>');
  return atlas;
}
