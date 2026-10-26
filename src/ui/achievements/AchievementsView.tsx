import { ACHIEVEMENTS, earnedCount } from '../../core/achievements';
import type { GameStore } from '../../store/gameStore';
import { formatNumber, formatRate } from '../format';
import { useGame } from '../useGame';
import { achievementBoostPercent, achievementVMs } from './achievementsView';
import './achievements.css';

/** The achievements tab: every family with its achievements, plus the running total and the global boost. */
export function AchievementsView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const families = achievementVMs(state);
  const earned = earnedCount(state);
  const boost = achievementBoostPercent(state);
  return (
    <div className="gm-ach">
      <div className="gm-ach__head">
        <h2 className="gm-ach__title">Achievements</h2>
        <span className="gm-ach__summary">
          {formatNumber(earned)} / {formatNumber(ACHIEVEMENTS.length)} · +{formatRate(boost)}% global boost
        </span>
      </div>
      {families.map((family) => (
        <section key={family.family} className="gm-ach__family" aria-label={family.label}>
          <h3 className="gm-ach__family-label">
            {family.label}{' '}
            <span className="gm-muted">{formatNumber(family.earned)}/{formatNumber(family.total)}</span>
          </h3>
          <ul className="gm-ach__list">
            {family.achievements.map((a) => (
              <li key={a.id} className="gm-ach__row" data-earned={a.earned}>
                <span className="gm-ach__name">{a.name}</span>
                <span className="gm-ach__desc gm-muted">{a.desc}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
