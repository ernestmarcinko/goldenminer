import type { CombatLine } from '../../core/types';
import { combatLineText } from './runView';
import './run.css';

const SHOWN = 7;

/** The newest lines of the fight, newest first. */
export function CombatLog({ log }: { log: readonly CombatLine[] }) {
  const lines = log.slice(-SHOWN).reverse();
  return (
    <section className="gm-runbox" aria-label="Combat log">
      <h3 className="gm-runbox__title">Combat log</h3>
      {lines.length === 0 ? (
        <p className="gm-muted gm-runbox__empty">The fight is about to begin.</p>
      ) : (
        <ul className="gm-log">
          {lines.map((line, i) => {
            const { text, tone } = combatLineText(line);
            return (
              <li key={i} className="gm-log__line" data-tone={tone} data-rarity={line.kind === 'drop' ? line.note.rarity : undefined}>
                {text}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
