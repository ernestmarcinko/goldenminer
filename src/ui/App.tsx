import { useEffect, useState } from 'react';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';
import { startGame } from './gameLoop';
import { Header } from './Header';
import { MineView } from './mine/MineView';
import { Notices } from './Notices';
import { OfflineSummary } from './OfflineSummary';
import { SaveMenu } from './SaveMenu';
import { TabBlocked } from './TabBlocked';
import { useGame } from './useGame';

export function App({ store, lock }: { store: GameStore; lock: TabLock }) {
  const [blocked, setBlocked] = useState(() => !lock.tryAcquire());
  useEffect(() => {
    if (blocked) return undefined;
    return startGame(store, lock, () => setBlocked(true));
  }, [blocked, store, lock]);

  if (blocked) {
    return (
      <TabBlocked
        onPlayHere={() => {
          lock.takeOver();
          setBlocked(false);
        }}
      />
    );
  }
  return <Game store={store} />;
}

function Game({ store }: { store: GameStore }) {
  const [saveOpen, setSaveOpen] = useState(false);
  const { offlineSummary } = useGame(store);
  return (
    <div className="gm-app">
      <Header store={store} onOpenSave={() => setSaveOpen(true)} />
      <Notices store={store} />
      <main className="gm-app__main">
        <MineView store={store} />
      </main>
      {offlineSummary && <OfflineSummary summary={offlineSummary} onClose={() => store.dismissSummary()} />}
      {saveOpen && <SaveMenu store={store} onClose={() => setSaveOpen(false)} />}
    </div>
  );
}
