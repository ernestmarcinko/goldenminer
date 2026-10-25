import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';
import { startGame, type GameLoop } from './gameLoop';
import { CharacterPanel } from './character/CharacterPanel';
import { Header } from './Header';
import { MapsView } from './maps/MapsView';
import { MerchantView } from './merchant/MerchantView';
import { MineView } from './mine/MineView';
import { Nav, type View } from './Nav';
import { Notices } from './Notices';
import { OfflineSummary } from './OfflineSummary';
import { RunResultDialog } from './run/RunResultDialog';
import { RunView } from './run/RunView';
import { SettingsDialog } from './settings/SettingsDialog';
import { TabBlocked } from './TabBlocked';
import { Toast } from './Toast';
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
  const lastRunHeading = useRef<HTMLHeadingElement>(null);
  const { offlineSummary, state } = useGame(store);
  const running = state.activity.kind === 'map';
  const [view, setView] = useState<View>(running ? 'maps' : 'mine');
  // starting a run, from the Maps view or the stash, brings the player to the map
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running && !wasRunning.current) setView('maps');
    wasRunning.current = running;
  }, [running]);
  // digging runs only while the Mine view is on screen
  useEffect(() => store.setViewPaused(view !== 'mine'), [view, store]);
  return (
    <div className="gm-app">
      <Header store={store} onOpenSettings={() => setSettingsOpen(true)} />
      <Nav store={store} view={view} onView={setView} />
      <Notices store={store} />
      <main className="gm-app__main">
        <div className="gm-app__play">
          {view === 'mine' ? (
            <MineView store={store} onBackToMap={() => setView('maps')} />
          ) : view === 'merchant' ? (
            <MerchantView store={store} />
          ) : running ? (
            <RunView store={store} />
          ) : (
            <MapsView store={store} lastRunRef={lastRunHeading} />
          )}
        </div>
        <div className="gm-app__side"><CharacterPanel store={store} /></div>
      </main>
      <Toast store={store} />
      <RunResultDialog store={store} fallbackFocus={lastRunHeading} />
      {settingsOpen && <SettingsDialog store={store} runAsOwner={runAsOwner} onClose={() => setSettingsOpen(false)} />}
      {offlineSummary && <OfflineSummary summary={offlineSummary} onClose={() => store.dismissSummary()} />}
    </div>
  );
}
