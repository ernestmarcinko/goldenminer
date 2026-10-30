import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import './testTool.css';

/**
 * The dev-only Test tool: a side panel of instant cheat buttons. It is rendered only when `import.meta.env.DEV`, so it
 * never ships in the production build.
 */
export function TestTool({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const { state } = useGame(store);
  const cheat = store.testCheat.bind(store);
  return (
    <aside className="gm-testtool" aria-label="Test tool">
      <div className="gm-testtool__head">
        <h2 className="gm-testtool__title">Test tool</h2>
        <button type="button" className="gm-btn" onClick={onClose}>Close</button>
      </div>
      <div className="gm-testtool__state gm-small gm-muted">
        Level {formatNumber(state.level)} · {formatNumber(state.deepest)} m · {formatNumber(state.gold)} Gold ·{' '}
        {formatNumber(state.diamonds)} Diamonds · {formatNumber(state.souls)} Souls
      </div>

      <section className="gm-testtool__group">
        <h3 className="gm-testtool__group-title">Levels</h3>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'level', delta: 1 })}>+1 level</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'level', delta: 10 })}>+10 levels</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'level', delta: 100 })}>Max level</button>
      </section>

      <section className="gm-testtool__group">
        <h3 className="gm-testtool__group-title">Dig</h3>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'depth', delta: 100 })}>+100 m</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'depth', delta: 1000 })}>+1,000 m</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'depth', delta: 10000 })}>+10,000 m</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'depth', delta: 100000 })}>+100,000 m</button>
      </section>

      <section className="gm-testtool__group">
        <h3 className="gm-testtool__group-title">Resources</h3>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'gold', amount: 10000 })}>+10,000 Gold</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'gold', amount: 1000000 })}>+1M Gold</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'gold', amount: 1000000000 })}>+1B Gold</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'diamonds', amount: 100 })}>+100 Diamonds</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'diamonds', amount: 10000 })}>+10,000 Diamonds</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'souls', amount: 10000 })}>+10,000 Souls</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'materials', amount: 100 })}>+100 each ore</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'materials', amount: 10000 })}>+10,000 each ore</button>
      </section>

      <section className="gm-testtool__group">
        <h3 className="gm-testtool__group-title">Progression</h3>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'ascendancy', amount: 1 })}>+1 ascendancy point</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'ascendancy', amount: 10 })}>+10 ascendancy points</button>
        <button type="button" className="gm-btn" onClick={() => cheat({ kind: 'maps' })}>Add maps (tiers 1–5)</button>
      </section>
    </aside>
  );
}
