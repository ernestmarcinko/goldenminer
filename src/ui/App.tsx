import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameStore } from '../store/gameStore';
import type { TabLock } from '../store/tabLock';
import { AchievementsView } from './achievements/AchievementsView';
import { AchievementToastStack } from './achievements/AchievementToast';
import { AscensionView } from './ascend/AscensionView';
import { BattleView } from './battle/BattleView';
import { startGame, type GameLoop } from './gameLoop';
import { Header } from './Header';
import { InventoryView } from './inventory/InventoryView';
import { LogView, type LogShow } from './log/LogView';
import { MerchantView } from './merchant/MerchantView';
import { MineView } from './mine/MineView';
import { Nav, type View } from './Nav';
import { Notices } from './Notices';
import { OfflineSummary } from './OfflineSummary';
import { RunResultDialog } from './run/RunResultDialog';
import { RunView } from './run/RunView';
import { SettingsDialog } from './settings/SettingsDialog';
import { SkillsView } from './skills/SkillsView';
import { StartScreen } from './start/StartScreen';
import { StatsView } from './stats/StatsView';
import { TabBlocked } from './TabBlocked';
import { TestTool } from './testTool/TestTool';
import { Toast } from './Toast';
import { useGame } from './useGame';

interface Boot { blocked: boolean; needsStart: boolean }

export function App({ store, lock }: { store: GameStore; lock: TabLock }) {
  // Loading happens in the initializer, not an effect, so the first paint already shows the loaded game.
  // StrictMode runs it twice in dev, which is harmless. A first launch has no save: the StartScreen is shown
  // instead of loading or starting the loop until a world is named and seeded.
  const [boot, setBoot] = useState<Boot>(() => {
    if (!lock.tryAcquire()) return { blocked: true, needsStart: false };
    if (!store.hasSave()) return { blocked: false, needsStart: true };
    store.load();
    return { blocked: false, needsStart: false };
  });
  const loop = useRef<GameLoop | null>(null);
  useLayoutEffect(() => {
    if (boot.blocked || boot.needsStart) return undefined;
    const running = startGame(store, lock, () => setBoot((b) => ({ ...b, blocked: true })));
    loop.current = running;
    return () => {
      running.stop();
      loop.current = null;
    };
  }, [boot.blocked, boot.needsStart, store, lock]);

  if (boot.blocked) {
    return (
      <TabBlocked
        onPlayHere={() => {
          lock.takeOver();
          if (store.hasSave()) {
            store.load();
            setBoot({ blocked: false, needsStart: false });
          } else {
            setBoot({ blocked: false, needsStart: true });
          }
        }}
      />
    );
  }
  if (boot.needsStart) {
    return <StartScreen store={store} mode="first" onStart={() => setBoot((b) => ({ ...b, needsStart: false }))} />;
  }
  return <Game store={store} runAsOwner={(action) => loop.current?.runAsOwner(action) ?? false} />;
}

function Game({ store, runAsOwner }: { store: GameStore; runAsOwner: (action: () => void) => boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const mineTab = useRef<HTMLButtonElement>(null);
  const runTab = useRef<HTMLButtonElement>(null);
  const { offlineSummary, state } = useGame(store);
  const running = state.activity.kind === 'map';
  const [view, setView] = useState<View>(running ? 'run' : 'mine');
  // the death the run result's link opens the Log on; any other change of view forgets it
  const [logShow, setLogShow] = useState<LogShow | undefined>(undefined);
  const openView = (next: View): void => {
    setLogShow(undefined);
    setView(next);
  };
  // starting a run, from a map's card, brings the player to the fight; its ending leaves the fight for the Mine. The
  // card's Run button goes with the view it was in, so focus moves to the Run tab rather than drop to the page.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running && !wasRunning.current) {
      setView('run');
      setTimeout(() => runTab.current?.focus(), 0);
    }
    if (!running && wasRunning.current) setView((v) => (v === 'run' ? 'mine' : v));
    wasRunning.current = running;
  }, [running]);
  // the Run view without a run (for the one render before the effect above) shows the Mine
  const shown: View = view === 'run' && !running ? 'mine' : view;
  // digging runs only while the Mine view is on screen
  useEffect(() => store.setViewPaused(shown !== 'mine'), [shown, store]);
  return (
    <div className="gm-app">
      <Header store={store} onOpenSettings={() => setSettingsOpen(true)} onOpenTest={() => setTestOpen((v) => !v)} />
      <Nav store={store} view={shown} onView={openView} mineRef={mineTab} runRef={runTab} />
      <Notices store={store} />
      <AchievementToastStack store={store} />
      <main className="gm-app__main">
        {shown === 'mine' ? (
          <MineView store={store} onBackToMap={() => openView('run')} />
        ) : shown === 'battle' ? (
          <BattleView store={store} />
        ) : shown === 'inventory' ? (
          <InventoryView store={store} />
        ) : shown === 'skills' ? (
          <SkillsView store={store} />
        ) : shown === 'ascend' ? (
          <AscensionView store={store} />
        ) : shown === 'merchant' ? (
          <MerchantView store={store} />
        ) : shown === 'log' ? (
          <LogView store={store} show={logShow} />
        ) : shown === 'achievements' ? (
          <AchievementsView store={store} />
        ) : shown === 'stats' ? (
          <StatsView store={store} />
        ) : (
          <RunView store={store} />
        )}
      </main>
      <Toast store={store} />
      <RunResultDialog
        store={store}
        fallbackFocus={mineTab}
        onDismiss={() => openView('mine')}
        onShowDeath={(id) => {
          setLogShow({ tab: 'deaths', id });
          setView('log');
        }}
      />
      {settingsOpen && <SettingsDialog store={store} runAsOwner={runAsOwner} onClose={() => setSettingsOpen(false)} />}
      {import.meta.env.DEV && testOpen && <TestTool store={store} onClose={() => setTestOpen(false)} />}
      {offlineSummary && <OfflineSummary summary={offlineSummary} onClose={() => store.dismissSummary()} />}
    </div>
  );
}
