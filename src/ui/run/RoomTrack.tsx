import type { MapRun } from '../../core/types';
import { roomTrack } from './runView';
import './run.css';

export function RoomTrack({ run, bossName }: { run: MapRun; bossName: string }) {
  return (
    <ol className="gm-rooms" aria-label="Rooms">
      {roomTrack(run, bossName).map((r) => (
        <li key={r.label} className="gm-rooms__row" data-state={r.state} aria-current={r.state === 'now' ? 'step' : undefined}>
          <span className="gm-rooms__label">{r.label}</span>
          <span className="gm-rooms__note">{r.note}</span>
        </li>
      ))}
    </ol>
  );
}
