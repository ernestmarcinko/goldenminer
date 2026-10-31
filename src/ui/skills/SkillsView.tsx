import { useMemo, useState } from 'react';
import { pointsToSpend } from '../../core/passives';
import { refundPrice } from '../../core/respec';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import {
  nodeVMs, pointsLine, pruneStaged, refundAffordable, refundTotalLine, resetLine, searchNodes,
  type SkillMode, type SkillNodeVM,
} from './skillsView';
import { NodeIcon } from './SkillIcon';
import { Web } from './Web';
import './skills.css';

const ALLOCATE_TEXT: Readonly<Record<string, string>> = {
  noPoints: 'Not enough points for that allocation.',
  notAdjacent: 'Every staged node must adjoin the start, an allocated node or an earlier staged node.',
  allocated: 'One of those nodes is already allocated.',
  invalid: "That node doesn't exist.",
};

const REFUND_TEXT: Readonly<Record<string, string>> = {
  notAllocated: 'One of those nodes is not allocated.',
  notLeaf: "Can't refund that set: other nodes depend on it.",
  noGold: 'Not enough Gold.',
  occupied: 'Empty the free stash pages first.',
  invalid: "That node doesn't exist.",
};

/** The passive web: stage allocations or refunds, confirm them together, and reset the web for Diamonds. */
export function SkillsView({ store }: { store: GameStore }) {
  const { state, version } = useGame(store);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [mode, setMode] = useState<SkillMode>('allocate');
  const [staged, setStaged] = useState<string[]>([]);
  const [refund, setRefund] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // The store mutates its state in place, so the version is what makes the view model recompute.
  const vms = useMemo(
    () => nodeVMs(state, { mode, staged, refund }),
    [state, version, mode, staged, refund],
  );
  const byId = useMemo(() => new Map(vms.map((n) => [n.id, n])), [vms]);
  const points = pointsToSpend(state);
  const cardId = hoveredId ?? pinnedId;

  const pick = (id: string): void => {
    const vm = byId.get(id);
    if (vm === undefined) return;
    setMessage(null);
    if (mode === 'allocate') {
      if (staged.includes(id)) {
        setStaged(pruneStaged(state.passives.allocated, staged.filter((n) => n !== id)));
        setPinnedId(id);
        setMessage(`Unstaged ${vm.name}.`);
        return;
      }
      if (vm.allocatable) {
        setStaged([...staged, id]);
        setPinnedId(id);
        setMessage(`Staged ${vm.name}. Confirm to spend the point.`);
        return;
      }
      // A node that cannot be staged closes any pinned card and says why. Nothing stays open forever.
      setPinnedId(null);
      if (vm.allocated) setMessage(`${vm.name} is already allocated.`);
      else if (points - staged.length <= 0) setMessage('No points left to stage — confirm or cancel first.');
      else setMessage('Stage a node next to an allocated or staged node first.');
      return;
    }
    if (refund.includes(id)) {
      setRefund(refund.filter((n) => n !== id));
      setPinnedId(id);
      setMessage(`Unmarked ${vm.name}.`);
      return;
    }
    if (vm.refundable) {
      setRefund([...refund, id]);
      setPinnedId(id);
      setMessage(`Marked ${vm.name} for refund.`);
      return;
    }
    setPinnedId(null);
    if (!vm.allocated) setMessage(`${vm.name} isn't allocated.`);
    else setMessage(`Can't refund ${vm.name} yet: mark the nodes that depend on it first.`);
  };

  const confirmAllocation = (): void => {
    const count = staged.length;
    const r = store.allocateMany(staged);
    if (r === 'ok') {
      setMessage(`Allocated ${count} ${count === 1 ? 'node' : 'nodes'}.`);
      setStaged([]);
    } else {
      setMessage(ALLOCATE_TEXT[r] ?? 'Refused.');
    }
  };

  const cancelAllocation = (): void => {
    setStaged([]);
    setPinnedId(null);
    setMessage('Allocation cancelled.');
  };

  const enterRefund = (): void => {
    setMode('refund');
    setStaged([]);
    setPinnedId(null);
    setMessage('Click allocated nodes to mark them, then confirm the refund.');
  };

  const cancelRefund = (): void => {
    setMode('allocate');
    setRefund([]);
    setPinnedId(null);
    setMessage('Refund cancelled.');
  };

  const confirmRefund = (): void => {
    const count = refund.length;
    const r = store.refundMany(refund);
    if (r === 'ok') {
      setMessage(`Refunded ${count} ${count === 1 ? 'node' : 'nodes'} for ${formatNumber(refundPrice(state.level) * count)} Gold.`);
      setRefund([]);
      setMode('allocate');
    } else {
      setMessage(REFUND_TEXT[r] ?? 'Refused.');
    }
  };

  const reset = (): void => {
    const r = store.resetWeb();
    setMode('allocate');
    setStaged([]);
    setRefund([]);
    setPinnedId(null);
    setMessage(r === 'ok' ? 'Web reset.' : r === 'noDiamonds' ? 'Not enough Diamonds.' : 'Empty the free stash pages first.');
  };

  const search = (q: string): void => {
    setQuery(q);
    const found = searchNodes(state, q);
    const first = found[0];
    if (first !== undefined) setFocus({ id: first, n: (focus?.n ?? 0) + 1 });
  };

  const stateText = (node: SkillNodeVM): string => {
    if (mode === 'allocate') {
      if (node.staged) return 'Staged — not yet spent.';
      if (node.allocated) return node.kind === 'start' ? 'Allocated · the start.' : 'Allocated.';
      if (node.allocatable) return 'Click to stage this node.';
      if (points - staged.length <= 0) return 'No points left to stage.';
      return 'Needs an adjacent allocated or staged node.';
    }
    if (node.refunding) return 'Marked for refund.';
    if (node.refundable) return 'Click to mark this node for refund.';
    if (!node.allocated) return 'Not allocated.';
    return "Can't refund yet: mark the nodes that depend on it first.";
  };

  const card = (node: SkillNodeVM) => (
    <section className="gm-skills__card" data-side={node.side}>
      <div className="gm-node-head">
        <NodeIcon icon={node.icon} size={48} />
        <h3 className="gm-skills__card-name">{node.name}</h3>
      </div>
      <div className="gm-skills__card-line">{node.line}</div>
      {node.desc !== '' && node.desc !== node.line && (
        <div className="gm-skills__card-desc gm-muted">{node.desc}</div>
      )}
      <div className="gm-web__card-actions">
        {mode === 'allocate' && node.staged && (
          <button type="button" className="gm-btn" onClick={() => pick(node.id)}>Unstage</button>
        )}
        {mode === 'allocate' && node.allocatable && (
          <button type="button" className="gm-btn gm-btn--primary" onClick={() => pick(node.id)}>Stage allocation</button>
        )}
        {mode === 'refund' && node.refunding && (
          <button type="button" className="gm-btn" onClick={() => pick(node.id)}>Unmark refund</button>
        )}
        {mode === 'refund' && node.refundable && (
          <button type="button" className="gm-btn gm-btn--primary" onClick={() => pick(node.id)}>Mark for refund</button>
        )}
      </div>
      <div className="gm-skills__card-desc gm-muted">{stateText(node)}</div>
    </section>
  );

  return (
    <div className="gm-skills">
      <div className="gm-skills__head">
        <h2 className="gm-skills__title">Skills</h2>
        <span className="gm-skills__points">{pointsLine(state)}</span>
      </div>
      {mode === 'allocate' && points === 0 && (
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
        {mode === 'allocate' ? (
          <>
            <button type="button" className="gm-btn" onClick={enterRefund}>Refund nodes</button>
            <button type="button" className="gm-btn gm-btn--danger" onClick={reset}>{resetLine()}</button>
          </>
        ) : (
          <button type="button" className="gm-btn" onClick={cancelRefund}>Cancel refund</button>
        )}
      </div>
      {mode === 'allocate' && staged.length > 0 && (
        <div className="gm-skills__actions">
          <span>Stage: {staged.length} of {points} {points === 1 ? 'point' : 'points'}</span>
          <button type="button" className="gm-btn gm-btn--primary" onClick={confirmAllocation}>Confirm allocation</button>
          <button type="button" className="gm-btn" onClick={cancelAllocation}>Cancel</button>
        </div>
      )}
      {mode === 'refund' && (
        <div className="gm-skills__actions gm-skills__actions--refund">
          <span>{refundTotalLine(state, refund)}</span>
          <button
            type="button"
            className="gm-btn gm-btn--primary"
            disabled={refund.length === 0 || !refundAffordable(state, refund)}
            onClick={confirmRefund}
          >
            Confirm refund
          </button>
          <button type="button" className="gm-btn" onClick={cancelRefund}>Cancel</button>
          {refund.length > 0 && !refundAffordable(state, refund) && <span className="gm-muted">Not enough Gold.</span>}
        </div>
      )}
      <div className="gm-skills__legend" aria-hidden="true">
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--small" />small: +stat</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--notable" />notable: named bonus</span>
        <span className="gm-legend"><i className="gm-legend__dot gm-legend__dot--keystone" />keystone: changes a rule</span>
        <span className="gm-legend gm-muted">
          {mode === 'allocate' ? 'click to stage · drag to pan · wheel or +/− to zoom' : 'click allocated nodes to mark · drag to pan'}
        </span>
      </div>
      <Web
        nodes={vms}
        onNode={pick}
        onHover={(id) => setHoveredId(id)}
        onCloseCard={() => setPinnedId(null)}
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
