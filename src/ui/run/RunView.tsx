import { useMemo } from 'react';
import { dungeonLayout } from '../../core/dungeons';
import type { GameStore } from '../../store/gameStore';
import { lootNoteText } from '../character/itemView';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { CombatLog } from './CombatLog';
import { FightScene } from './FightScene';
import { RoomTrack } from './RoomTrack';
import { mapModLines, mapRewardsText, mapSpecialLine } from './runView';
import './run.css';

const LOOT_SHOWN = 5;

/** The map being run: its rooms, the fight, the combat log and what the run has gained so far. */
export function RunView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const run = state.activity.kind === 'map' ? state.activity.run : null;
  const map = run?.map;
  // the dungeon is a pure function of the seed and the map; rebuilt only for a different map
  const layout = useMemo(
    () => (map === undefined ? null : dungeonLayout(state.seed, map)),
    [state.seed, map?.id, map?.tier, map?.metre, map?.special],
  );
  if (run === null || layout === null) return null;
  const { type } = layout;
  const roomSize = layout.rooms[run.room - 1]?.length ?? 0;
  const g = run.gained;
  const loot = run.loot.slice(-LOOT_SHOWN).reverse();
  const special = mapSpecialLine(run.map);
  const mods = special === null ? mapModLines(run.map) : [...mapModLines(run.map), special];
  const rewards = mapRewardsText(run.map);
  return (
    <div className="gm-run">
      <div className="gm-run__top">
        <section className="gm-run__side" aria-label="Map">
          <div className="gm-run__head">
            <span className="gm-badge gm-run__tier">T{formatNumber(run.map.tier)}</span>
            <div>
              <h2 className="gm-run__name">{type.name}</h2>
              <div className="gm-muted gm-small">found at {formatNumber(run.map.metre)} m</div>
            </div>
          </div>
          {mods.length > 0 && (
            <ul className="gm-run__mods">
              {mods.map((l, i) => (
                <li key={i} data-tone={l.tone}>
                  <span>{l.text}</span>
                  {l.tier !== undefined && <span className="gm-run__modtier">T{formatNumber(l.tier)}</span>}
                </li>
              ))}
            </ul>
          )}
          {rewards !== '' && <div className="gm-run__rewards gm-small">{rewards}</div>}
          <RoomTrack run={run} bossName={type.bossName} />
          <button type="button" className="gm-btn" onClick={() => store.leaveMap()}>Leave map</button>
          <div className="gm-muted gm-small">Leaving or dying loses the map. XP and drops are kept.</div>
        </section>
        <section className="gm-run__fight" aria-label="Fight">
          <FightScene store={store} run={run} floor={type.floor} roomSize={roomSize} />
        </section>
      </div>
      <div className="gm-run__bottom">
        <CombatLog log={run.log} />
        <section className="gm-runbox" aria-label="This run">
          <h3 className="gm-runbox__title">This run</h3>
          <div className="gm-pills">
            <span className="gm-runpill gm-runpill--soul">+{formatNumber(g.souls)} Souls</span>
            <span className="gm-runpill gm-runpill--xp">+{formatNumber(g.xp)} XP</span>
            <span className="gm-runpill gm-runpill--gold">+{formatNumber(g.gold)} Gold</span>
            {g.levels > 0 && <span className="gm-runpill gm-runpill--xp">+{formatNumber(g.levels)} {g.levels === 1 ? 'level' : 'levels'}</span>}
          </div>
          {loot.length > 0 && (
            <ul className="gm-runloot">
              {loot.map((n, i) => (
                <li key={i}>
                  <span className="gm-runloot__note" data-rarity={n.rarity}>{n.name}</span> <span className="gm-muted">({lootNoteText(n)})</span>
                </li>
              ))}
              {run.loot.length > loot.length && <li className="gm-muted">and {formatNumber(run.loot.length - loot.length)} more</li>}
            </ul>
          )}
          <div className="gm-muted gm-small">Drops go to your bag</div>
        </section>
      </div>
    </div>
  );
}
