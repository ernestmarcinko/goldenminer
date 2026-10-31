# Plan 26: Ascendancy-tree rebalance

**Goal:** Rebalance the ascendancy tree so the big payoff nodes sit in the **middle** of a branch — not stacked only at its tip — and make the major nodes *much* more expensive than the minors. Minors stay at 1 point; majors become a real multi-ascension investment, and the whole tree is re-tuned against the ascendancy points a run actually earns, so a big node is something you save for, not something you pick up as an afterthought.

- **Majors mid-branch.** Today every cluster is a chain of eight 1-point smalls that ends in a 2-point **mid** and a 4-point **big** at the very tip. The mid moves to the middle of the chain (after four smalls), so there is a major node *in the branch*, not only at the end; the big stays the terminal keystone.
- **Minors stay cheap.** Smalls remain 1 point — the cheap filler that fills out a branch — and are the only thing an early level-60 ascension can afford comfortably.
- **Majors get expensive.** The mid rises from 2 to **6** points and the big from 4 to **12** points (3× each). That is the rebalance lever: a single capped run no longer buys the branch tip; it forces the "save points across ascensions" tension the prestige loop is meant to have.
- **Balanced against real income.** The cost curve is justified against `ascendancyPoints(deepest, level, priorAscensions)` at level 60, 80 and 100, grounded in the reference-run simulator's measured depths (see the scenario table).

**Architecture:**

- `src/core/ascendancy.ts` already separates content (`CLUSTERS`) from geometry (`buildTree`) from consumption (`ascendancyTotals`, `allocateAscendancy`). This plan changes **where** the mid is placed (a `midAfter` split per cluster) and **how much** each kind costs (named constants). `allocateAscendancy` and `canAllocateAscendancy` already compare `points >= cost`, so they keep working unchanged once the cost constants move.
- **No schema change.** `AscendancyNode.cost` is already "code, never saved" (the comment on the field says so), and the ascendancy save is just `{ points, allocated }`. Raising the cost constants changes no id and no stored value; old saves load with the same allocated ids and unspent points. `MAX_ASCENDANCY_PASSIVE_POINTS` sums `passivePoints` effects, which are untouched, so it stays 12.
- The balance simulator (`src/core/sim.ts`) is the measurement tool, **not** something this plan changes: its report already yields the anchors the cost curve is tuned against (deepest-at-cap ≈ 15,110 m → 7 depth points, +4 level bonus on the second capped run → 11). The sim never allocates ascendancy nodes, so the new costs don't affect it.
- The UI already renders a node's `cost` through `ascendancyCostLine(node.cost)`; only the hardcoded legend ("mid · 2 points", "big · 4 points") and one comment need updating.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. No schema change.

**Spec:** main design §4.8 (ascension) and §4.9 (pacing/reference player); `2026-10-26-plan-19-ascendancy-tree-expansion.md` (the tree this rebalances) and `2026-10-26-plan-15-level-cap-100.md` (the point formula whose income this is tuned against).

**Builds on:** Plans 15–23 (`dev-ernest`), specifically Plan 19 (the multi-point tree) and Plan 15 (the depth + level-bonus point formula). This is a new plan 26.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. (next plan) · 25. (next plan) · **26. ascendancy-tree rebalance** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`.
- **No schema change.** `SCHEMA_VERSION` stays where Plan 23 left it; `cost` stays a code-only field, never saved. No id is removed, renamed or re-pointed; a pre-change save keeps its allocated ids and unspent points.
- **Costs are honest.** A node is allocatable only when `points >= cost`; the card shows the real cost and greys out when short; allocation subtracts the full cost. The higher numbers flow through the existing `ascendancyCostLine`, so the button and card follow automatically once the legend is fixed.
- **Effects stay put.** This plan changes cost and position, not the bonuses a node grants. The mid/big effect values are unchanged, so `MAX_ASCENDANCY_PASSIVE_POINTS` and every `MAX_*` clamp keep their meaning.
- Phones: the tree still pans/zooms; the moved mid and the cost label read at 1× and zoomed; hit targets ≥ 44 px.
- No new dependencies; full suite, typecheck and build green.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **Majors sit mid-branch.** Every cluster's mid is placed after its `midAfter` smalls (ring `midAfter + 1`), *before* the remaining smalls, and the big is the terminal keystone (last ring). A test asserts the mid's ring is strictly between the first small and the big, not at the tip.
2. **The cost curve is 1 / 6 / 12.** Smalls cost 1, mids 6, bigs 12; a test pins each kind's cost and the allocation/grey-out behaviour at the new numbers (1 point can't buy a mid, 11 can't buy a big).
3. **The balance is measured, not guessed.** The scenario table below is reproduced from `runReference({ seed: 12345, days: 24 })` anchors (15,110 m at cap → 7 depth points; +4 second-run bonus → 11), and the cost curve is argued against it. The full-tree clear count (208 points) is stated and reviewed.
4. **Old saves load.** A pre-change ascendancy save loads with the same allocated ids and points; a test allocates an old-style chain and asserts it stays a connected, allocated set under the new links.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Node kinds & cost | `small` **1** (unchanged), `mid` **6** (was 2), `big` **12** (was 4). `start` stays free. Both majors are 3× their old cost — the "way higher" the owner asked for — and the small→mid gap (1 → 6) is larger than the mid→big gap (6 → 12), so a mid is the first real save-up, a big the long chase. |
| Cost constants | `ASCENDANCY_SMALL_COST = 1`, `ASCENDANCY_MID_COST = 6`, `ASCENDANCY_BIG_COST = 12` in `src/core/balance.ts`, beside `ASCEND_DEPTH_PER_POINT` / `ASCEND_LEVEL` / `ASCEND_LEVEL_STEP`, so every ascendancy balance knob lives in one file. `ascendancy.ts` imports them. |
| Mid-branch layout | Each cluster gains a `midAfter: number` (default 4): the branch is `small ×4 → mid → small ×4 → big`. The mid moves from the tip (ring 9) to ring 5; the remaining smalls (rings 6–9) continue from the mid; the big stays at ring 10. Node count and ids are unchanged (81 nodes: 1 start, 64 smalls, 8 mids, 8 bigs). |
| Legacy saves | The `legacySmalls` backward link stays. The mid keeps its link to the last pre-expansion small, so an old save's chain (which reached the notable down the old spine) is still a connected, allocated set — the extra edge is harmless because `canAllocateAscendancy` needs *any* allocated neighbour. New clusters (`might`, `greed`) have none, as today. |
| Effects | Unchanged. The rebalance is cost- and position-only; a costlier node is not also a bigger node. If review wants majors to *feel* worth 6/12, that is a follow-up, not this plan. |
| Full-tree cost | 8 clusters × (8 smalls + 1 mid + 1 big) = 8 × (8 + 6 + 12) = **208 points** to clear the tree. At ~11 points per capped second-ascension that is ≈ 19 capped runs; at ~4 points per early level-60 ascension ≈ 52. Deliberately long-term for an incremental game. |

### Scenario table (the balance math)

The cost curve is argued against the points `ascendancyPoints(deepest, level, priorAscensions)` really pays. Depth term = `floor(sqrt(deepest / 250))`; level bonus = `floor((level − 60) / 10)` from the second ascension on. Deepest-at-cap 15,110 m is the simulator's measured value; the level-60 and level-80 depths are the tuned early-run depths.

| Scenario | deepest (m) | level | prior asc | depth term | level bonus | **points** |
|---|---|---|---|---|---|---|
| Early first ascension at 60 | 2,250 | 60 | 0 | 3 | 0 | **3** |
| Typical first ascension at 60 | 4,587 | 60 | 0 | 4 | 0 | **4** |
| Second ascension at 60 | 4,587 | 60 | 1 | 4 | 0 | **4** |
| Ascension at 80 (2nd+) | 9,000 | 80 | 1 | 6 | 2 | **8** |
| First ascension at 100 | 15,110 | 100 | 0 | 7 | 0 | **7** |
| Second ascension at 100 | 15,110 | 100 | 1 | 7 | 4 | **11** |

What one ascension buys, against the 1 / 6 / 12 curve:

| Points this run | Buys |
|---|---|
| 3–4 (level 60) | 3–4 smalls — a mid (6) is out of reach, so early runs fill the branch, exactly as intended. |
| 7–8 (level 80–100, first) | one mid (6) + 1–2 smalls — the first mid-branch payoff lands on the run that pushed past 80. |
| 11 (level 100, second) | a big (12) is **just out of reach** — one capped run leaves you one point short, forcing the "carry a point over" tension the owner wants; or a mid + 5 smalls. |

The key balance claim: a **big (12)** is priced one point past a single fully-capped second ascension (11), so the keystone is always a *planned* purchase across runs, never an accidental spend; a **mid (6)** is priced at about half a capped run, so the middle of a branch is a meaningful stop rather than a speed bump.

## File structure

```
src/core/
  balance.ts       MOD  ASCENDANCY_SMALL_COST = 1, ASCENDANCY_MID_COST = 6, ASCENDANCY_BIG_COST = 12
  ascendancy.ts    MOD  import the cost constants; ClusterDef.midAfter; buildTree places the mid
                        mid-branch (ring midAfter + 1) and the big at the tip; links rebuilt around the split
src/ui/
  ascend/AscensionView.tsx MOD  the legend: "mid · 6 points", "big · 12 points"
  skills/skillsView.ts     MOD  the "1/2/4 on the ascendancy tree" comment → 1/6/12
tests/
  core/ascendancy.test.ts  MOD  cost assertions (6/12), the mid-branch position test, the full-tree
                                cost (208), and the old-save-connected test
```

---

### Task 1: The cost constants and the honest multi-point spend

**Files:** `src/core/balance.ts`, `src/core/ascendancy.ts`; test `tests/core/ascendancy.test.ts`.

**Interfaces:**
- `balance.ts`: `ASCENDANCY_SMALL_COST = 1`, `ASCENDANCY_MID_COST = 6`, `ASCENDANCY_BIG_COST = 12`.
- `ascendancy.ts`: `buildTree` uses the constants instead of the hardcoded `1`/`2`/`4` (small stays `ASCENDANCY_SMALL_COST`, mid `ASCENDANCY_MID_COST`, big `ASCENDANCY_BIG_COST`). No change to `allocateAscendancy`/`canAllocateAscendancy` — they already test `points >= cost`.

**Tests:** every node's cost follows its kind (0 / 1 / 6 / 12); a mid with 5 points is refused and a big with 11 is refused (both change nothing), a mid with 6 and a big with 12 spend the full amount; old ids still cost 1 for smalls and 6 for the former notables.

**Step order:** update the cost assertions first (they'll fail) → add the constants → wire `buildTree` → `npx vitest run tests/core/ascendancy.test.ts` → commit `Price ascendancy majors at 6 and 12`.

---

### Task 2: Majors mid-branch

**Files:** `src/core/ascendancy.ts`; test `tests/core/ascendancy.test.ts`.

**Work:** add `midAfter: number` to `ClusterDef` (default 4). `buildTree` emits the first `midAfter` smalls (rings 1..`midAfter`), then the mid (ring `midAfter + 1`, linked to the last of those smalls), then the remaining smalls (rings `midAfter + 2`..9, the first linked to the mid), then the big (ring 10, linked to the last small). The mid keeps its `legacySmalls` backward link so old saves stay connected; the symmetric-link pass already makes that edge bidirectional. The mid's `links` gains the small immediately before it; it no longer links to the final small (the big does).

**Tests:** every cluster's mid has a ring strictly between its first small and its big (mid-branch, not the tip); the big remains the last ring; node count is still 81 with kinds `{ start: 1, small: 64, mid: 8, big: 8 }`; an old-style allocated chain (start → smalls → mid → big) is still a connected set of ids under the new links.

**Step order:** write the position tests → add `midAfter` and rework the geometry → `npx vitest run tests/core/ascendancy.test.ts` → commit `Move the ascendancy mids into the middle of each branch`.

---

### Task 3: The legend and the comment

**Files:** `src/ui/ascend/AscensionView.tsx`, `src/ui/skills/skillsView.ts`.

**Work:** the legend in `AscensionView.tsx` reads `mid · 6 points` and `big · 12 points` (the small line stays `small · 1 point`); the `skillsView.ts` comment about the ascendancy tree's cost becomes "1/6/12". The card and button already call `ascendancyCostLine(node.cost)`, so they follow the constants with no further change.

**Checks:** `npm run build`; a 1280×900 and 390×844 smoke of the Ascend tab — allocate a small (1), hover a mid (6) and a big (12), confirm the points subtract correctly and the card greys out when short.

**Step order:** legend + comment → build → browser check → commit `Show the rebalanced ascendancy costs`.

---

### Task 4: Final QA

**Checks:** `npm test`, `npm run balance`, `npm run typecheck`, `npm run build`; confirm the scenario table is reproduced from the reference run (15,110 m → 7 / 11 points) and the 1 / 6 / 12 curve holds against it; confirm an old ascendancy save loads with its ids and points intact.

**Commit:** `Finish the ascendancy rebalance`.

---

## Definition of done

- Every cluster's **mid** node sits in the middle of its branch (ring `midAfter + 1`, before the remaining smalls) and the **big** is the terminal keystone; node count and ids are unchanged.
- The cost curve is **small 1 / mid 6 / big 12** (`ASCENDANCY_*_COST` in `balance.ts`), and allocation/grey-out honours it honestly; the legend and any comment read 1/6/12.
- The balance is argued and documented against the reference run's measured income (3–4 points at level 60, 7–8 at 80–100 first ascension, 11 at a capped second ascension), with a full-tree clear of 208 points.
- Old saves load with no migration; `MAX_ASCENDANCY_PASSIVE_POINTS` stays 12; effects are unchanged.
- Full suite, typecheck and build are green; no new dependency; nothing pushed.
