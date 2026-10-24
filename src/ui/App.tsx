import { useLayoutEffect, useRef, useState } from 'react';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';
import { startGame, type GameLoop } from './gameLoop';
import { CharacterPanel } from './character/CharacterPanel';
import { Header } from './Header';
import { MineView } from './mine/MineView';
import { Notices } from './Notices';
import { OfflineSummary } from './OfflineSummary';
import { SettingsDialog } from './settings/SettingsDialog';
import { TabBlocked } from './TabBlocked';
import { useGame } from './useGame';

export function App({ store, lock }: { store: GameStore; lock: TabLock }) {
  // Loading happens in the initializer, not an effect, so the first paint already shows the loaded game.
  // StrictMode runs it twice in dev, which is harmless.
  const [blocked, setBlocked] = useState(() => {
    if (!lock.tryAcquire()) return true;
    store.load();
    return false;
  });
  const loop = useRef<GameLoop | null>(null);
  useLayoutEffect(() => {
    if (blocked) return undefined;
    const running = startGame(store, lock, () => setBlocked(true));
    loop.current = running;
    return () => {
      running.stop();
      loop.current = null;
    };
  }, [blocked, store, lock]);

  if (blocked) {
    return (
      <TabBlocked
        onPlayHere={() => {
          lock.takeOver();
          store.load();
          setBlocked(false);
        }}
      />
    );
  }
  return <Game store={store} runAsOwner={(action) => loop.current?.runAsOwner(action) ?? false} />;
}

function Game({ store, runAsOwner }: { store: GameStore; runAsOwner: (action: () => void) => boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { offlineSummary } = useGame(store);
  return (
    <div className="gm-app">
      <Header store={store} onOpenSettings={() => setSettingsOpen(true)} />
      <Notices store={store} />
      <main className="gm-app__main">
        <div className="gm-app__play"><MineView store={store} /></div>
        <div className="gm-app__side"><CharacterPanel store={store} /></div>
      </main>
      {offlineSummary && <OfflineSummary summary={offlineSummary} onClose={() => store.dismissSummary()} />}
      {settingsOpen && <SettingsDialog store={store} runAsOwner={runAsOwner} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
