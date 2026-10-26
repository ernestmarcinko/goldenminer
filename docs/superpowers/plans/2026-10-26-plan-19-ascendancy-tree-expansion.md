# Plan 19: The ascendancy tree expansion

**Goal:** Grow the ascendancy tree from six short radial chains into a proper progression tree with **mid** and **big** nodes that cost more than one point. Bigger nodes give bigger permanent effects, so each subsequent, bigger ascension reaches the endgame faster — which keeps the player going deeper and reaching higher tiers.

- **More nodes.** The tree grows from ~30 nodes to ~80+, arranged in more clusters, each ending in a **mid** notable (2 points) and a **big** keystone (4 points) instead of a single 1-point notable.
- **Multi-point nodes.** A node has a `cost`. Smalls cost 1, mids 2, bigs 4. Allocation subtracts the cost; a node is only allocatable when the player holds that many unspent points.
- **Faster endgame.** Big nodes carry the large permanent bonuses — much bigger starting depth, more passive points, more auto-map tiers, and larger yield/find — so the run after a big ascension starts deeper, earns faster and reaches the tier frontier sooner.
- **The loop.** Each ascension pays more points (Plan 15's level bonus + deeper depth), which buys bigger nodes, which make the next run faster — a self-accelerating prestige loop that is gated by how many points the player can save.

**Architecture:**

- `src/core/ascendancy.ts` already separates content (`CLUSTERS`) from geometry (`buildTree`) from consumption (`ascendancyTotals`, `allocateAscendancy`). This plan grows the content and adds a `cost` per node; the geometry and consumption stay, with `allocateAscendancy` subtracting `cost` instead of 1.
- **No schema change.** The ascendancy save is `{ points, allocated }` — unspent points and an id list. A node's cost lives in code, so old saves stay valid (their old ids all cost 1; the new nodes are new ids). `MAX_ASCENDANCY_PASSIVE_POINTS` recomputes from the new tree.
- The ascendancy web already renders `kind` (`start`/`notable`/`small`) into frames; it gains `mid`/`big` frames and a cost label on each node.

**Tech stack:** unchanged. No new dependencies. **No schema change.**

**Spec:** main design §4.8 (ascension); `2026-10-26-plan-12-auto-mapping-ascension.md` (the tree this replaces) and Plan 15 (the level bonus that feeds it).

**Builds on:** Plan 15 (`dev-ernest`).

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · **19. ascendancy tree expansion** (this plan) · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24. start screen · 25. skill-tree layout · 26. ascendancy-tree rebalance · 27. crafting rebalance · 28. mining animation · 29. ascendancy icons · 30. damage types and resistances · 31. unified equipment.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM.
- **No schema change.** Old ascendancy saves load; their allocated ids are still valid and still cost 1. New nodes are new ids; no id is removed or re-pointed.
- **Costs are honest.** A node is allocatable only when `points >= cost`; the card shows the cost and greys out when short; allocation subtracts the full cost.
- **Effects stay clamped** to the same `MAX_*` bounds the passive web and gear obey.
- Phones: the tree still pans/zooms; the cost label and mid/big frames read at 1× and when zoomed; hit targets ≥ 44 px.
- No new dependencies; full suite, typecheck and build green.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **Multi-point allocation works.** Spending a mid/big node subtracts 2/4 points, refuses when short, and the card shows the cost.
2. **The tree is genuinely bigger.** ~80+ nodes across more clusters; every cluster ends in a mid and a big, not just a notable.
3. **Big nodes accelerate.** A test allocates a big starting-depth node and asserts the next run starts substantially deeper; a big auto-map node raises the auto-map frontier.
4. **Old saves load.** A pre-change ascendancy save loads with the same allocated ids and points; `MAX_ASCENDANCY_PASSIVE_POINTS` reflects the new tree.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Node kinds | `small` (1 point), `mid` (2 points, the former "notable"), `big` (4 points, the new keystone-grade). The `start` stays free. |
| Cost field | `AscendancyNode.cost: 1 | 2 | 4`; `allocateAscendancy` checks `points >= cost` and subtracts it; `canAllocateAscendancy` requires `points >= cost`. |
| Tree growth | Eight clusters (add **Might** — damage/life; **Greed** — gold/diamond/vein yield). Each cluster: 4–6 smalls (1 pt) → 1 mid (2 pt) → 1 big (4 pt). Total ~80 nodes. |
| Big-node effects | Big nodes carry the large permanent bonuses: `startingDepth +250`, `passivePoints +3`, `autoMapTier +4`, `find +25` (chest/gem/map together), `veinYield +25`, `oreFind +25`, or a stat bundle of similar weight. Mids carry the medium versions; smalls stay single stats. |
| Deeper, higher tiers | Starting depth is the lever: deeper start = higher item/map tier from the first metre, so "reaching higher tiers" falls out of `startingDepth` plus the yield/find/auto-map boosts — no new mechanic. |
| Frames/icons | The ascendancy frame already exists; `mid` reuses the notable frame and `big` reuses the keystone frame (or a wider ascendancy variant), with the cost shown under the name. |
| Save | No migration; the `allocated`/`points` shape is unchanged. |

## File structure

```
src/core/
  ascendancy.ts      MOD  cost field, eight clusters, mid/big nodes, bigger effects
  skillIcons.ts      MOD  icons for the new notables/keystones (reuse stat/structural glyphs)
src/ui/ascend/
  ascensionView.ts   MOD  cost label; the "N points" allocatable check
  AscensionView.tsx  MOD  "Allocate · N points"; mid/big frames
  ascend.css         MOD  the cost label and frame sizes
tests/
  core/ascendancy.test.ts  MOD  costs, multi-point allocation, bigger effects, save stability
  ui/skillsView.test.ts    MOD  the ascendancy VM carries a cost
```

---

### Task 1: Multi-point nodes

**Files:** `src/core/ascendancy.ts`; test `tests/core/ascendancy.test.ts`.

**Interfaces:** `AscendancyKind` gains `'mid' | 'big'`; `AscendancyNode.cost: number`. `allocateAscendancy` returns `'noPoints'` when `points < cost` and subtracts `cost`; `canAllocateAscendancy` checks `points >= cost`. `MAX_ASCENDANCY_PASSIVE_POINTS` still sums the `passivePoints` effects.

**Tests:** allocating a 2-point node with 1 point is refused and changes nothing; allocating with 2 spends 2; the allocated list is unchanged in shape; old ids still cost 1.

**Step order:** write tests → add `cost` and the check → commit `Give ascendancy nodes a point cost`.

---

### Task 2: The bigger tree

**Files:** `src/core/ascendancy.ts`; test `tests/core/ascendancy.test.ts`.

**Work:** rewrite `CLUSTERS` to eight clusters with smalls → mid → big, and the bigger effect values from the decisions. Keep the geometry builder; it already walks the cluster's smalls then its terminal node, so it needs to emit two terminal nodes (mid then big) per cluster.

**Tests:** node count ≥ 80; every cluster ends in a mid and a big; the big effects are the large versions; `MAX_ASCENDANCY_PASSIVE_POINTS` reflects the new tree.

**Step order:** write the count/effect tests → the clusters → commit `Expand the ascendancy tree`.

---

### Task 3: Icons, frames and the cost label

**Files:** `src/core/skillIcons.ts`, `src/ui/ascend/ascensionView.ts`, `AscensionView.tsx`, `ascend.css`; test `tests/ui/skillsView.test.ts`.

**Work:** add glyphs for the new named nodes (or reuse stat/structural glyphs), map `mid`/`big` to the notable/keystone frames, and show each node's cost ("1 point", "2 points", "4 points") under its name in the card and on the web. The allocatable check and the button label use the cost.

**Tests:** the ascendancy VM carries a cost; the new node ids resolve to glyphs and frames.

**Step order:** glyphs → VM cost → frames/labels → CSS → commit `Draw the bigger ascendancy nodes`.

---

### Task 4: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`; a 1280×900 and 390×844 smoke of the Ascend tab (allocate a small, a mid, a big; confirm the points subtract and the gate greys out); confirm an old ascendancy save loads.

**Commit:** `Finish the ascendancy tree expansion`.

---

## Definition of done

- The ascendancy tree has ~80 nodes in eight clusters, each ending in a 2-point mid and a 4-point big.
- Multi-point allocation works and is reflected in the UI; old saves load with no migration.
- Big nodes carry the large permanent bonuses (starting depth, passive points, auto-map tiers, yield/find) so a bigger ascension reaches the endgame faster.
- Full suite, typecheck and build are green; nothing pushed.
