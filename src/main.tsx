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
const lock = new TabLock(storage, Date.now, crypto.randomUUID());

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AtlasProvider>
        <App store={store} lock={lock} />
      </AtlasProvider>
    </StrictMode>,
  );
}
