# Plan 29: Ascendancy group icons

**Goal:** Replace the ascendancy tree's per-small stat glyphs with a single, distinctive **group icon per cluster**, drawn in eight escalating **tier variations** (Cookie Clicker style), give the unique mid/big ascendancies their own custom icons, and make hovering any node tell you what it does.

- **Group identity.** Today the eight clusters are divided nicely, but a small node shows its *raw stat glyph* (`goldYield` coin, `startingDepth` arrow, `passivePoints` plus …), so one cluster mixes several glyphs (greed shows `veinYield` + `oreFind` + `goldYield` + `diamondYield`) while unrelated clusters share a glyph. This plan unifies each cluster under one icon family: **wealth** a coin hoard, **depth** a downward shaft, **insight** an eye, **cartography** a map, **endurance** an hourglass, **fortuna** a clover, **might** crossed blades, **greed** a gem vein.
- **Variations.** Within a cluster the eight smalls read as one family but are distinct: each is the group's base glyph with 1–8 of its "slots" filled (1–8 coins, depth notches, eye rays, map pins, sand levels, clover leaves, blades, gems), so the chain visibly escalates outward toward the mid/big. The stat itself stops being the picture and moves into the tooltip.
- **Unique ascendancies.** The sixteen mid/big nodes (`midasTouch` … `elDorado`) keep their existing custom glyphs, refined to read as the cluster's pinnacle (the mid a moderate form, the big a crowned/enhanced form). The start stays `minerReborn`.
- **Tooltips.** Hovering a node already floats its card (name, effect line, description, allocate button). This plan makes the icon's own `<title>` describe the node too (`name — effect`), so the hover always says what the ascendancy is about even before the card is read.

**Architecture:**

- **Pure core first.** The group→icon mapping and the variation compositing live in `src/core/skillIcons.ts`, the same hand-drawn kit as Plan 14: 16 × 16 ASCII glyphs, a 24 × 24 frame, `composeIcon`. No React or DOM. `src/core/ascendancy.ts` gains only an explicit `group` field so the mapping never parses ids.
- **One new field, one new lookup.** `AscendancyNode` gains `group: AscendancyGroupId` (populated in `buildTree` from the cluster's `prefix`). `iconForAscendancy(node)` becomes: `start → minerReborn`; `mid`/`big → node.id` (the unique glyph); `small → group<Prefix><variation>` (the cluster's base glyph with the small's 1-based slot count).
- **Eight bases, sixty-four registrations.** The builder hand-draws **eight** 16 × 16 base glyphs, each with eight built-in "slots". A tiny painter fills the first *n* slots for variation *n*, and the 64 results are registered in `ICON_GLYPHS` as `wealth1 … greed8` — so `composeIcon` and `knownGlyph` are untouched and every id stays unit-testable, with no 64 hand-authored grids.
- **Frames and rendering stay put.** Small/mid/big keep the `small`/`notable`/`keystone` frames; the start keeps `start`; the side stays `ascendancy`. The web and the card are unchanged except for the richer `<title>`.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. **No schema change, no save change** (a node's icon is code, never saved).

**Spec:** main design §4.8 (ascension, "a smaller web of ~40 nodes" → the eight clusters); Plan 14 (`src/core/skillIcons.ts`, the icon kit and `Web`/`AscensionView` rendering) and Plan 19 (the eight-cluster tree and its mid/big nodes).

**Builds on:** Plan 14 (the icon kit and its `Web`/`AscensionView` rendering) and Plan 19 (the eight-cluster tree with mid/big nodes), `dev-ernest` at `a0aa114`.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · 24–28. the owner's follow-up plans · **29. ascendancy group icons** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM. The group mapping and the variation painter compose grids; the UI alone turns them into data URIs.
- **Pixel art only:** integer scales, `image-rendering: pixelated`, no gradients or anti-aliased icons. Every group glyph is a grid of palette letters; unknown letters are transparent.
- **Same method as Plan 14:** `glyph`/`glyph12`/`paint` for the bases and the slot fill; `composeIcon` unchanged; the frame carries the accent, the glyph stays bone/steel/gold/wood/blood so dim nodes read.
- **No schema change, no save change.** Icons and tooltips only. `SCHEMA_VERSION` untouched.
- **Tests stay green.** Every Plan 1–23 test keeps passing; the icon mapping/composition test is extended, not weakened.
- **Readability first:** the eight clusters stay visually distinct at 1× and when dim/allocated; hit targets stay ≥ 44 px; the tooltip never hides a state cue.
- Phones: the Ascend tab re-checked at 390 × 844; the group icons read at the fitted and zoomed views.
- Git: work on `dev-ernest`; explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **Every small resolves to its group's variation.** A test walks all 64 small nodes and asserts each maps to `group<Prefix><1..8>` — one family per cluster, eight distinct variations, none falling back to a stat glyph.
2. **The groups are genuinely distinct.** Eight hand-drawn base glyphs (coin hoard, shaft, eye, map, hourglass, clover, blades, gem vein), each with eight slots; the variation painter fills the first *n*. The 64 registrations are rectangular, on-grid, and throw on an off-canvas pixel.
3. **Unique ascendancies keep their own icons.** The 16 mid/big nodes resolve to their own ids (`midasTouch` … `elDorado`), never a group glyph; the start resolves to `minerReborn`.
4. **Hover explains the node.** The web `<title>` is `name — effect line` (and the description for mid/big); the floating card still shows the full name, cost, effect and description. Nothing regressed in the card, the allocate button, or the 44 px hit target.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Group identity source | Add `AscendancyGroupId = 'wealth' \| 'depth' \| 'insight' \| 'cartography' \| 'endurance' \| 'fortuna' \| 'might' \| 'greed'` and an `AscendancyNode.group` field set in `buildTree` from `cluster.prefix`. No id parsing. |
| Small-node icon | A small shows its cluster's group glyph at its slot tier: `iconForAscendancy(small)` → `group<Prefix><1..8>`. The raw stat glyph is dropped from the web (the stat lives in the tooltip/card). |
| Variation scheme | The base glyph has eight built-in "slots"; variation *n* fills the first *n*. Slots per group: wealth = coins, depth = depth notches, insight = eye rays, cartography = map pins, endurance = sand levels, fortuna = clover leaves, might = blades, greed = gems. Cookie Clicker-style escalation outward toward the mid/big. |
| Registry | Register all 64 `group<Prefix><n>` grids in `ICON_GLYPHS` (computed, not hand-drawn individually). `composeIcon`/`knownGlyph` signatures stay; the union type gains the 64 ids. |
| Unique nodes | The 16 mid/big glyphs are kept and lightly refined to read as the cluster's pinnacle (mid moderate, big crowned). They map by their own id, unchanged. |
| Tooltip | The web node's `<title>` becomes `name — line` (plus `desc` when it differs) via a new `SkillNodeVM.tip` (or composed in `Web`). The hover card is unchanged and remains the full detail. |
| Frames / palette | No new frame, no new palette letters. Small/mid/big reuse `small`/`notable`/`keystone`; side stays `ascendancy`; group glyphs use the existing gold/bone/steel letters. |
| Scope order | Core mapping and field first, then the glyphs/variations, then the tooltip; the three are file-disjoint enough to build in sequence. |

## Icon vocabulary

Eight group families, each a hand-drawn base glyph with eight slots; the mid and big keep their unique glyphs. The start is `minerReborn`.

| Cluster | Theme | Base glyph (8 slots) | Variations (1→8) | Mid (unique) | Big (unique) |
|---|---|---|---|---|---|
| wealth | hoard | coin stack | 1→8 coins | `midasTouch` | `goldRush` |
| depth | the deep | downward shaft/drill | 1→8 depth notches | `deepRoots` | `worldCore` |
| insight | vision | eye | 1→8 rays | `secondSight` | `thirdEye` |
| cartography | mapping | map | 1→8 pins | `masterSurveyor` | `worldAtlas` |
| endurance | time | hourglass | 1→8 sand levels | `tireless` | `perpetualMotion` |
| fortuna | luck | clover | 1→8 leaves | `luckyBreak` | `jackpot` |
| might | combat | crossed blades | 1→8 blades | `gladiator` | `colossus` |
| greed | ore | gem vein | 1→8 gems | `deepVeins` | `elDorado` |

Reuse where the art already matches: the group bases lean on the existing glyphs (`goldYield` coin, `startingDepth` arrow, `secondSight` eye, `mapFind`/`cartographer` map, `offlineCap`/`tireless` hourglass, `luckyBreak`/`prospectorsLuck` clover, `damage` blade, `veinYield`/`deepVeins` gems), redrawn with eight slots. The sixteen unique glyphs already exist in the kit; the builder refines them to read as pinnacle forms rather than redrawing from scratch.

**Sample slots** (16 × 16, kit style; the builder may refine the art) — a coin hoard at 3 and 8 slots:

```
wealth3                       wealth8
................             ................
.....kkkkkk.....             .....kkkkkk.....
....kGgggggk....             ....kGgggggk....
...kGgggggggk...             ...kGgggggggk...
..kGggkkkkgggk..             ..kGggkkkkgggk..
..kGgkggggkggk..             ..kGgkggggkggk..
..kGgkggggkggk..             ..kGgkggggkggk..
..kGgkggggkggk..             ..kGgkggggkggk..
..kGggkkkkgggk..             ..kGggkkkkgggk..
...kGgggggggk...             ...kGgggggggk...
..kGGggggggGGk..             ..kGGggggggGGk..
.kGGGggggggGGGk.             .kGGGggggggGGGk.
.kGGGGGGGGGGGGk.             .kGGGGGGGGGGGGk.
................             .kGGGGGGGGGGGGk.
................             .kkkkkkkkkkkkkk.
................             ................
```

A frame is drawn around the glyph by the composer, so the glyph grid never draws its own border.

## File structure

```
src/core/
  ascendancy.ts     MOD  AscendancyGroupId; `group` field on AscendancyNode, set in buildTree
  skillIcons.ts     MOD  group glyph ids + 8 base grids + the slot painter; 64 registered
                         variations; iconForAscendancy maps small→group variation, mid/big→own id
src/ui/
  skills/skillsView.ts     MOD  SkillNodeVM gains `tip` (name — effect, plus desc)
  ascend/ascensionView.ts  MOD  fill the ascendancy VM's `tip`
  skills/Web.tsx           MOD  `<title>{n.tip}</title>` instead of the bare name
  ascend/AscensionView.tsx MOD  (verify the card already shows name/effect/desc; no change expected)
tests/
  core/skillIcons.test.ts   MOD  group mapping, 8×8 distinct variations, unique ids, bounds
  core/ascendancy.test.ts   MOD  every node carries the right group
  ui/skillsView.test.ts     MOD  the VM carries a tip
```

---

### Task 1: The group field and the mapping

**Files:** `src/core/ascendancy.ts`, `src/core/skillIcons.ts`; test `tests/core/ascendancy.test.ts`.

**Interfaces:**
- `export type AscendancyGroupId = 'wealth' | 'depth' | 'insight' | 'cartography' | 'endurance' | 'fortuna' | 'might' | 'greed';`
- `AscendancyNode` gains `group: AscendancyGroupId` (filled from `cluster.prefix` for every cluster node). The `start` has no cluster: make the field optional (`group?: AscendancyGroupId`) and leave it unset there, or give it a `'start'` sentinel — the builder's call, but it is never used by the mapping because the start maps straight to `minerReborn`.
- `iconForAscendancy(node)` becomes: `start → 'minerReborn'`; `mid`/`big → knownGlyph(node.id)`; `small → 'group' + capitalize(node.group) + variation` where `variation` is the small's 1-based slot count (already `ring`, 1–8).

**Tests:** every small node carries its cluster's `group` and a variation 1–8; every mid/big carries its cluster's `group` but maps to its own id; the start maps to `minerReborn`. The mapping table (8 × 8) is pinned: `wealthSmall1 → groupWealth1`, …, `greedSmall8 → groupGreed8`.

**Step order:** add `group` to the node and fill it in `buildTree` → extend `iconForAscendancy` (the 64 ids do not need to exist yet; the mapping test can assert the returned string) → run `npx vitest run tests/core/ascendancy.test.ts` → commit `Group ascendancy smalls by cluster`.

---

### Task 2: The group glyphs and variations

**Files:** `src/core/skillIcons.ts`; test `tests/core/skillIcons.test.ts`.

**Interfaces:**
- Eight base glyphs (16 × 16, `glyph12` with a two-pixel margin, reusing the existing letters), each with eight built-in "slots".
- A `groupGlyph(base, n)` (or an equivalent `paint` step) fills the first *n* slots, producing the variation grid.
- Register `wealth1 … greed8` (64 ids) in `ICON_GLYPHS` and add them to the `IconGlyphId` union; `knownGlyph` and `composeIcon` stay unchanged.

**Tests:**
- The 64 ids are present and each is a valid 16 × 16 grid; every non-`.` letter exists in `ICON_PALETTE`.
- Distinctness: `wealth1 ≠ wealth2 ≠ … ≠ wealth8`, and each group's base differs from the other seven groups.
- The slot fill is monotonic (variation *n* contains every slot of *n−1* plus one more).
- `composeIcon('small', 'groupWealth3', 'ascendancy')` yields a 24 × 24 grid and never throws.

**Step order:** author the eight base grids → the slot painter → register the 64 → run `npx vitest run tests/core/skillIcons.test.ts` → commit `Draw the eight ascendancy group icons and their variations`.

---

### Task 3: Tooltips

**Files:** `src/ui/skills/skillsView.ts`, `src/ui/ascend/ascensionView.ts`, `src/ui/skills/Web.tsx`; test `tests/ui/skillsView.test.ts`.

**Interfaces:**
- `SkillNodeVM` gains `tip: string` — `name — line`, plus the `desc` when it differs (for mid/big). The passive web sets it from `effectLine`; the ascendancy web from `nodeLine`.
- `Web.tsx` renders `<title>{n.tip}</title>` instead of `{n.name}`. The floating card (`renderCard`) is unchanged and remains the full detail.

**Tests:** the VM carries a `tip`; for a mid/big it contains the name and the effect; the title/tip is non-empty for every node.

**Step order:** add `tip` to the VM builders → `<title>` in `Web` → run `npm test` → commit `Explain each ascendancy node on hover`.

---

### Task 4: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`; a 1280 × 900 and 390 × 844 smoke of the Ascend tab (the eight groups read as distinct families, the variations escalate, hover shows the tooltip and the card, allocate a small/mid/big); confirm an old ascendancy save loads and its icons render.

**Commit:** `Finish the ascendancy group icons`.

---

## Definition of done

- The eight ascendancy clusters each read as one icon family: a unique base glyph with eight escalating variations; no small node shows a raw stat glyph.
- The sixteen mid/big ascendancies keep their custom icons; the start stays `minerReborn`.
- Hovering any node shows what it does — the icon's tooltip (`name — effect`) and the existing card.
- The icon kit stays pure core: `composeIcon`/`knownGlyph` unchanged, the 64 variations composed from eight bases, all unit-tested and on-grid.
- Full suite, typecheck and build are green; no schema/save change; nothing pushed.
