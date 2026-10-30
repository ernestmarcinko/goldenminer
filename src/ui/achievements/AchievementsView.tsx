import { ACHIEVEMENTS, earnedCount } from '../../core/achievements';
import { ICON_GLYPHS, ICON_PALETTE, type IconGlyphId } from '../../core/skillIcons';
import type { GameStore } from '../../store/gameStore';
import { formatNumber, formatRate } from '../format';
import { iconDataUrl } from '../PixelArt';
import { useGame } from '../useGame';
import { achievementBoostPercent, achievementVMs } from './achievementsView';
import './achievements.css';

/** A family's pixel glyph, drawn at `size` px with crisp nearest-neighbour scaling. */
function FamilyGlyph({ id, size }: { id: IconGlyphId; size: number }) {
  const glyph = ICON_GLYPHS[id];
  return (
    <img
      className="gm-ach__family-icon"
      src={iconDataUrl(glyph.grid, ICON_PALETTE)}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      alt=""
      draggable={false}
    />
  );
}

/** The four progress tones, hardest-first: rarer thresholds read as more precious, so a group reads as a ramp. */
const TONES = ['bronze', 'silver', 'gold', 'diamond'] as const;
type Tone = (typeof TONES)[number];

/** Which tone an achievement badge wears, from its place in the family's threshold order. */
function badgeTone(index: number, total: number): Tone {
  if (total <= 1) return 'gold';
  const band = Math.floor((index / (total - 1)) * TONES.length);
  return TONES[Math.min(band, TONES.length - 1)] ?? 'gold';
}

/** One achievement badge: the family's icon in a progress tone, filled when earned, dim when not. */
function AchievementBadge({ id, name, desc, earned, hidden, tone, size }: {
  id: IconGlyphId | null; name: string; desc: string; earned: boolean; hidden: boolean; tone: Tone; size: number;
}) {
  const glyph = id === null ? null : ICON_GLYPHS[id];
  return (
    <span
      className="gm-ach__badge"
      data-earned={earned}
      data-hidden={hidden}
      data-tone={tone}
      data-tip={`${name} — ${desc}`}
      title={`${name} — ${desc}`}
    >
      {glyph === null ? (
        <span className="gm-ach__badge-mark" aria-hidden="true">?</span>
      ) : (
        <img
          className="gm-ach__badge-icon"
          src={iconDataUrl(glyph.grid, ICON_PALETTE)}
          width={size}
          height={size}
          style={{ imageRendering: 'pixelated' }}
          alt=""
          draggable={false}
        />
      )}
    </span>
  );
}

/** The achievements tab: Milestones, Feats, Collections and Secrets, each a set of family groups of each badge its own tone, hovered badges showing the text. */
export function AchievementsView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const groups = achievementVMs(state);
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
      {groups.map((group) => (
        <section key={group.kind} className="gm-ach__group" aria-label={group.label}>
          <h3 className="gm-ach__group-label">
            <span>{group.label}</span>
            <span className="gm-muted">{formatNumber(group.earned)} / {formatNumber(group.total)}</span>
          </h3>
          {group.families.map((family) => (
            <section key={family.family} className="gm-ach__family" aria-label={group.kind === 'hidden' ? group.label : family.label}>
              {group.kind === 'hidden' ? null : (
                <h4 className="gm-ach__family-label">
                  <FamilyGlyph id={family.icon} size={24} />
                  <span>{family.label}</span>
                  <span className="gm-muted">{formatNumber(family.earned)}/{formatNumber(family.total)}</span>
                </h4>
              )}
              <div className="gm-ach__grid">
                {family.achievements.map((a, index) => (
                  <AchievementBadge
                    key={a.id}
                    id={a.icon}
                    name={a.name}
                    desc={a.desc}
                    earned={a.earned}
                    hidden={a.hidden}
                    tone={badgeTone(index, family.achievements.length)}
                    size={22}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}
