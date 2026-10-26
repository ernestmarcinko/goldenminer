import { useMemo, useState } from 'react';
import { ASCEND_LEVEL } from '../../core/balance';
import type { GameStore } from '../../store/gameStore';
import { Web } from '../skills/Web';
import { NodeIcon } from '../skills/SkillIcon';
import { useGame } from '../useGame';
import { ascendancyCostLine, ascendancyPointsLine, ascendancyVMs, ascendLine, pointsPreview } from './ascensionView';
import '../skills/skills.css';
import './ascend.css';

const ALLOCATE_TEXT: Readonly<Record<string, string>> = {
  noPoints: 'No ascendancy points.',
  notAdjacent: 'Allocate next to an allocated node first.',
  allocated: 'Already allocated.',
  invalid: "That node doesn't exist.",
};

/** The ascendancy tree: hover a node for its card, click an allocatable one to spend a point, and ascend at level 60. */
export function AscensionView({ store }: { store: GameStore }) {
  const { state, version } = useGame(store);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const vms = useMemo(() => ascendancyVMs(state), [state, version]);
  const byId = useMemo(() => new Map(vms.map((n) => [n.id, n])), [vms]);
  const cardId = hoveredId ?? pinnedId;

  const pick = (id: string): void => {
    const vm = byId.get(id);
    if (vm === undefined) return;
    setMessage(null);
    setArmed(false);
    if (vm.allocatable) {
      setPinnedId(id);
      const r = store.allocateAscendancy(id);
      setMessage(r === 'ok' ? `Allocated ${vm.name}.` : ALLOCATE_TEXT[r] ?? 'Refused.');
      return;
    }
    // A node that cannot be allocated closes any pinned card and says why.
    setPinnedId(null);
    if (vm.allocated) setMessage(`${vm.name} is already allocated.`);
    else if (state.ascendancy.points === 0) setMessage(`No ascendancy points — ascend at level ${ASCEND_LEVEL} to earn them.`);
    else setMessage('Allocate next to an allocated node first.');
  };

  const ascendNow = (): void => {
    if (!armed) {
      setArmed(true);
      return;
    }
    const r = store.ascend();
    setArmed(false);
    setPinnedId(null);
    setMessage(r === 'ok' ? 'Ascended.' : 'Not ready.');
  };

  return (
    <div className="gm-ascend">
      <div className="gm-ascend__head">
        <h2 className="gm-ascend__title">Ascension</h2>
        <span className="gm-ascend__points">{ascendancyPointsLine(state)}</span>
      </div>
      {state.ascendancy.points === 0 && (
        <p className="gm-ascend__hint">No ascendancy points yet — ascend at level {ASCEND_LEVEL} to earn them.</p>
      )}
      <div className="gm-ascend__bar">
        <span className="gm-ascend__preview">{pointsPreview(state)}</span>
        {state.lifetime.ascensions >= 1 && state.level >= ASCEND_LEVEL && (
          <span className="gm-muted">Level higher for more points.</span>
        )}
        {state.level >= ASCEND_LEVEL ? (
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
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--small" />small · 1 point</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--notable" />mid · 2 points</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--keystone" />big · 4 points</span>
        <span className="gm-legend gm-muted">click to pin · drag to pan · wheel or +/− to zoom</span>
      </div>
      <Web
        nodes={vms}
        onNode={pick}
        onHover={(id) => setHoveredId(id)}
        onCloseCard={() => setPinnedId(null)}
        focusId={null}
        focusNonce={0}
        label="Ascendancy tree"
        cardId={cardId}
        renderCard={(node) => (
          <section className="gm-ascend__card" data-side={node.side}>
            <div className="gm-node-head">
              <NodeIcon icon={node.icon} size={48} />
              <div className="gm-ascend__card-title">
                <h3 className="gm-ascend__card-name">{node.name}</h3>
                {node.cost > 0 && <div className="gm-ascend__card-cost">{ascendancyCostLine(node.cost)}</div>}
              </div>
            </div>
            <div className="gm-ascend__card-line">{node.line}</div>
            {node.desc !== '' && node.desc !== node.line && (
              <div className="gm-ascend__card-desc gm-muted">{node.desc}</div>
            )}
            <div className="gm-web__card-actions">
              {node.allocatable && (
                <button type="button" className="gm-btn gm-btn--primary" onClick={() => pick(node.id)}>
                  Allocate · {ascendancyCostLine(node.cost)}
                </button>
              )}
            </div>
            {node.allocated && (
              <div className="gm-ascend__card-desc gm-muted">Allocated{node.kind === 'start' ? ' · the start' : ''}.</div>
            )}
          </section>
        )}
      />
      <div className="gm-ascend__footer">
        <div className="gm-ascend__status" role="status">{message}</div>
      </div>
    </div>
  );
}
