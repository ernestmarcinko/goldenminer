# Plan 32: Achievement notifications

**Goal:** When an achievement is earned, tell the player with a pop-down toast at the top of the screen showing that achievement's icon and text, dismissible with an X button. Achievements are a permanent-boost meta-progression (Plan 20), so they should *feel* earned the moment they happen, not only be discoverable later in the Achievements tab.

- **A toast, not a tab.** The Achievements tab already lists every family and its achievements; it stays. This plan adds a transient notification that pops down from the top of the screen the moment one (or several) achievements are earned.
- **Icon + text.** Each toast shows the achievement's icon, its name and its description, plus an **X** button that closes it immediately. It also auto-dismisses after a short pause so it never needs managing.
- **The append-only trick.** `checkAchievements` (Plan 20) pushes into `state.achievements.earned`, which is append-only and never re-ordered or removed. So the store detects what was *just* earned by snapshotting the array before a mutation and reading the tail after — no core call site changes, no signature change, no schema change.

**Architecture:**

- **Core stays pure.** `src/core/achievements.ts` gains two pure additions only: an `ACHIEVEMENT_BY_ID` map (id → `AchievementDef`) and a family→glyph map so an achievement's icon is a pure lookup. Nothing under `src/core/` learns about React, the DOM, or time; the toast lives entirely in `src/ui/` + the store.
- **The store owns the queue.** The store snapshots `state.achievements.earned.length` before an action that can mutate counters, and after it maps the tail (`earned.slice(before)`) to `AchievementDef`s and enqueues them as notifications. Notifications are **transient** — store state, never written into `GameState`, never saved.
- **The UI renders the stack.** A fixed top-of-screen stack renders the queue; each entry is a toast (icon, name, desc, X) that slides down, auto-dismisses, and can be closed early.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. No schema change.

**Spec:** `2026-10-26-plan-20-achievements.md` (the achievements table this notifies about); the pixel-icon kit in `src/core/skillIcons.ts` (the icon source).

**Builds on:** Plan 20 (achievements), already committed.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. start screen · 25. skill-tree layout · 26. ascendancy-tree rebalance · 27. crafting rebalance · 28. mining animation · 29. ascendancy icons · 30. damage types and resistances · 31. unified equipment · **32. achievement notifications** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. Auto-dismiss timing uses the store/clock's existing time source, never `Date.now()` in core (and ideally not in the UI either — a CSS animation or the loop's tick count suffices).
- No `!` non-null assertions in `src/`.
- **No schema change.** Notifications are transient store state; `state.achievements.earned` already persists.
- **The loot/RNG stream is unchanged.** Detection is a read-only snapshot/diff of `earned`; it never reads or advances `state.rng`.
- **Determinism holds.** A no-achievement run enqueues nothing and stays byte-identical; a run that earns achievements still has an identical `state.rng` stream (notifications are pure UI side-effects off a monotonic counter).
- No new dependencies; the full suite, typecheck and build stay green.

## Review Focus

1. **The moment it happens.** Earning one achievement pops one toast; crossing several thresholds at once (a big level-up, a deep run, offline catch-up) pops a *bounded* stack, never an unbounded flood.
2. **Icon and text are correct.** Each toast shows the achievement's own icon, name and description — the same strings the Achievements tab shows — not a generic "Achievement unlocked".
3. **X closes, timeout fades.** Clicking X (or keyboard `Escape`/`Enter` if implemented) removes that toast immediately; an untouched toast auto-dismisses. No toast lingers forever and no toast steals focus from mining.
4. **No re-notify.** Reloading a save that already earned an achievement does not re-toast it (the diff is empty); replaying the same action that already crossed the threshold enqueues nothing.
5. **Nothing regressed.** The boost, the tab, and the balance sim are untouched; the notification is a pure overlay.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Detection | Diff the append-only `state.achievements.earned`. The store snapshots its length before a mutation and maps the tail to defs after. `checkAchievements` keeps its `void` signature — no core call-site churn. |
| Icon source | Each **family** gets one icon (a pixel glyph), not each of the ~1000 achievements. Reuse existing `skillIcons` glyphs where one fits (e.g. coin → Gold, pickaxe/dig → Digging, sword → Kills, diamond → Diamonds, gem → Gems), and add a small handful of new 16×16 family glyphs for the rest. `achievementIcon(def)` returns the family's glyph, so the toast and the tab can share it. |
| Family→glyph mapping | A `FAMILY_ICONS: Record<string, IconGlyphId>` table in `src/core/achievements.ts` (pure data). Families without a natural glyph get a new generic one in the skillIcons kit (e.g. a trophy, a heart for Deaths, a flask for Merchant, a star for Legendaries). |
| Toast contents | Icon + `name` (bold) + `desc` (muted), an **X** button top-right, and a subtle "Achievement" eyebrow for context. |
| Stack & cap | The store queues notifications FIFO; the UI renders up to **5** toasts at once (the rest wait). New toasts appear at the top of the stack and push older ones down. |
| Auto-dismiss | Each toast auto-dismisses after ~6 s, driven by a per-toast timer in the component (or the loop's tick), not `Date.now()`. The X dismisses immediately. |
| Motion | The toast slides down ~240 ms and fades out; it honours the existing `floats`/reduced-motion toggle (the same switch Plan 28 rides), so no new setting. |
| Offline catch-up | Offline progress that crosses many thresholds at once drains through the same capped FIFO stack (max 5 visible). No special "you earned N" summary — the cap alone keeps it from flooding, and it matches the already-monotonic, already-cheap check. |
| Placement | Fixed top of the viewport, centred, below any header, `pointer-events` only on the toasts themselves so the mine stays clickable underneath. On a 390 px phone the toasts span the full width with a small margin. |

## File structure

```
src/core/
  achievements.ts   MOD  ACHIEVEMENT_BY_ID map; FAMILY_ICONS table; achievementIcon(def)
  skillIcons.ts     MOD  a few new 16×16 family glyphs (only the ones no existing glyph covers)
src/store/
  gameStore.ts      MOD  notification queue (transient); snapshot+enqueue around counter mutations
src/ui/
  achievements/AchievementToast.tsx  NEW  the toast + stack component
  achievements/achievements.css      MOD  toast styles + slide/fade keyframes
  App.tsx           MOD  render <AchievementToastStack store={store}/>
tests/
  core/achievements.test.ts  MOD  ACHIEVEMENT_BY_ID completeness; achievementIcon covers every family
  ui/achievements.test.ts    MOD  store enqueues the diff, no re-notify, X dismisses, cap holds
```

---

### Task 1: Core lookups (icons + by-id)

**Files:** `src/core/achievements.ts`, `src/core/skillIcons.ts`; test `tests/core/achievements.test.ts`.

**Work:** add `ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef>` (built once from `ACHIEVEMENTS`); add `FAMILY_ICONS: Record<string, IconGlyphId>` mapping every family (`depth`, `dig`, `gold`, `diamonds`, `gems`, `maps`, `kills`, `bosses`, `deaths`, `levels`, `ascensions`, `craft`, `merchant`, `legendaries`, `sockets`, and each `ore.<material>`) to a glyph; add `achievementIcon(def): IconGlyphId`. Add new glyphs to `skillIcons.ts` only where no existing glyph fits.

**Tests:** `ACHIEVEMENT_BY_ID` has one entry per `ACHIEVEMENTS` entry and resolves every id; `achievementIcon` returns a defined glyph for every family (iterate `FAMILY_LABELS`); the new glyphs type-check against the kit's glyph-id union.

**Step order:** map + `achievementIcon` → new glyphs → tests → commit `Give each achievement family an icon`.

---

### Task 2: The store queue

**Files:** `src/store/gameStore.ts`; test `tests/ui/achievements.test.ts`.

**Work:** add a transient `notifications: { id, icon, name, desc }[]` (and a monotonically increasing `id` so React re-triggers). Snapshot `state.achievements.earned.length` before each counter-mutating action and, after, map `earned.slice(before)` → defs (via `ACHIEVEMENT_BY_ID`) and prepend them. Wire this into the store's single mutation path (or each action) so it covers dig, combat, loot, level, ascend, merchant and craft hooks. Add `dismissNotification(id)` and `dismissAll()`.

**Tests:** an action that crosses one threshold enqueues exactly one notification with the right name/desc/icon; crossing three at once enqueues three; repeating the action enqueues none; `dismissNotification` removes only that id; a fresh store starts with an empty queue.

**Step order:** queue state + snapshot/enqueue → dismiss helpers → tests → commit `Queue achievement toasts in the store`.

---

### Task 3: The toast UI

**Files:** `src/ui/achievements/AchievementToast.tsx`, `src/ui/achievements/achievements.css`, `src/ui/App.tsx`; test `tests/ui/achievements.test.ts`.

**Work:** `AchievementToast` renders the icon (the skillIcon `<Sprite>`/glyph component, per the existing kit), the `name`, the `desc`, and an **X** button. `AchievementToastStack` renders the FIFO queue capped at 5, newest on top. The toast slides down on mount, auto-dismisses after ~6 s (a per-toast timer), and honours the motion toggle. `App.tsx` mounts the stack once at the app root so it overlays every view.

**Tests:** the stack renders icon + name + desc for each queued item; the X button calls `dismissNotification`; a rendered toast auto-dismisses when its timer elapses; the cap keeps at most 5 visible while the queue drains.

**Step order:** toast component → stack + mount → CSS animation → tests → commit `Pop down achievement toasts`.

---

### Task 4: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`; `npm run balance` (the boost and reference run are untouched, so it must stay green); a smoke at 1280×900 and 390×844 — earn an achievement live, see the toast pop down, click X, and confirm a second identical action doesn't re-toast; confirm the mine stays clickable under the toasts.

**Commit:** `Finish achievement notifications`.

---

## Definition of done

- Earning an achievement pops a toast at the top of the screen showing its icon, name and description, with an **X** that dismisses it and a ~6 s auto-dismiss.
- The store detects new achievements by diffing the append-only `earned` list; no core call site changed, no schema bump, the RNG stream untouched.
- The stack is capped at 5 and drains FIFO; repeated or reloaded-earned achievements never re-toast.
- Every family has an icon, and the toast's text matches the Achievements tab's strings.
- Full suite, balance, typecheck and build are green; nothing pushed.
