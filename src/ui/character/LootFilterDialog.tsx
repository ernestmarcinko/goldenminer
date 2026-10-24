import { useRef } from 'react';
import { MAX_LOOT_RULES } from '../../core/balance';
import type { BagFullMode, LootRule } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useDialog } from '../useDialog';
import { useGame } from '../useGame';
import {
  ACTION_OPTIONS, RARITY_OPTIONS, TARGET_OPTIONS, addRule, moveRule, removeRule, updateRule,
} from './lootFilterView';

const FULL_MODES: readonly { mode: BagFullMode; label: string }[] = [
  { mode: 'sellWorst', label: 'Sell the cheapest item and keep digging' },
  { mode: 'stop', label: 'Stop digging until there is room' },
];

function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <select
      aria-label={label}
      className="gm-rule__select"
      value={value}
      onChange={(e) => {
        const picked = options.find((o) => o.value === e.target.value);
        if (picked) onChange(picked.value);
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function LootFilterDialog({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const { state } = useGame(store);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusRef: closeRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const rules = state.settings.lootFilter;
  const full = rules.length >= MAX_LOOT_RULES;
  const set = (next: readonly LootRule[]): void => {
    if (next !== rules) store.setLootFilter([...next]);
  };
  return (
    <div className="gm-overlay" style={{ zIndex: 10 + depth }}>
      <div ref={dialogRef} className="gm-dialog gm-dialog--rules" role="dialog" aria-modal="true" aria-labelledby="gm-filter-title">
        <div className="gm-dialog__head">
          <h2 id="gm-filter-title" className="gm-dialog__title">Loot filter</h2>
          <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p>
          Rules run from the top for every item you find. The first rule that matches decides what happens to it.
          Items no rule matches are kept. Worn gear is never touched.
        </p>

        <div className="gm-rules">
          {rules.map((r, i) => (
            <div key={i} className="gm-rule">
              <span className="gm-rule__n">{formatNumber(i + 1)}</span>
              <Select label="Rarity" value={r.rarity} options={RARITY_OPTIONS} onChange={(rarity) => set(updateRule(rules, i, { rarity }))} />
              <Select label="Item" value={r.target} options={TARGET_OPTIONS} onChange={(target) => set(updateRule(rules, i, { target }))} />
              <Select label="Action" value={r.action} options={ACTION_OPTIONS} onChange={(action) => set(updateRule(rules, i, { action }))} />
              <div className="gm-rule__btns">
                <button type="button" className="gm-rule__btn" aria-label="Move rule up" disabled={i === 0} onClick={() => set(moveRule(rules, i, -1))}>↑</button>
                <button type="button" className="gm-rule__btn" aria-label="Move rule down" disabled={i === rules.length - 1} onClick={() => set(moveRule(rules, i, 1))}>↓</button>
                <button type="button" className="gm-rule__btn" aria-label="Remove rule" data-danger="" onClick={() => set(removeRule(rules, i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <div className="gm-dialog__actions">
          <button type="button" className="gm-btn" disabled={full} onClick={() => set(addRule(rules))}>
            Add rule
          </button>
          {full && <span className="gm-muted" role="status">{formatNumber(MAX_LOOT_RULES)} rules is the most.</span>}
        </div>

        <fieldset className="gm-fullmode">
          <legend>When the bag and the stash are both full</legend>
          {FULL_MODES.map((m) => (
            <label key={m.mode} className="gm-fullmode__opt">
              <input
                type="radio"
                name="bagFull"
                checked={state.settings.bagFull === m.mode}
                onChange={() => store.setBagFull(m.mode)}
              />
              {m.label}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
