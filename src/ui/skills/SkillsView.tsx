import { useMemo, useState } from 'react';
import { pointsToSpend } from '../../core/passives';
import type { GameStore } from '../../store/gameStore';
import { useGame } from '../useGame';
import { nodeVMs, pointsLine, refundLine, resetLine, searchNodes, type SkillNodeVM } from './skillsView';
import { Web } from './Web';
import './skills.css';

const ALLOCATE_TEXT: Readonly<Record<string, string>> = {
  noPoints: 'No points to spend.',
  notAdjacent: 'Allocate next to an allocated node first.',
  allocated: 'Already allocated.',
  invalid: "That node doesn't exist.",
};

const REFUND_TEXT: Readonly<Record<string, string>> = {
  notAllocated: 'Not allocated.',
  notLeaf: "Can't refund yet: another node depends on it.",
  noGold: 'Not enough Gold.',
  occupied: 'Empty the free stash pages first.',
  invalid: "That node doesn't exist.",
};

/** The passive web: hover a node for its card, click one to allocate or refund, and reset the web for Diamonds. */
export function SkillsView({ store }: { store: GameStore }) {
  const { state, version } = useGame(store);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // The store mutates its state in place, so the version is what makes the view model recompute.
  const vms = useMemo(() => nodeVMs(state), [state, version]);
  const byId = useMemo(() => new Map(vms.map((n) => [n.id, n])), [vms]);
  const points = pointsToSpend(state);
  const cardId = hoveredId ?? pinnedId;

  const pick = (id: string): void => {
    const vm = byId.get(id);
    if (vm === undefined) return;
    setPinnedId(id);
    setMessage(null);
    if (vm.allocatable) {
      const r = store.allocate(id);
      setMessage(r === 'ok' ? `Allocated ${vm.name}.` : ALLOCATE_TEXT[r] ?? 'Refused.');
    } else if (vm.refundable) {
      const r = store.refund(id);
      setMessage(r === 'ok' ? `Refunded ${vm.name}.` : REFUND_TEXT[r] ?? 'Refused.');
    } else if (vm.allocated) {
      setMessage(`${vm.name} is already allocated.`);
    } else if (points === 0) {
      setMessage('No points to spend — level up by running maps.');
    } else {
      setMessage('Allocate next to an allocated node first.');
    }
  };

  const reset = (): void => {
    const r = store.resetWeb();
    setPinnedId(null);
    setMessage(r === 'ok' ? 'Web reset.' : r === 'noDiamonds' ? 'Not enough Diamonds.' : 'Empty the free stash pages first.');
  };

  const search = (q: string): void => {
    setQuery(q);
    const found = searchNodes(state, q);
    if (found.length > 0) setFocus({ id: found[0]!, n: (focus?.n ?? 0) + 1 });
  };

  const card = (node: SkillNodeVM) => (
    <section className="gm-skills__card" data-side={node.side}>
      <h3 className="gm-skills__card-name">{node.name}</h3>
      <div className="gm-skills__card-line">{node.line}</div>
      {node.desc !== '' && node.desc !== node.line && (
        <div className="gm-skills__card-desc gm-muted">{node.desc}</div>
      )}
      {node.allocatable && (
        <button type="button" className="gm-btn gm-btn--primary" onClick={() => pick(node.id)}>Allocate · 1 point</button>
      )}
      {node.refundable && (
        <button type="button" className="gm-btn" onClick={() => pick(node.id)}>{refundLine(state, node.id)}</button>
      )}
      {node.allocated && !node.refundable && (
        <div className="gm-skills__card-desc gm-muted">Allocated{node.kind === 'start' ? ' · the start' : ''}.</div>
      )}
    </section>
  );

  return (
    <div className="gm-skills">
      <div className="gm-skills__head">
        <h2 className="gm-skills__title">Skills</h2>
        <span className="gm-skills__points">{pointsLine(state)}</span>
      </div>
      {points === 0 && (
        <p className="gm-skills__hint">No points yet — every level gives one, and levels come from running maps.</p>
      )}
      <div className="gm-skills__bar">
        <input
          type="search"
          className="gm-skills__search"
          placeholder="Search nodes"
          value={query}
          onChange={(e) => search(e.target.value)}
          aria-label="Search nodes"
        />
        <button type="button" className="gm-btn gm-btn--danger" onClick={reset}>
          {resetLine()}
        </button>
      </div>
      <div className="gm-skills__legend" aria-hidden="true">
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--small" />small: +stat</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--notable" />notable: named bonus</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--keystone" />keystone: changes a rule</span>
        <span className="gm-legend gm-muted">click to pin · drag to pan · wheel or +/− to zoom</span>
      </div>
      <Web
        nodes={vms}
        onNode={pick}
        onHover={(id) => setHoveredId(id)}
        focusId={focus?.id ?? null}
        focusNonce={focus?.n ?? 0}
        cardId={cardId}
        renderCard={card}
      />
      <div className="gm-skills__footer">
        <div className="gm-skills__status" role="status">{message}</div>
      </div>
    </div>
  );
}
