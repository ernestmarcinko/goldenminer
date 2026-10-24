import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AtlasProvider } from './sprites/AtlasContext';
import { GameStore } from './store/gameStore';
import { safeStorage } from './store/storage';
import { TabLock } from './store/tabLock';
import { App } from './ui/App';
import './ui/theme.css';
import './ui/app.css';

const { storage, available } = safeStorage(() => window.localStorage);
const store = new GameStore({
  storage,
  storageAvailable: available,
  now: Date.now,
  newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
});
const lock = new TabLock(storage, Date.now, typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join('-'),
);

const root = document.getElementById('root');
// Dev only (?gallery=monsters): every generated monster, for judging the part kit; the build drops it.
if (import.meta.env.DEV && root && new URLSearchParams(window.location.search).get('gallery') === 'monsters') {
  void import('./ui/MonsterGallery').then(({ MonsterGallery }) => createRoot(root).render(<StrictMode><MonsterGallery /></StrictMode>));
} else if (root) {
  createRoot(root).render(
    <StrictMode>
      <AtlasProvider>
        <App store={store} lock={lock} />
      </AtlasProvider>
    </StrictMode>,
  );
}
