import { useMemo, useState } from 'react';
import { LEVEL_CAP } from '../../core/balance';
import type { GameStore } from '../../store/gameStore';
import type { SkillNodeVM } from '../skills/skillsView';
import { Web } from '../skills/Web';
import { useGame } from '../useGame';
import { ascendancyPointsLine, ascendancyVMs, ascendLine, pointsPreview } from './ascensionView';
import '../skills/skills.css';
import './ascend.css';

const ALLOCATE_TEXT: Readonly<Record<string, string>> = {
  noPoints: 'No ascendancy points.',
  notAdjacent: 'Allocate next to an allocated node first.',
  allocated: 'Already allocated.',
  invalid: "That node doesn't exist.",
};

/** The ascendancy tree: hover a node for its card, click an allocatable one to spend a point, and ascend at the cap. */
export function AscensionView({ store }: { store: GameStore }) {
  const { state, version } = useGame(store);
  const [selected, setSelected] = useState<SkillNodeVM | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const vms = useMemo(() => ascendancyVMs(state), [state, version]);
  const byId = useMemo(() => new Map(vms.map((n) => [n.id, n])), [vms]);

  const pick = (id: string): void => {
    const vm = byId.get(id);
    if (vm === undefined) return;
    setSelected(vm);
    setMessage(null);
    setArmed(false);
    if (!vm.allocatable) return;
    const r = store.allocateAscendancy(id);
    setMessage(r === 'ok' ? `Allocated ${vm.name}.` : ALLOCATE_TEXT[r] ?? 'Refused.');
  };

  const ascendNow = (): void => {
    if (!armed) {
      setArmed(true);
      return;
    }
    const r = store.ascend();
    setArmed(false);
    setSelected(null);
    setMessage(r === 'ok' ? 'Ascended.' : 'Not ready.');
  };

  return (
    <div className="gm-ascend">
      <div className="gm-ascend__head">
        <h2 className="gm-ascend__title">Ascension</h2>
        <span className="gm-ascend__points">{ascendancyPointsLine(state)}</span>
      </div>
      <div className="gm-ascend__bar">
        <span className="gm-ascend__preview">{pointsPreview(state)}</span>
        {state.level >= LEVEL_CAP ? (
          <button
            type="button"
            className={armed ? 'gm-btn gm-btn--danger' : 'gm-btn gm-btn--primary'}
            onClick={ascendNow}
          >
            {armed ? 'Confirm ascend?' : ascendLine(state)}
          </button>
        ) : (
          <span className="gm-ascend__locked gm-muted">{ascendLine(state)}</span>
        )}
      </div>
      <div className="gm-ascend__legend" aria-hidden="true">
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--small" />small: +stat</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--notable" />notable: named bonus</span>
        <span className="gm-legend gm-muted">drag to pan · wheel to zoom</span>
      </div>
      <Web
        nodes={vms}
        onNode={pick}
        onHover={(id) => setSelected(id === null ? null : (byId.get(id) ?? null))}
        focusId={null}
        focusNonce={0}
      />
      <div className="gm-ascend__footer">
        {selected !== null && (
          <section className="gm-ascend__card" data-side={selected.side}>
            <h3 className="gm-ascend__card-name">{selected.name}</h3>
            <div className="gm-ascend__card-line">{selected.line}</div>
            {selected.desc !== '' && selected.desc !== selected.line && (
              <div className="gm-ascend__card-desc gm-muted">{selected.desc}</div>
            )}
            {selected.allocatable && (
              <button type="button" className="gm-btn gm-btn--primary" onClick={() => pick(selected.id)}>
                Allocate · 1 point
              </button>
            )}
          </section>
        )}
        <div className="gm-ascend__status" role="status">{message}</div>
      </div>
    </div>
  );
}
