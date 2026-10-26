import { useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { MAX_LOOT_RULES } from '../../core/balance';
import { describeRule } from '../../core/lootFilter';
import type { LootKind, LootRule } from '../../core/types';
import type { GameStore } from '../../store/gameStore';
import { formatNumber } from '../format';
import { useDialog } from '../useDialog';
import {
  GEM_OPTIONS, GRADE_OPTIONS, KIND_OPTIONS, MAP_MOD_OPTIONS, MATERIAL_OPTIONS, RUNE_OPTIONS, SET_OPTIONS, actionOptionsFor, addRow,
  boxProblems, boxRejects, boxTextsFor, fieldsFor, levelLabel, moveRow, moveTarget, rarityOptionsFor, removeRow,
  ruleProblems, rowsOf, rulesOf, setRange, slotOptionsFor, storedRules, withKind, withModTier, withPick,
} from './lootFilterView';
import type { NumberBox as NumberBoxKey, Option, RuleField, RuleRow } from './lootFilterView';

function Select<T extends string>({ label, value, options, onChange, selectRef }: {
  label: string; value: T; options: readonly Option<T>[]; onChange: (v: T) => void;
  selectRef?: { current: HTMLSelectElement | null };
}) {
  return (
    <select
      ref={selectRef}
      aria-label={label}
      className="gm-pick__select"
      value={value}
      onChange={(e) => {
        const picked = options.find((o) => o.value === e.currentTarget.value);
        if (picked) onChange(picked.value);
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// A boxed control with its caption inside, as the board draws them.
function Pick<T extends string>({ caption, wide = false, ...select }: {
  caption: string; wide?: boolean; label: string; value: T; options: readonly Option<T>[]; onChange: (v: T) => void;
  selectRef?: { current: HTMLSelectElement | null };
}) {
  return (
    <label className="gm-pick" data-wide={wide ? '' : undefined}>
      <span className="gm-pick__cap">{caption}</span>
      <Select {...select} />
    </label>
  );
}

type BoxTexts = Readonly<Partial<Record<NumberBoxKey, string>>>;

// A box shows what was typed, even when the rule can't take it, so a refused number stays in sight, marked.
function NumberBox({ box, label, value, texts, onText }: {
  box: NumberBoxKey; label: string; value: number | undefined; texts: BoxTexts; onText: (box: NumberBoxKey, text: string) => void;
}) {
  const text = texts[box] ?? (value === undefined ? '' : String(value));
  return (
    <input
      type="text" inputMode="numeric" placeholder="any" aria-label={label} className="gm-pick__num"
      aria-invalid={boxRejects(box, text) || undefined} value={text} onInput={(e) => onText(box, e.currentTarget.value)}
    />
  );
}

/** The field row for the rule's kind: a select per pick, two number boxes per range, one for the modifier tier. */
function RuleFields({ rule, onChange, texts, onText }: {
  rule: LootRule; onChange: (rule: LootRule) => void; texts: BoxTexts; onText: (box: NumberBoxKey, text: string) => void;
}) {
  const box = (key: NumberBoxKey, label: string, value: number | undefined, apply: (text: string) => LootRule) => (
    <NumberBox
      box={key} label={label} value={value} texts={texts}
      onText={(k, t) => { onText(k, t); onChange(apply(t)); }}
    />
  );
  const range = (field: 'level' | 'mods', caption: string) => (
    <div key={field} className="gm-pick" data-wide="" role="group" aria-label={caption}>
      <span className="gm-pick__cap">{caption}</span>
      <span className="gm-pick__word">from</span>
      {box(`${field}.min`, `${caption} from`, rule[field]?.min, (t) => setRange(rule, field, 'min', t))}
      <span className="gm-pick__word">to</span>
      {box(`${field}.max`, `${caption} to`, rule[field]?.max, (t) => setRange(rule, field, 'max', t))}
    </div>
  );
  const field = (f: RuleField) => {
    switch (f) {
      case 'set':
        return <Pick key={f} caption="Set" label="Set" value={rule.set ?? 'any'} options={SET_OPTIONS} onChange={(v) => onChange(withPick(rule, 'set', v))} />;
      case 'slot':
        return <Pick key={f} caption="Slot" label="Slot" value={rule.slot ?? 'any'} options={slotOptionsFor(rule)} onChange={(v) => onChange(withPick(rule, 'slot', v))} />;
      case 'rarity':
        return (
          <Pick key={f} caption="Rarity" label="Rarity" value={rule.rarity ?? 'any'} options={rarityOptionsFor(rule)}
            onChange={(v) => onChange(withPick(rule, 'rarity', v))} />
        );
      case 'level': return range('level', levelLabel(rule.kind));
      case 'mods': return range('mods', 'Modifiers');
      case 'modTier':
        return (
          <div key={f} className="gm-pick" data-wide="" role="group" aria-label="A modifier at tier">
            <span className="gm-pick__cap">A modifier at T</span>
            {box('modTier', 'A modifier at tier', rule.modTier, (t) => withModTier(rule, t))}
            <span className="gm-pick__word">or above</span>
          </div>
        );
      case 'mapMod':
        return (
          <Pick key={f} caption="Has modifier" label="Has modifier" value={rule.mapMod ?? 'any'} options={MAP_MOD_OPTIONS}
            onChange={(v) => onChange(withPick(rule, 'mapMod', v))} />
        );
      case 'gem':
        return <Pick key={f} caption="Gem" label="Gem" value={rule.gem ?? 'any'} options={GEM_OPTIONS} onChange={(v) => onChange(withPick(rule, 'gem', v))} />;
      case 'grade':
        return <Pick key={f} caption="Grade" label="Grade" value={rule.grade ?? 'any'} options={GRADE_OPTIONS} onChange={(v) => onChange(withPick(rule, 'grade', v))} />;
      case 'rune':
        return <Pick key={f} caption="Rune" label="Rune" value={rule.rune ?? 'any'} options={RUNE_OPTIONS} onChange={(v) => onChange(withPick(rule, 'rune', v))} />;
      case 'material':
        return (
          <Pick key={f} caption="Material" label="Material" value={rule.material ?? 'any'} options={MATERIAL_OPTIONS}
            onChange={(v) => onChange(withPick(rule, 'material', v))} />
        );
    }
  };
  return <div className="gm-rule-editor__fields">{fieldsFor(rule.kind).map(field)}</div>;
}

/**
 * The loot filter: the rules as sentences, each with Edit and ✕, and under them an editor for one rule. Nothing a click
 * lands on moves: Add rule sits in the head, outside the scrolling list; a removed rule leaves its row, as tall as it
 * was, until the dialog closes; moving is done from the editor, whose box keeps one size whatever the kind shows. A
 * rule Add rule makes is stored only by its Save, ✕ or move.
 */
export function LootFilterDialog({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { focusRef: closeRef, depth } = useDialog<HTMLButtonElement>(onClose, dialogRef);
  const [rows, setRows] = useState<readonly RuleRow[]>(() => rowsOf(store.state.settings.lootFilter));
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<LootRule | null>(null);
  // what each number box of the open rule holds as typed; a new draft starts them afresh
  const [texts, setTexts] = useState<BoxTexts>({});
  // set by an Add rule refused at the most rules, until the next Add rule: its line in the head never comes and goes
  // under a click anywhere but Add rule itself
  const [refusedAdd, setRefusedAdd] = useState(false);
  // a removed row keeps the height it had, so a row under it never slides up under the pointer
  const [removedHeights, setRemovedHeights] = useState<Readonly<Record<number, number>>>({});
  // the row Add rule made, until its Save, ✕ or move writes it; Cancel, Edit on another row, Add rule again or closing
  // the dialog drops it, and the store never had it
  const [unsaved, setUnsaved] = useState<number | null>(null);
  const reveal = useRef<number | null>(null);
  const focusAfter = useRef<string | null>(null);

  const save = (next: readonly RuleRow[], stillUnsaved: number | null = unsaved): void => {
    setRows(next);
    setUnsaved(stillUnsaved);
    store.setLootFilter(storedRules(next, stillUnsaved));
  };
  const keepHeight = (i: number): void => {
    const row = listRef.current?.querySelector(`[data-row="${i}"]`);
    if (row) setRemovedHeights((h) => ({ ...h, [i]: row.getBoundingClientRect().height }));
  };
  // a dropped new rule leaves an empty row, as ✕ does, so nothing under the pointer moves
  const dropUnsaved = (from: readonly RuleRow[]): readonly RuleRow[] => {
    if (unsaved === null) return from;
    keepHeight(unsaved);
    setUnsaved(null);
    return removeRow(from, unsaved);
  };
  const full = rulesOf(rows).length >= MAX_LOOT_RULES;

  useLayoutEffect(() => {
    const list = listRef.current;
    const row = reveal.current === null ? null : list?.querySelector<HTMLElement>(`[data-row="${reveal.current}"]`);
    reveal.current = null;
    if (list && row) {
      // only the list scrolls: the head and the editor stay where they are
      const box = list.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (r.bottom > box.bottom) list.scrollTop += r.bottom - box.bottom;
      else if (r.top < box.top) list.scrollTop -= box.top - r.top;
    }
    const target = focusAfter.current === null ? null : dialogRef.current?.querySelector<HTMLElement>(focusAfter.current);
    focusAfter.current = null;
    target?.focus({ preventScroll: true });
  });

  const edit = (i: number): void => {
    const rule = rows[i];
    if (rule == null || open === i) return;
    if (unsaved !== null) setRows(dropUnsaved(rows));
    setOpen(i);
    setDraft(rule);
    setTexts({});
    focusAfter.current = '[data-editor-kind]';
  };
  const close = (): void => {
    if (open !== null) focusAfter.current = `[data-row="${open}"] [data-edit]`;
    setOpen(null);
    setDraft(null);
    setTexts({});
  };
  const cancel = (): void => {
    close();
    if (unsaved === null) return;
    setRows(dropUnsaved(rows));
    // its Edit is gone with it: focus stays at the row, as after ✕
    focusAfter.current = `[data-row="${unsaved}"] [data-removed-text]`;
  };
  const add = (): void => {
    const next = addRow(rows);
    setRefusedAdd(next === rows);
    if (next === rows) return;
    setRows(dropUnsaved(next));
    setUnsaved(next.length - 1);
    setOpen(next.length - 1);
    setDraft(next[next.length - 1] ?? null);
    setTexts({});
    reveal.current = next.length - 1;
  };
  const remove = (i: number, e: MouseEvent<HTMLButtonElement>): void => {
    const row = e.currentTarget.closest('[data-row]');
    if (row) setRemovedHeights((h) => ({ ...h, [i]: row.getBoundingClientRect().height }));
    save(removeRow(rows, i), i === unsaved ? null : unsaved);
    if (open === i) {
      setOpen(null);
      setDraft(null);
    }
    // the ✕ is gone: focus stays at the row, so Tab goes on to the next one
    focusAfter.current = `[data-row="${i}"] [data-removed-text]`;
  };
  const move = (delta: -1 | 1): void => {
    if (open === null) return;
    const to = moveTarget(rows, open, delta);
    if (to === undefined) return;
    save(moveRow(rows, open, delta), null);
    setOpen(to);
    reveal.current = to;
  };

  const problems = draft === null ? [] : [...ruleProblems(draft), ...boxProblems(texts, draft.kind)];
  const upTo = open === null ? undefined : moveTarget(rows, open, -1);
  const downTo = open === null ? undefined : moveTarget(rows, open, 1);
  return (
    <div className="gm-overlay gm-overlay--top" style={{ zIndex: 10 + depth }}>
      <div ref={dialogRef} className="gm-dialog gm-dialog--rules" role="dialog" aria-modal="true" aria-labelledby="gm-filter-title">
        <div className="gm-dialog__head gm-rules__head">
          <h2 id="gm-filter-title" className="gm-dialog__title">Loot filter</h2>
          <div className="gm-rules__head-btns">
            {/* aria-disabled, so Enter at the last rule keeps focus here; a refused click says why */}
            <button type="button" className="gm-btn" aria-disabled={full || undefined} onClick={add}>Add rule</button>
            <button type="button" ref={closeRef} className="gm-btn" onClick={onClose}>Close</button>
          </div>
          <p className="gm-rules__full" role="status">{refusedAdd ? `${formatNumber(MAX_LOOT_RULES)} rules is the most.` : ''}</p>
        </div>

        <div ref={listRef} className="gm-rules__scroll">
          <p className="gm-rules__intro">
            Rules run from the top for every find. The first rule that matches decides what happens to it. Finds no rule
            matches go to your bag. Worn gear is never touched.
          </p>
          <div className="gm-rules">
            {rows.map((r, i) => (
              r === null ? (
                <div key={i} data-row={i} className="gm-rule" data-removed="" style={{ minHeight: removedHeights[i] }}>
                  <span className="gm-rule__n">{formatNumber(i + 1)}</span>
                  <span className="gm-rule__text" data-removed-text="" tabIndex={-1}>Removed</span>
                </div>
              ) : (
                <div key={i} data-row={i} className="gm-rule" data-open={open === i ? '' : undefined}>
                  <span className="gm-rule__n">{formatNumber(i + 1)}</span>
                  <span className="gm-rule__text">{describeRule(r)}</span>
                  <button type="button" className="gm-btn gm-rule__edit" data-edit="" aria-pressed={open === i} onClick={() => edit(i)}>
                    {open === i ? 'Editing' : 'Edit'}
                  </button>
                  <button
                    type="button" className="gm-rule__btn" data-danger="" aria-label={`Remove rule ${formatNumber(i + 1)}`}
                    onClick={(e) => remove(i, e)}
                  >
                    ✕
                  </button>
                </div>
              )
            ))}
          </div>
        </div>

        <section className="gm-rule-editor" aria-label="Rule editor" data-empty={open === null || draft === null ? '' : undefined}>
          {open === null || draft === null ? (
            <>
              <div className="gm-rule-editor__head">
                <p className="gm-rule-editor__none">Press Edit on a rule to change it here.</p>
              </div>
              <div className="gm-rule-editor__body" />
            </>
          ) : (
            <>
              <div className="gm-rule-editor__head">
                <h3 className="gm-rule-editor__title">Rule {formatNumber(open + 1)}</h3>
                <label className="gm-pick" data-head="kind">
                  <span className="gm-pick__cap">Kind</span>
                  <select
                    data-editor-kind="" aria-label="Kind" className="gm-pick__select" value={draft.kind}
                    onChange={(e) => {
                      const kind = KIND_OPTIONS.find((o) => o.value === e.currentTarget.value)?.value;
                      if (!kind) return;
                      setDraft(withKind(draft, kind as LootKind | 'any'));
                      // a box whose field the kind drops loses its text too, so no box shows a bound the rule lacks
                      setTexts((t) => boxTextsFor(t, kind as LootKind | 'any'));
                    }}
                  >
                    {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="gm-pick" data-head="action">
                  <span className="gm-pick__cap">Action</span>
                  <Select label="Action" value={draft.action} options={actionOptionsFor(draft.kind)} onChange={(action) => setDraft({ ...draft, action })} />
                </label>
                {/* aria-disabled, not disabled: a button that disables under keyboard focus drops it to the page */}
                <button type="button" className="gm-btn gm-rule-editor__btn" aria-disabled={upTo === undefined} onClick={() => move(-1)}>
                  Move up
                </button>
                <button type="button" className="gm-btn gm-rule-editor__btn" aria-disabled={downTo === undefined} onClick={() => move(1)}>
                  Move down
                </button>
                <button
                  type="button" className="gm-btn gm-btn--primary gm-rule-editor__btn" data-save="" disabled={problems.length > 0}
                  onClick={() => {
                    save(rows.map((r, j) => (j === open ? draft : r)), null);
                    close();
                  }}
                >
                  Save
                </button>
                <button type="button" className="gm-btn gm-rule-editor__btn" onClick={cancel}>Cancel</button>
              </div>
              <div className="gm-rule-editor__body">
                <RuleFields rule={draft} onChange={setDraft} texts={texts} onText={(box, text) => setTexts((t) => ({ ...t, [box]: text }))} />
                <div className="gm-rule-editor__problems" role="status">
                  {problems.map((p) => <p key={p}>{p}</p>)}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
