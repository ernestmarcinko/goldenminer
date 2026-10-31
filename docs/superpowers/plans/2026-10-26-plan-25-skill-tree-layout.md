# Plan 25: Skill-tree layout — a decluttered, POE2-balanced passive web

**Goal:** Re-space and re-wire the passive skill web so it stops reading as a cluttered, tightly-packed ring and reads like a Path of Exile 2 tree: nodes with room to breathe, majors (notables and keystones) clearly separated, fewer straight radial runs, and a scattered, balanced placement. At the same time, remove the shortcut connections that let one major node chain-open other majors.

- **The clutter.** The current web (Plan 16) places each cluster's smalls *along a straight ray* from its entry to its terminal, and rings the terminals on a tight 12-spoke × 3-ring grid. A 6-small cluster is ~170 px long, so its smalls sit ~24 px apart — under the 48 px icons they overlap, and the 44 px hit circles collide. Ring-1 majors are ~90 px apart.
- **The chain-open.** Every terminal cross-links its ring neighbours (`cross` is terminal→terminal), so once you reach one notable/keystone you can often spend straight into a neighbouring major without walking its minors. The owner wants majors reached *only* through their own cluster's minors, like POE2.
- **The fix, in two halves.** A geometry rewrite (larger gaps, scattered hand-placed cluster centres, curved cluster paths instead of straight rays) and a connection-policy rewrite (no edge may link two majors; cross-links move down to the minor level). The two are independent and land as separate commits.

**Architecture:**

- The web is still **pure core** (`src/core/passives.ts`), and only its geometry (`x`/`y`) and `links` change — both of which are **derived, never saved**. A save stores `passives.allocated: string[]` of ids, so the node-content (`n` specs and `SMALL_BUDGET`) is untouched and old ids keep meaning the same stat.
- **Node-id stability stays the hard constraint.** `SMALL_BUDGET` keeps its exact order (so `miningSmall1..48`, `battleSmall1..48`, `hybridSmall1..19` keep their stats), every named id stays, no node is removed or re-pointed. The builder's numbering is load-bearing and unchanged.
- **One schema bump for the link change.** Removing a major→major cross-link can leave an old save's allocation disconnected, and `isPassives` (save.ts:759) rejects a web whose allocated set is not connected. So `SCHEMA_VERSION` 17 → 18 and `MIGRATIONS[17]` prunes an old allocation to its still-connected set (points are derived, so a pruned node's point returns automatically — a free respec of the disconnected tail, nothing else lost).
- **No rendering change.** `Web.tsx` draws every node at its `(x, y)` and `skills.css` sizes the icons/hit circles; larger gaps need no new code. The viewport, `Fit`, zoom and the 44 px hit targets are re-checked, not re-designed.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. One schema bump (17 → 18).

**Spec:** `2026-10-26-plan-16-passive-web-rework.md` (the cluster layout this replaces), `2026-10-26-plan-11-passive-web.md` (the original web); main design §4 (the passive web).

**Builds on:** Plan 24 (`dev-ernest`), on top of the Plan 16 cluster layout and the Plan 23 schema-16 baseline.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. (the plan this one follows) · **25. skill-tree layout** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`.
- **Node-id stability:** no existing id may be removed, renamed, or re-pointed to a different stat. `SMALL_BUDGET` order is fixed forever. Only `x`, `y` and `links` change.
- **No major↔major edges.** An invariant, not a hope: the builder must not emit a link whose two endpoints are both `notable`/`keystone`, and a test enforces it. A major's only link is its own cluster's last small.
- **The web stays one connected mesh.** Every node still reaches the start; the minor-level cross-links still close cycles (the "woven mesh, not a forest of spokes" test keeps passing). No node may be orphaned.
- **Old saves load.** `SCHEMA_VERSION` 17 → 18; `MIGRATIONS[17]` prunes a now-disconnected allocation to a connected set. No other migration touches passives.
- **Readability first:** the states (allocated, allocatable, staged, refunding), search, pan/zoom and the ≥ 44 px hit targets stay clear. Adjacent hit circles no longer overlap.
- Phones: the web re-checked at 390 × 844; icons read at 1× and zoomed.
- No new dependencies. Tests stay green; the full suite, typecheck and build pass.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **It breathes.** A before/after screenshot shows the same 200 nodes with visible gaps: adjacent smalls ~92 px apart, majors ~280 px apart, no tight radial lattice. The fitted and zoomed views are attached.
2. **Majors no longer gateway majors.** A `grep`/test walks every edge and asserts no edge joins two `notable`/`keystone` nodes. Reaching any major allocates no other major directly.
3. **Every existing id still means the same stat.** The Plan 16 id-stability tests (id→stat for every old small, the 14 keystones, the 22 notables) still pass untouched.
4. **Old saves load.** A crafted old save whose web connected through a major→major cross-link loads, prunes only the disconnected tail, and returns those points; a save that reached everything through minors is byte-identical after load.
5. **Nothing regressed.** Allocation, staging, refunds, search, the reset, and the balance sim's passive policy all behave; the sim still paths to Surveyor.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| World / canvas | Widen the coordinate canvas to a **2400 × 2000** world with the start at `START_X = 1200, START_Y = 1000` (was 560, 400). The SVG viewport stays 1120 × 760; `Fit` and the initial zoom-on-start absorb the larger world with no code change. |
| Spacing constants | `SMALL_GAP = 92` (minimum centre distance between adjacent smalls along a chain — roughly two icon widths, so icons and their 44 px hit circles stop overlapping), `MAJOR_GAP = 280` (minimum centre distance between any two majors), `CLUSTER_GAP = 120` (minimum distance between a node and a node of a different cluster), `MAX_RADIUS = 1100` (the bound the geometry test checks every node against). |
| Cluster placement | Replace the 12-spoke × 3-ring radial grid with **36 hand-scattered cluster centres** across the three side wedges (battle right, mining left, hybrid top). Angles and radii are jittered from the old grid, then nudged so no two majors are under `MAJOR_GAP`, no three terminals are collinear, and the whole web stays inside `MAX_RADIUS`. Hand-tuned once in the file, not computed by a formula. |
| Cluster paths | Smalls no longer line up on the straight entry→terminal ray. Each cluster gets a **`bend` control point** and its smalls are placed at even arc-length steps along the quadratic Bézier entry→bend→terminal, with every step ≥ `SMALL_GAP`. Chains read as gentle arcs, so the web loses its straight radial runs. |
| Connection policy | **No edge links two majors.** A notable/keystone links only to its own cluster's last small (it is a leaf within the major graph). The mesh's cycles move down: a cluster's **first small cross-links to a neighbour cluster's first small** (minor↔minor), replacing the old terminal↔terminal `cross`. `entry` keeps meaning "this cluster's first small links to the start or to another cluster's terminal" — finishing a major still branches into a neighbour's *minors*, but never into its major. |
| `cross` field | Repurposed: instead of `terminal id[]` (terminal↔terminal), it names clusters (by terminal id) whose **first small** this cluster's first small cross-links to. The builder resolves these to small ids after all smalls are placed. |
| id stability | `SMALL_BUDGET` order unchanged; all named ids kept; no node removed. `x`/`y`/`links` change, which the save never records. |
| Save migration | `SCHEMA_VERSION` 17 → 18. `MIGRATIONS[17]` runs `prunePassives(state.passives.allocated)`: keep each allocated id in allocation order iff it links to the start or an already-kept node under the new graph. Disconnected majors drop off and their points return (points are `level − 1 − allocated.length`). |
| Geometry test bound | The "no node further than a bounded distance from the start" bound rises from 500 to `MAX_RADIUS = 1100`, matching the larger world. |

## Spacing constants (tuned, then pinned by test)

| Constant | Value | Meaning |
|---|---|---|
| `START_X`, `START_Y` | 1200, 1000 | The miner's centre in the new world |
| `WORLD_W`, `WORLD_H` | 2400, 2000 | Coordinate extents (nodes stay well inside) |
| `SMALL_GAP` | 92 | Min centre distance between chained smalls |
| `MAJOR_GAP` | 280 | Min centre distance between any two majors |
| `CLUSTER_GAP` | 120 | Min distance between different clusters' nodes |
| `MAX_RADIUS` | 1100 | Max distance any node sits from the start |

## File structure

```
src/core/
  passives.ts      MOD  wider world + spacing constants; scattered cluster table; bend/arc smalls;
                        no-major↔major links; minor↔minor cross-links
  save.ts          MOD  SCHEMA_VERSION 17 → 18; MIGRATIONS[17] prunes a disconnected allocation
  sim.ts           MOD  only if the Surveyor path or passive policy needs a nudge (re-check, not re-design)
tests/
  core/passives.test.ts    MOD  geometry gaps + scattered invariants; no-major↔major invariant;
                                mesh/cycles still hold; bound 500 → 1100
  core/save.test.ts         MOD  an old cross-linked allocation loads and prunes; a minors-reached save is untouched
```

---

### Task 1: Re-space and scatter the geometry (links unchanged)

**Files:** `src/core/passives.ts` (geometry only); test `tests/core/passives.test.ts`.

**Work:** introduce the spacing constants, move `START_X`/`START_Y`, and re-author the `CLUSTERS` table: 36 scattered terminal coordinates (jittered from the old 12-spoke × 3-ring grid, majors ≥ `MAJOR_GAP`, no collinear triples), each with a `bend` control point. `buildWeb()` places smalls along the Bézier at even arc-length steps ≥ `SMALL_GAP` instead of the straight `entry.x + (c.x − entry.x) * t` lerp. Leave `entry` and `cross` exactly as today so this commit changes *only* `x`/`y` — old saves still connect, no schema bump yet.

**Tests:** a geometry test asserts (a) every node is within `MAX_RADIUS` of the start, (b) every pair of adjacent smalls is ≥ `SMALL_GAP`, (c) every pair of majors is ≥ `MAJOR_GAP`, (d) different-cluster nodes are ≥ `CLUSTER_GAP`. Update the existing 500-radius test to `MAX_RADIUS`. All id-stability and connectivity tests stay green unchanged.

**Step order:** snapshot the old coordinates → add constants → re-author the table + Bézier placement → run `npx vitest run tests/core/passives.test.ts` → commit `Space out and scatter the passive web`.

---

### Task 2: The connection policy — no major gates a major

**Files:** `src/core/passives.ts` (links only); test `tests/core/passives.test.ts`.

**Work:** change the link wiring. A terminal keeps only its own last-small link (drop the terminal↔terminal `cross` edges). Re-purpose `cross` to name neighbour clusters whose **first small** this cluster's first small cross-links to, and have `buildWeb()` wire minor↔minor links after all smalls are placed. Keep `entry` (first small → start or another terminal) as the branching mechanism. Add the builder guard: constructing a link between two `notable`/`keystone` nodes throws.

**Tests:** a new invariant test walks every edge and asserts no edge has both endpoints `notable`/`keystone`; a second asserts every major has exactly one link (its own last small). The existing "woven mesh" test still passes (minor cross-links keep `edges.size > nodes.length − 1` and some node with ≥ 3 links); the "whole web connected from start" test still passes; id-stability tests untouched.

**Step order:** write the failing no-major↔major test → rewire the builder → run the test → commit `Stop majors from gatewaying other majors`.

---

### Task 3: The save migration

**Files:** `src/core/save.ts`; test `tests/core/save.test.ts`.

**Work:** bump `SCHEMA_VERSION` to 18 and add `MIGRATIONS[17]` = `prunePassives`. `prunePassives(allocated)` walks the list in order and keeps an id iff its node links to the start or an already-kept id under the new graph (the new `PASSIVE_NODE_BY_ID` is already in scope at load). Everything else is dropped, and the returned points come back automatically.

**Tests:** craft an old save whose allocation reaches a keystone only through a major→major cross-link — after `decodeSave` it loads `ok`, the keystone is pruned, and `pointsToSpend` is one higher. Craft a save that reached the same keystone through its own minors — after load the allocation is unchanged. A save with no passives is byte-identical.

**Step order:** add the failing migration tests → add `MIGRATIONS[17]` → run `npx vitest run tests/core/save.test.ts` → commit `Migrate disconnected passive webs on load`.

---

### Task 4: Sim and UI sanity

**Files:** `src/core/sim.ts` (only if needed); no UI code changes expected.

**Work:** run `npm run balance` and confirm the passive policy still paths to Surveyor and spends the budget over the re-spaced, re-wired graph (the shortest-path helper in `sim.ts` is graph-agnostic, so it should hold; adjust only if the BFS now takes an absurd path). Smoke the web at 1280 × 900 and 390 × 844: `Fit` frames the larger world, the start opens zoomed at scale 1, adjacent nodes no longer overlap at 1×, the 44 px hit circles don't collide, and allocate/stage/refund/search still behave.

**Step order:** run `npm run balance` → browser smoke both widths → commit only if a real sim adjustment is required (`Re-check the sim policy for the re-wired web`), otherwise fold into Task 5.

---

### Task 5: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`, `npm run balance`; confirm the before/after screenshots are recorded and attached in review; confirm an old save with a cross-linked web loads and keeps its points.

**Commit:** `Finish the skill-tree layout rework`.

---

## Definition of done

- The web is decluttered: adjacent smalls ≥ `SMALL_GAP`, majors ≥ `MAJOR_GAP` apart, no straight radial runs; a before/after screenshot is recorded.
- No edge joins two majors; a major is reached only through its own cluster's minors. The invariant is enforced and tested.
- The web is still one connected mesh with cycles (cross-links at the minor level), and every node is within `MAX_RADIUS` of the start.
- Every pre-existing node id still means the same stat; `SCHEMA_VERSION` 18; `MIGRATIONS[17]` prunes a disconnected allocation and returns its points.
- Full suite, typecheck, build and balance are green; nothing pushed.
