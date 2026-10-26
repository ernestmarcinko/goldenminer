import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { GameState } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { gainsLine, runMapLine, runTitle } from '../run/runView';
import { useGame } from '../useGame';
import { deathRows, dropRows } from './logView';
import '../run/run.css';
import './log.css';

const LOG_TABS = ['drops', 'deaths'] as const;
type LogTab = (typeof LOG_TABS)[number];
const TAB_LABELS: Record<LogTab, string> = { drops: 'Drops', deaths: 'Deaths' };
const tabId = (t: LogTab): string => `gm-log-tab-${t}`;
export const deathId = (id: number): string => `gm-death-${id}`;

/** A death to open the Deaths tab on, from the run result's link. */
export interface LogShow { tab: 'deaths'; id: number }

/**
 * The Last run card, then the Drops and Deaths tabs. `lastRunRef` is the Last run card's heading, which takes focus on
 * request; `show` opens the Deaths tab on one entry, scrolled into view and focused.
 */
export function LogView({ store, lastRunRef, show }: {
  store: GameStore; lastRunRef?: RefObject<HTMLHeadingElement | null>; show?: LogShow;
}) {
  const { state } = useGame(store);
  const last = state.lastRun;
  const [tab, setTab] = useState<LogTab>(show?.tab ?? 'drops');
  const tabRefs = useRef<Partial<Record<LogTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (show === undefined) return;
    setTab(show.tab);
    // after the tab's rows render
    const timer = setTimeout(() => {
      const el = document.getElementById(deathId(show.id));
      el?.scrollIntoView({ block: 'center' });
      el?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [show]);

  const onTabKey = (e: KeyboardEvent): void => {
    const lastIndex = LOG_TABS.length - 1;
    const at = LOG_TABS.indexOf(tab);
    const index = e.key === 'ArrowRight' ? (at + 1) % LOG_TABS.length
      : e.key === 'ArrowLeft' ? (at + lastIndex) % LOG_TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? lastIndex
      : -1;
    if (index < 0) return;
    e.preventDefault();
    const next = LOG_TABS[index];
    if (next === undefined) return;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="gm-logview">
      <h2 className="gm-logview__title">Log</h2>
      {last !== null && (
        <section className="gm-lastrun" aria-label="Last run">
          <h3 ref={lastRunRef} tabIndex={-1} className="gm-lastrun__label">Last run</h3>
          <div className="gm-lastrun__title" data-outcome={last.outcome}>{runTitle(last)}</div>
          <div className="gm-muted">{runMapLine(state.seed, last.map)}</div>
          <div className="gm-lastrun__gains">{gainsLine(last.gained, last.items)}</div>
        </section>
      )}
      <div role="tablist" aria-label="Log tabs" className="gm-log__tabs" onKeyDown={onTabKey}>
        {LOG_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={tabId(t)}
            ref={(el) => { tabRefs.current[t] = el; }}
            className="gm-log__tab"
            aria-selected={tab === t}
            aria-controls="gm-log-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="gm-log-panel" aria-labelledby={tabId(tab)} className="gm-log__panel">
        {tab === 'drops' ? <DropList state={state} /> : <DeathList state={state} />}
      </div>
    </div>
  );
}

/** Each find: where it came from, then its name and kind over its trail; a stack's one step follows its name. */
function DropList({ state }: { state: GameState }) {
  const rows = dropRows(state);
  if (rows.length === 0) return <p className="gm-muted gm-log__empty">Nothing logged yet.</p>;
  return (
    <ul className="gm-log__list">
      {rows.map((r) => (
        <li key={r.id} className="gm-log__row">
          <span className="gm-log__origin">{r.origin}</span>
          {r.stack ? (
            <span className="gm-log__what">
              <span className="gm-log__name" data-tone={r.tone}>{r.name}</span> <span className="gm-log__trail">{r.trail}</span>
            </span>
          ) : (
            <span className="gm-log__what">
              <span className="gm-log__name" data-tone={r.tone}>{r.name}</span>
              {r.kind !== '' && <> <span className="gm-log__kind">{r.kind}</span></>}
              <span className="gm-log__trail gm-log__trail--below">{r.trail}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function DeathList({ state }: { state: GameState }) {
  const rows = deathRows(state);
  if (rows.length === 0) return <p className="gm-muted gm-log__empty">Nothing logged yet.</p>;
  return (
    <ul className="gm-log__list">
      {rows.map((r) => (
        <li key={r.id} id={deathId(r.id)} tabIndex={-1} className="gm-log__death">
          <span className="gm-log__origin">{r.when}</span>
          <span className="gm-log__what">
            <span className="gm-log__name" data-outcome="died">{r.line}</span>
            <span className="gm-log__map">{r.map}</span>
            {r.mods.length > 0 && (
              <ul className="gm-run__mods gm-log__mods">
                {r.mods.map((l, i) => (
                  <li key={i}>
                    <span>{l.text}</span>
                    {l.tier !== undefined && <span className="gm-run__modtier">T{formatNumber(l.tier)}</span>}
                  </li>
                ))}
              </ul>
            )}
            <span className="gm-log__trail">{r.lost}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
