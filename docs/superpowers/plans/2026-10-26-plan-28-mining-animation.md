# Plan 28: Mining animation

**Goal:** Add a visible per-tick mining animation on the Mine view so every dig tick produces a visible effect on the rock face — a pickaxe swing, a small chip/spark burst and a brief impact flash. Today a tick that neither finishes a metre nor finds anything is invisible: `digFace` advances `state.progress` silently and only the progress bar moves. This plan makes each tick visibly strike the rock.

- **The gap.** The shaft already shows the miner, the rock face, the crack overlay and the floating `+N Gold` / find pop-ups, but those fire only on *finds* — a vein, a chest, a gem — not on the plain ticks in between. A metre takes many ticks (hardness × hazard / dig power), so most of the digging happens with no visual at all. The owner's intent: *something* must be shown at every tick.
- **Scope.** This animates mining only. The map fight keeps the earlier "no character or weapon swing" decision (main spec §5, "Ernest scratched the swing" for the battle scene); the shaft's pickaxe swing is a new call for the mine.

**Architecture:**

- **The tick model already knows the exact moment.** `applyTicks` → `digFace` advances `state.progress` once per dig tick, and only there: map ticks, paused/idle ticks and held-loot ticks never reach that line. The UI, however, has no event for it. This plan adds a `dig` tick event at that one place and carries it through the existing feedback pipeline to the shaft scene — the same idiom map strikes already use (`strike` → `Feedback.strikes` → `FightScene`).
- **Pure CSS/JS, no new deps.** The strike is a short-lived DOM span driven by `@keyframes` (like the existing `.gm-particle`), spawned by the shaft's existing 250 ms sweep and pruned after its life. No `requestAnimationFrame` loop, no canvas, no new sprite: the swing reuses the `pickaxe` grid already in `src/sprites/grids.ts`; the chips and flash are palette dots.
- **Motion-honouring, schema-free.** The strike rides the existing `floats` motion toggle (the "per-tick feedback" switch), so `prefers-reduced-motion` and the in-game toggle suppress it with no new setting, no migration, no schema bump.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. No schema change, no new sprite.

**Spec:** main design §5 (the Mine board, the shaft scene); the owner's "something should be shown at every tick at the mine"; `2026-10-24-round-2-seeds-procedural-inventory-design.md` §7 (motion settings — players can turn animations off).

**Builds on:** Plans 15–23 (`dev-ernest`) — the shaft scene from Plan 3 (seeds and the mine), the feedback/particle pipeline and the motion settings (Plans 3–4, 9), and the tick model in `src/core/dig.ts`.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24–27. (queued) · **28. mining animation** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. The `dig` event is a plain `TickEvent` pushed to the out-param `events`; core reads nothing back from it.
- **Determinism and stream purity.** The `dig` event is observational: it draws no RNG and mutates no state, so `applyTicks` produces byte-identical `state` whether or not events are collected. The determinism test stays green, unchanged.
- **No schema change.** `SCHEMA_VERSION` is unchanged. The strike gates on the existing `floats` field, so `isMotion` and the migrations are untouched.
- **Cheap.** CSS `transform`/`opacity` only; a handful of short-lived spans per tick, pruned by the existing `pruneParticles`; the sweep already exists and gains no new timer.
- **No new sprites.** The swing is the `pickaxe` grid; chips are bone/gold dots in the existing palette. A dedicated swing frame is left to the art pack.
- Phones: the strike stays inside the shaft scene, is `pointer-events: none`, and is re-checked at 390 × 844.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **One strike per dig tick, and only then.** A `dig` event is emitted exactly once per tick that advanced `state.progress`, and never on a map tick, a paused/idle tick, a held-loot tick, or an instant-metre-only tick. A test drives `applyTicks` through each branch and asserts the `dig` count.
2. **The animation reads at every tick.** At the base auto rate the shaft shows a swing + chips + flash on each tick, and a click shows a burst of `ticksPerClick` strikes. The browser check watches the face for a few seconds.
3. **Determinism is untouched.** Collecting `events` changes nothing about `state.rng`/`state.nextId`/`state.tickCount`; the existing determinism test passes with no edits.
4. **Motion settings hold.** `floats` off (or reduced motion) suppresses the strike; `pops`, `shaft`, `lampFlicker` are unaffected; no schema/version change.
5. **No cross-view clobber.** `Feedback.digs` is drained by the shaft scene; the run view's `drainFeedback` (which ignores `digs`) can't leak a strike into the mine, and the mine can't leak one into a map (no dig ticks run in a map).

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Trigger | A new `TickEvent` `{ kind: 'dig' }`, emitted in `digFace` once per dig tick, immediately after `state.progress += step` (after the `finishInstant` and finite-`step` guards, so instant/paused/held ticks emit nothing). |
| Transport | `Feedback` gains `digs: number`; `fold()` sums `dig` events into it, exactly like `strikes`/`hurt`. Clicks already return events directly (they bypass `fold`), so the click path reads the `dig` events from `store.click()`'s return. |
| What shows per tick | A short pickaxe swing (the existing `pickaxe` sprite, `Sprite` at 2×) sweeping the face, two chip/spark dots flying out, and a one-frame impact flash on the face cell. |
| Rendering | A `dig` particle (`kind: 'dig'`) rendered as a `.gm-shaft__strike` span; the swing, chips and flash are its children, each its own keyframe. Spawned in the 250 ms sweep from `feedback.digs` (one strike per dig) and from click events, pruned by `pruneParticles`. |
| Position | The face cell is one row below the miner (`MINER_ROW + 1`), mid-width: reuse `shaftFaceOrigin`. The swing starts above-right of the face and lands on it. |
| CSS | New `@keyframes gm-swing` (translate + rotate + fade) and `gm-chip` (fly-out + fade) in `theme.css`, plus an `.gm-shaft__impact` opacity pulse; all `transform`/`opacity`, no layout thrash. |
| Motion gating | The strike rides the existing `floats` toggle (per-tick feedback), so `eventsForMotion` already lets a `dig` event through only when `floats` is on. No new setting, no schema bump. |
| Cost guard | At most `MAX_STRIKES = 8` strikes spawn per drain/click; `pruneParticles` caps the list at 30; `dig` particles prune on a short `STRIKE_MS = 260` life while floats/pops keep their 1300 ms. |
| Battle scene | Unchanged — the map fight keeps its "no swing" decision; this plan animates the mine only. |

## File structure

```
src/core/
  types.ts        MOD  TickEvent gains | { kind: 'dig' }
  dig.ts          MOD  digFace emits one dig event per dig tick
src/store/
  gameStore.ts    MOD  Feedback.digs: number; emptyFeedback; fold() sums dig events
src/ui/mine/
  particles.ts    MOD  ParticleKind + 'dig'; feedbackToEvents expands fb.digs into dig events;
                        particlesFromEvents maps a dig event to a strike particle; MAX_STRIKES,
                        STRIKE_MS prune
  ShaftScene.tsx  MOD  render a dig particle as .gm-shaft__strike (swing sprite + chips + flash)
  shaft.css       MOD  .gm-shaft__strike, .gm-shaft__swing, .gm-shaft__chip, .gm-shaft__impact
src/ui/theme.css  MOD  @keyframes gm-swing, gm-chip
tests/
  core/dig.test.ts          MOD  dig event per dig tick; none on map/paused/held/instant ticks
  store/gameStore.test.ts   MOD  fold() sums dig events into Feedback.digs
  ui/particles.test.ts      MOD  dig event -> strike particle; cap; floats-gating of dig events
```

---

### Task 1: The dig event in core

**Files:** `src/core/types.ts`, `src/core/dig.ts`; tests `tests/core/dig.test.ts`.

**Interfaces:**
- `types.ts`: `TickEvent` gains `| { kind: 'dig' }`.
- `dig.ts`: in `digFace`, immediately after `state.progress += step`, add `events?.push({ kind: 'dig' })`. This is the one line that runs per dig tick and never on the early returns (`finishInstant` returning false, or a non-finite/zero `step`), so map, paused, idle and held-loot ticks emit nothing. A metre-completing tick emits both its `dig` event and its `metre`/find events, which is intended — the final strike coincides with the payout float.

**Tests:**
- `applyTicks` over N plain dig ticks collects N `dig` events; over a `digPaused` run, a held-loot (`overflow`) run and a map-activity run it collects none.
- `clickTicks` (via `applyTicks` with `ticksPerClick`) collects one `dig` event per tick.
- Purity: the same state advanced with `events` collected and without produces byte-identical `state` (the `dig` event draws no RNG).

**Step order:** add the union member → emit in `digFace` → write the branch/purity tests → `npx vitest run tests/core/dig.test.ts` → full suite → commit `Emit a dig event on every digging tick`.

---

### Task 2: Carry it through the feedback pipeline

**Files:** `src/store/gameStore.ts`, `src/ui/mine/particles.ts`; tests `tests/store/gameStore.test.ts`, `tests/ui/particles.test.ts`.

**Interfaces:**
- `gameStore.ts`: `Feedback` gains `digs: number`; `emptyFeedback()` returns `digs: 0`; `fold()` adds `else if (e.kind === 'dig') fb.digs += 1`.
- `particles.ts`: `ParticleKind` gains `'dig'`. `feedbackToEvents(f)` pushes `Array.from({ length: f.digs }, () => ({ kind: 'dig' }))`. `particlesFromEvents` maps each `dig` event to a `{ id, kind: 'dig', text: '', x, y, bornAt }` particle at the origin, capped at `MAX_STRIKES = 8` per call. `pruneParticles` prunes `dig` particles on `STRIKE_MS = 260` while floats/pops keep 1300 ms (a small `lifeMs`-by-kind branch).

**Tests:**
- `fold` sums `dig` events into `feedback.digs` and `drainFeedback` resets it.
- `feedbackToEvents({ digs: 3, … })` yields three `dig` events.
- `particlesFromEvents` turns a `dig` event into a `kind: 'dig'` particle at the face origin and caps at 8.
- `eventsForMotion` gates a `dig` event on `floats` (on → kept, off → dropped), independent of `pops`.

**Step order:** `Feedback`/`fold` → `feedbackToEvents`/`particlesFromEvents` → the tests → full suite → commit `Route dig ticks through the feedback pipeline`.

---

### Task 3: The strike animation

**Files:** `src/ui/mine/ShaftScene.tsx`, `src/ui/mine/shaft.css`, `src/ui/theme.css`.

**Work:**
- `ShaftScene.tsx`: in the particle map, render a `dig` particle as
  ```jsx
  <span key={p.id} className="gm-shaft__strike" style={{ left: p.x, top: p.y }}>
    <span className="gm-shaft__swing"><Sprite name="pickaxe" scale={2} /></span>
    <span className="gm-shaft__chip gm-shaft__chip--a" />
    <span className="gm-shaft__chip gm-shaft__chip--b" />
    <span className="gm-shaft__impact" />
  </span>
  ```
  (a non-`dig` particle keeps the existing `.gm-particle` text span). No change to the sweep timing or the click handler beyond what Task 2 already wired.
- `theme.css`: `@keyframes gm-swing` — the pickaxe arcs from a raised position above-right of the face down to the face, rotating ~40°, fading to 0 over ~180 ms. `@keyframes gm-chip` — a dot flies up-and-out and fades over ~260 ms.
- `shaft.css`: `.gm-shaft__strike` (absolute, `transform: translate(-50%, -50%)`, `pointer-events: none`); `.gm-shaft__swing` (`transform-origin` at the pick head, `animation: gm-swing 0.18s ease-out forwards`); `.gm-shaft__chip` (a 3 px bone/gold dot with two fixed offset directions, `animation: gm-chip 0.26s ease-out forwards`); `.gm-shaft__impact` (a brief gold/bone opacity pulse over the face cell, ~150 ms). Everything is `transform`/`opacity`; no `left/top/width/height` animation.
- `@media (prefers-reduced-motion: reduce)`: no new rule is required — `effectiveMotion` already turns `floats` off, so no `dig` particles spawn; add the strike selectors to the existing reduce rule only as belt-and-braces.

**Checks:** `npm run build`; browser at 1280 × 900 and 390 × 844 — watch the face during auto digging (a strike each tick) and on click (a burst); toggle Floats off in Settings → the strike stops while pops continue; enable the system reduced-motion preference → the strike stops.

**Step order:** keyframes → the strike markup → CSS → build → browser check → commit `Animate a pickaxe strike on every dig tick`.

---

### Task 4: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`; confirm the determinism test is green with no edits; confirm no new dependency in `package.json`; a `grep` for `Date.now`/`Math.random` under `src/core` returns nothing new; confirm the strike is cheap (a few spans per tick, pruned within ~260 ms) and honours `floats` and reduced motion at both widths.

**Commit:** `Finish the per-tick mining animation`.

---

## Definition of done

- Every digging tick emits exactly one `dig` event, and no map/paused/idle/held/instant tick emits one; determinism and the loot stream are byte-identical.
- The Mine view shows a visible strike — pickaxe swing, chip sparks and an impact flash — on the rock face each dig tick and on every click, via the existing feedback pipeline, in pure CSS/JS.
- The strike rides the `floats` toggle and reduced motion; no new setting, no schema change, no new sprite, no new dependency.
- The full suite, typecheck and build are green; the strike is re-checked at desktop and phone widths; nothing pushed.
