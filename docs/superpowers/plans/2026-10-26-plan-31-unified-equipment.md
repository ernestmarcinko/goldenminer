# Plan 31: Unified equipment tab

**Goal:** Unify the mining and battle paper dolls so both gear sets are always visible on the Inventory screen, and remove the "Mining set / Battle set" toggle that hides one set at a time. Today the Inventory view shows a single paper doll and a toggle to flip it between the two sets (plus a second toggle for the character sheet). After this plan there is no toggle: the mining doll and the battle doll are both on screen at once, so equipping any gear item — from the bag or the stash — is one drag onto an always-visible slot, no matter which set the slot belongs to.

- **One screen, both sets.** The gear column becomes a full-width row that renders a `PaperDoll` for mining and one for battle, side by side on a wide screen and stacked on a phone. Every slot of both sets is a live drop target all the time.
- **Nothing core changes.** The `where: 'worn', slot` drop target already encodes the set (mining slots vs battle slots are distinct slot names), and the one bag and the General stash tab already hold both sets' gear. The equip, unequip, swap and socket paths in `src/core/inventory.ts` are per-slot and set-agnostic, so this plan is entirely view and CSS.
- **The sheet follows.** The character sheet's Mining/Battle toggle goes too: `CharacterSheet` already supports `half="both"`, so the stats show both halves at once under the dolls.

**Architecture:**

- The change is confined to `src/ui/`. `InventoryView.tsx` loses the gear-set `set`/`setSet` state, the `SETS` list and the gear-set toggle, the two effects that switched sets on run-start/end and on an equip, and the `sheetHalf`/stats toggle. It renders a `.gm-dolls` wrapper holding a heading plus `PaperDoll` for each set, then a `CharacterSheet` with `half="both"`.
- `PaperDoll.tsx` stays exactly as it is — it renders one set from `LAYOUT[set]`, and the view simply calls it twice. Each doll keeps its own miner figure and its `flash={s === flashSlot}` highlight; because both dolls are always visible, the equip glow lands on the right slot with no switching.
- The drag-and-drop plumbing is untouched: `dropAttr`/`parseDrop` already accept all nine slots (`SLOTS = [...MINING_SLOTS, ...BATTLE_SLOTS]`), and `itemActions`/`store.equip`/`store.drop` already resolve the set from the item's own `slot`. The one bag, the General stash page and the worn-slot compare card all keep working.
- The layout is CSS: the gear column moves to span the whole width (its own row above the bag and stash), and a new `.gm-dolls` grid lays the two dolls side by side at `repeat(2, minmax(0, 1fr))`, collapsing to one column at 819 px.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. No schema change.

**Spec:** main design §4.6 (the paper doll with Mining set / Battle set tabs) and the Round 4 feedback §2 (the Inventory's three columns, stacked on a phone); `2026-10-24-plan-4-inventory-round-2.md` and `2026-10-24-plan-6-economy-inventory.md` (the unified bag and the mining/battle toggle); `2026-10-26-plan-18-character-stats.md` (the sheet beside the doll); `src/ui/inventory/InventoryView.tsx`, `src/ui/character/PaperDoll.tsx`, `ItemGrid.tsx`, `dragDrop.ts`, `character.css`, `inventory.css`, and `src/core/items.ts` (`GEAR_SETS`, `MINING_SLOTS`, `BATTLE_SLOTS`, `setOfSlot`) as read for this plan.

**Builds on:** the `dev-ernest` line at `a0aa114` (the stats menu) and the runes work in flight; the Inventory view, paper doll, character sheet and drag/drop as they stand. This is a UI-only follow-up to the equipment screen that Plan 2 first built and Plan 4 unified into one bag.

**Roadmap:** this is plan 31. 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24–30. the plans in between · **31. the unified equipment tab** (this plan).

## Global Constraints

- Nothing under `src/core/` changes; it keeps importing no React and touching no DOM / `Date.now()` / `Math.random()`.
- **No `!` non-null assertions** in `src/` (the existing `?? []` and explicit checks stay).
- **No schema change.** `SCHEMA_VERSION` stays where the runes work leaves it (16); this plan does not touch `save.ts` or any migration.
- **The equip path is already set-agnostic.** `where: 'worn', slot` carries the set, and the one bag / General stash already hold both sets. The plan must not add a per-set bag, tab or slot model back.
- **Every Plan 1–30 test stays green.** The `dragDrop`, `stashView`, `itemActions`, `itemView` and `core/inventory` tests are extended by nothing; they pin the unchanged drop targets and equip semantics.
- Phones: both dolls stack at 390 × 844; every slot, heading and cell stays ≥ 44 px; nothing scrolls sideways except the bag grid's own overflow, as today.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **The toggle is gone.** A `grep` for `Gear set`, `Mining set`, `Battle set`, `setSet` and `sheetHalf` returns nothing under `src/`; the only "mining"/"battle" split left is the per-set doll and the sheet's two halves.
2. **Both dolls render always.** `PaperDoll` is called twice (`set="mining"` and `set="battle"`); every one of the nine slots is a live `{ where: 'worn', slot }` drop target, and `parseDrop` still validates all nine via `SLOTS`.
3. **Equip across sets without toggling.** In one visit a player drags a pickaxe onto the mining doll and a weapon onto the battle doll, or uses each item card's Equip; the equip glow (`flashSlot`) lights the correct always-visible slot.
4. **The sheet shows both halves.** `CharacterSheet half="both"` renders Mining then Battle with titles; the removed stats toggle leaves no dead state.
5. **Responsive.** Side by side at ≥ 820 px, stacked below; the 390 × 844 smoke shows both dolls stacked with ≥ 44 px targets and the bag/stash still usable.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Layout | The gear column spans the full width — its own row above the bag and stash — at every width (not only below 1100 px). Inside it, `.gm-dolls` is a `repeat(2, minmax(0, 1fr))` grid holding the two dolls side by side, collapsing to one column at 819 px so the phone stacks mining above battle. |
| Headings | Static set headings "Mining" and "Battle" replace the toggle: display type, uppercase, mining gold for one and battle red for the other, each wrapping its doll in a `<section aria-label>` so the two sets are announced. |
| The figure | One miner figure per doll, the existing `miner` sprite (there is no distinct battle sprite to reuse). The `.gm-inv .gm-doll__figure` override that shrank the figure to 100 × 136 in the old 260 px column goes away, so both dolls use the roomier 132 × 168 figure. |
| Stats | `CharacterSheet` shows both halves (`half="both"`, Mining first); the Mining/Battle stats toggle and its `.gm-sheet__toggle` group are removed. |
| Run / equip auto-switch | The effect that flipped to Battle on map start and Mining on end, and the effect that flipped to an equipped item's set, are both removed — with both dolls always visible, nothing needs to switch. |
| The equip flash | `flashSlot` stays; only `setSet(setOfSlot(recentEquip.slot))` is dropped. The glow appears on whichever always-visible doll's slot the item went into. |
| Core & schema | No `src/core/` change and no `SCHEMA_VERSION` bump. `where: 'worn', slot` already carries the set, and the one bag / General stash already hold both sets' gear. |

## File structure

```
src/ui/
  inventory/
    InventoryView.tsx  MOD  drop SETS, set/setSet, sheetHalf/setSheetHalf, and the two set-switch effects;
                             render a .gm-dolls wrapper (heading + PaperDoll per set) and CharacterSheet half="both";
                             remove now-unused imports (setOfSlot, GearSet, useEffect)
    inventory.css       MOD  .gm-inv becomes a two-column grid with the doll column spanning both;
                             drop the base 260 px column and the 1099 px media block
  character/
    character.css       MOD  .gm-dolls grid, .gm-dolls__set, .gm-dolls__title (+mining/battle accents),
                             .gm-dolls stack at ≤819 px; let the doll figure use the larger size
    PaperDoll.tsx       MOD  (none required; kept single-set) — only touched if a heading/aria-label prop reads cleaner
tests/ui/               —    dragDrop, stashView, itemActions and itemView tests stay green unchanged;
                             a new assertion only if a pure helper is introduced (none is)
```

---

### Task 1: Render both dolls and drop the toggles

**Files:** `src/ui/inventory/InventoryView.tsx`, `src/ui/character/PaperDoll.tsx` (read-only unless a heading prop reads cleaner); tests none (pure suite unaffected).

**Interfaces:**
- Delete from `InventoryView.tsx`: the `SETS` array, the `set`/`setSet` and `sheetHalf`/`setSheetHalf` `useState`s, the `wasRunning`/`shownEquip` refs and their two `useEffect`s, and the gear-set and stats toggle `role="group"` blocks.
- Keep `recentEquip` and `flashSlot = recentEquip?.slot ?? null`; pass `flashSlot` to both dolls.
- Render the gear section as:

  ```
  <section aria-label="Gear" className="gm-inv__col gm-inv__col--doll">
    <div className="gm-dolls">
      <section className="gm-dolls__set" aria-label="Mining gear">
        <h3 className="gm-dolls__title gm-dolls__title--mining">Mining</h3>
        <PaperDoll state={state} set="mining" handlers={handlers} flashSlot={flashSlot} />
      </section>
      <section className="gm-dolls__set" aria-label="Battle gear">
        <h3 className="gm-dolls__title gm-dolls__title--battle">Battle</h3>
        <PaperDoll state={state} set="battle" handlers={handlers} flashSlot={flashSlot} />
      </section>
    </div>
    {tapSpot === 'doll' && tapCard}
    <div className="gm-char__stats">
      <CharacterSheet state={state} half="both" />
    </div>
  </section>
  ```

- `PaperDoll` is unchanged; the `flash={s === flashSlot}` highlight now simply lights the correct slot on the correct always-visible doll.
- Remove the now-unused imports: `setOfSlot` and `type GearSet` from `../../core/items`, and `useEffect` if no other effect remains (the drag/ref plumbing keeps `useState`, `useRef`).

**Step order:** edit `InventoryView.tsx` → `npm run typecheck` (the unused-import removals surface here) → `npm run build` → commit `Show the mining and battle dolls together without a toggle`.

---

### Task 2: Layout — side by side, stacked on the phone

**Files:** `src/ui/inventory/inventory.css`, `src/ui/character/character.css`.

**Interfaces:**
- `inventory.css`: `.gm-inv` becomes `grid-template-columns: repeat(2, minmax(0, 1fr))` and `.gm-inv__col--doll { grid-column: 1 / -1; }`, so the gear row spans the whole width and the bag and stash sit as the two columns beneath it. Remove the base `260px minmax(0,1fr) minmax(0,1fr)` rule, the `1099px` media block that already reproduced this, and the `.gm-inv .gm-doll__figure { width: 100px; height: 136px; }` override (the 132 × 168 figure in `character.css` takes over). Keep the `819px` one-column and `600px` padding blocks.
- `character.css`: add
  - `.gm-dolls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }`
  - `.gm-dolls__set { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }`
  - `.gm-dolls__title` styled like `.gm-sheet__title` (display font, uppercase, 13 px); `.gm-dolls__title--mining` in the mining gold tone and `.gm-dolls__title--battle` in the battle red tone, matching the existing semantic colours.
  - `@media (max-width: 819px) { .gm-dolls { grid-template-columns: 1fr; } }` so the two dolls stack on the phone.

**Checks:** at 1280 × 900 the two dolls sit side by side in one row and the bag + stash share the row below; at 820–1099 px the same holds with the bag grid still ≥ 325 px of content; at 390 × 844 the dolls stack, mining above battle, each doll's 60 px slot boxes and 44 px headings intact.

**Step order:** edit the two CSS files → `npm run build` → browser at 1280 × 900 and 390 × 844 → commit `Lay out the unified equipment row and its phone stack`.

---

### Task 3: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`. Confirm: a `grep` for `Gear set` / `Mining set` / `Battle set` / `setSet` / `sheetHalf` under `src/` returns nothing; `PaperDoll` is called twice and all nine slots still round-trip through `parseDrop` (the unchanged `dragDrop` test); dragging a pickaxe onto the mining doll and a weapon onto the battle doll works in one visit with the equip glow on the right slot; the sheet shows Mining then Battle; both widths (1280 × 900 and 390 × 844) show both dolls with ≥ 44 px targets and no sideways scroll beyond the bag's own overflow.

**Commit:** `Finish the unified equipment tab`.

---

## Definition of done

- The Inventory screen shows the mining and battle paper dolls at once — side by side on a wide screen, stacked on a phone — with no mining/battle toggle.
- Equipping any gear item from the bag or stash is one drag onto its always-visible slot; the equip glow lands on the correct slot with no set switching.
- The character sheet shows both halves (Mining then Battle) and its own toggle is gone.
- The equip/unequip/swap/socket paths and the one bag / General stash are unchanged; no `src/core/` change and no schema bump.
- The full suite, typecheck and build are green; both widths are smoke-checked; nothing pushed.
