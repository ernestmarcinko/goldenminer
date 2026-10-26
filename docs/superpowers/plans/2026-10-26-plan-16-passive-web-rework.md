# Plan 16: The passive-web rework — POE2 shape, more nodes, round icons

**Goal:** Rebuild the passive skill tree so it reads like a Path of Exile web instead of a ring of long spokes, fill the new level-100 point budget with more nodes, and add keystones that change how the game plays rather than just adding numbers. At the same time, make the node icons round (the owner's correction to Plan 14's square gothic frames).

- **Shape.** The current web is 12 straight radial spokes; each chain is a long line from the miner outward, which is what reads as "weird long lines". This plan replaces the spoke layout with a cluster/mesh layout: groups of related smalls around a notable or keystone, arranged at hand-tuned coordinates, connected by short edges and cross-links so the whole thing is a woven web, not a star. Straight SVG edges stay (POE uses straight edges); what changes is where the nodes sit and how they link.
- **More nodes.** The budget rises from 59 to 99 points per run (Plan 15). The tree grows from ~141 nodes toward ~200 so a run can spend 99 points and still leave meaningful choices. Most of the growth is smalls, plus a handful of notables.
- **More keystones.** From 8 keystones to 14. Each new keystone changes a rule with a downside, wired into the real systems (digging, combat, maps, crafting, Souls), not just a stat line.
- **Round icons.** The 24×24 icon *frames* become circular (the corner pixels of the frame are cut to a circle), and the web's square halo becomes a circle. Glyphs and the palette are unchanged.

**Architecture:**

- The tree is **pure core** (`src/core/passives.ts`). It already separates content (the `n` specs and the `SMALL_BUDGET`) from geometry (`CHAINS`, `buildWeb`, `pointX`/`pointY`) and from consumption (`passiveTotals`, `hasKeystone`). This plan replaces the geometry and grows the content; consumption is untouched except for the new keystones.
- **Node id stability is the hard constraint.** The web is saved as an `allocated: string[]` of node ids. Existing ids (`miner`, the keystone ids, the notable ids, and the `<side>Small<N>` ids) must keep meaning the same stat, so old saves stay valid with **no migration**. The builder keeps the `SMALL_BUDGET` expansion order, so `miningSmall1`, `battleSmall1`, `hybridSmall1` … keep their current stats; new smalls append with new ids.
- **Keystone effects** follow the existing pattern: `hasKeystone(state, id)` is checked in `stats.ts`/`battle.ts`/`dig.ts`/`maps.ts`/`crafting.ts`/`combat.ts`, exactly as Earthshaker/Berserker/Cartographer are today.
- **Round icons** are a rendering + frame change only: `src/core/skillIcons.ts` (circular frames) and `src/ui/skills/Web.tsx` (a `<circle>` halo instead of the square `<rect>`), plus the card/legend CSS.

**Tech stack:** unchanged. No new dependencies. **No schema change** (node ids are stable; keystones are code, not data).

**Spec:** `2026-10-26-plan-11-passive-web.md` (the tree this replaces) and `2026-10-26-plan-14-skill-icons-and-gothic-ui.md` (the icon kit whose frames go round); main design §4 (the passive web and keystones).

**Builds on:** Plan 15 (`dev-ernest`).

**Roadmap:** 15. level cap 100 · **16. the passive-web rework** (this plan) · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM.
- **Node-id stability:** no existing node id may be removed, renamed, or re-pointed to a different stat. Old saves must load with no migration (`SCHEMA_VERSION` stays 12). New keystones are new ids.
- **Keystones are real rules with downsides**, wired into the systems, unit-tested for their effect, not just described.
- **The icon kit stays pure and tested:** every node still resolves to a glyph and a (now round) frame; no node falls back to a bare circle drawn by CSS.
- **Readability first:** the web still pans/zooms, search still works, and the states (allocated, allocatable, staged, refunding) stay clear. Hit targets stay ≥ 44 px.
- Phones: the web re-checked at 390 × 844; the round icons read at 1× and when zoomed.
- No new dependencies. Tests stay green; the full suite, typecheck and build pass.
- Git: work on `dev-ernest`; explicit paths; short imperative commits; no attribution; never push.

## Review Focus

1. **It looks like a web, not a star.** The fitted view shows clusters with short edges and cross-links; no single chain runs straight for 12+ rings. A before/after screenshot is attached in review.
2. **Every existing id still means the same stat.** A test walks the pre-change `PASSIVE_NODES` mapping and asserts the new tree preserves id→stat for every old id.
3. **The new keystones actually fire.** Each new keystone has a focused test (e.g. the ore-find keystone changes a material vein draw; the crit keystone changes a damage roll).
4. **Icons are round.** The frames are circular in the kit, the web halo is a circle, and the card/legend show the round frame. A `grep` shows no square `gm-web__halo` rect remains.
5. **Nothing regressed.** Allocation, staging, refunds, the refund/reset pricing, search, and the balance sim's passive policy all still behave.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Layout engine | Replace `CHAINS`/angle+ring spokes with a hand-authored **cluster table**: each cluster has a centre coordinate, a list of smalls (drawn from the same `SMALL_BUDGET` expansion), and a terminal notable or keystone. Links are explicit (`links` per node), with cross-links between neighbouring clusters to weave the web. Coordinates are hand-tuned once, in the file, not computed from a formula. |
| Node count | ~160 smalls (was 115), 8→14 keystones, ~22 notables (was 17). Total ~200 nodes. The 99-point budget still leaves most of the tree unspent per run. |
| Small-id stability | The `SMALL_BUDGET` tables keep their current order so `miningSmall1..48`, `battleSmall1..48`, `hybridSmall1..19` keep their stats; new smalls append as `miningSmall49…` etc. The builder never reorders the budget arrays. |
| New keystones | Add these six (ids and names fixed; exact numbers tuned, downsides required): `oreBaron` ("Ore Baron": +100% ore find, −50% Gold from veins), `allOrNothing` ("All or Nothing": crits ×3, non-crits −40%), `deepBreath` ("Deep Breath": ×3 offline cap, −25% active dig power), `bloodMoney` ("Blood Money": +100% Gold from kills, take +25% damage), `soulDebt` ("Soul Debt": Soul upgrades 25% cheaper, deaths cost 10% of current Souls), `prospectorsEye` ("Prospector's Eye": +100% chest find, maps one tier lower). |
| Round frames | Cut each 24×24 frame to a circle (corner pixels `.`, a 1-px circular border); keep the five frame kinds and their side accents. The web's square `<rect class="gm-web__halo">` becomes a `<circle>`. |
| Keystone wiring | `oreBaron`/`deepBreath`/`prospectorsEye` in `dig.ts`/`stats.ts`; `allOrNothing`/`bloodMoney` in `battle.ts`/`combat.ts`; `soulDebt` in `soulUpgrade.ts`/`combat.ts`. Each effect is guarded by `hasKeystone` exactly like today's eight. |

## New keystone catalogue (proposed; overrule in review)

| Id | Name | Effect (upside / downside) | Wired into |
|---|---|---|---|
| `oreBaron` | Ore Baron | +100% ore find / −50% Gold from gold veins | `dig.ts` (ore bonus), `stats.ts` (gold multiplier) |
| `allOrNothing` | All or Nothing | critical hits ×3 / non-critical hits −40% | `battle.ts` (crit multiplier, damage floor) |
| `deepBreath` | Deep Breath | ×3 offline cap / −25% active dig power | `stats.ts` (offline cap, dig power) |
| `bloodMoney` | Blood Money | +100% Gold from kills / take +25% damage | `combat.ts` (kill gold, incoming damage) |
| `soulDebt` | Soul Debt | Soul upgrades 25% cheaper / deaths cost 10% of Souls | `soulUpgrade.ts` (cost), `combat.ts` (death) |
| `prospectorsEye` | Prospector's Eye | +100% chest find / maps found one tier lower | `stats.ts` (chest find), `dig.ts` (map tier) |

## File structure

```
src/core/
  passives.ts      MOD  cluster layout, more smalls/notables, six new keystones
  skillIcons.ts    MOD  round frames; six new keystone glyphs; iconForPassive for them
  stats.ts         MOD  oreBaron, deepBreath, prospectorsEye
  battle.ts        MOD  allOrNothing, bloodMoney
  dig.ts           MOD  oreBaron, prospectorsEye
  combat.ts        MOD  bloodMoney, soulDebt
  soulUpgrade.ts   MOD  soulDebt
src/ui/skills/
  Web.tsx          MOD  round halo (circle), round frame draw
  skills.css       MOD  round frames; no square halo
  SkillsView.tsx   MOD  legend shows the round frames
src/ui/ascend/
  AscensionView.tsx MOD round ascendancy frames in the card
tests/
  core/passives.test.ts    MOD  id-stability, cluster/link invariants, new keystones
  core/keystones.test.ts   NEW  each new keystone's effect fires
  core/skillIcons.test.ts  MOD  round frames still compose; new glyphs covered
  ui/skillsView.test.ts    MOD  round frame + new node icons
```

---

### Task 1: Round frames and halos

**Files:** `src/core/skillIcons.ts`, `src/ui/skills/Web.tsx`, `skills.css`, `SkillsView.tsx`, `AscensionView.tsx`; tests `tests/core/skillIcons.test.ts`, `tests/ui/skillsView.test.ts`.

**Work:** re-author the five frames in `skillIcons.ts` as 24×24 circles (the glyph socket unchanged at rows/cols 4–19; only the border pixels change). In `Web.tsx`, replace the square halo `<rect>` with a `<circle>` of the same radius, and update `skills.css` so nothing draws a square behind a round icon. Keep the ≥ 44 px hit circle. The card and legend reuse the same frames, so they follow automatically.

**Tests:** every composed icon is still 24×24 and palette-complete; the frame border pixels form a circle (the four corners are `.`); the VM icons carry the round frame.

**Step order:** re-author frames → swap the halo → CSS → `npm test` → commit `Round the node icons`.

---

### Task 2: The cluster layout

**Files:** `src/core/passives.ts` (geometry only); test `tests/core/passives.test.ts`.

**Work:** replace `CHAINS` and the angle/ring placement with a cluster table: each cluster names its smalls (drawn in `SMALL_BUDGET` order to keep ids stable), its terminal notable/keystone, its centre, and its links (within-cluster chain plus explicit cross-links to neighbouring clusters). Keep `START_NODE_ID` ("miner") at the centre and link the nearest cluster of each side to it. `buildWeb()` keeps returning `PASSIVE_NODES` with the same shape (`id`, `name`, `kind`, `side`, `x`, `y`, `links`, `effects`, `desc`), so `skillsView.ts`, `respec.ts`, `save.ts` and `sim.ts` need no change.

**Tests:** an id-stability test snapshots the old id→stat mapping and asserts the new tree preserves it; a geometry test asserts no node is further than `START` by more than a bounded distance and that cross-links exist (the web is not a forest of spokes); `isConnectedWeb` still holds from the start.

**Step order:** snapshot the old id→stat map in a test → write the cluster table → run the test → commit `Rebuild the passive web as clusters`.

---

### Task 3: More nodes

**Files:** `src/core/passives.ts`; test `tests/core/passives.test.ts`.

**Work:** extend `SMALL_BUDGET` (append, never reorder) to reach ~160 smalls across the three sides, and add ~5 notables with modest stat bundles. New smalls get fresh `<side>Small<N>` ids; new notables get new named ids (and glyphs in Task 4). Re-check that 99 points still leave meaningful choices and that the new notables sit at reachable cluster ends.

**Tests:** node count ≥ ~200; every node resolves to a glyph/frame; no id collision; `pointsToSpend` at level 100 is 99.

**Step order:** extend budgets/notables → update counts in tests → commit `Grow the passive web to the level-100 budget`.

---

### Task 4: New keystones, wired and iconed

**Files:** `src/core/passives.ts`, `stats.ts`, `battle.ts`, `dig.ts`, `combat.ts`, `soulUpgrade.ts`, `skillIcons.ts`; test `tests/core/keystones.test.ts` (new).

**Work:** add the six keystones as `n(..., 'keystone', [keystone(id)], desc)` and place them in the clusters; add six glyphs to `skillIcons.ts`; wire each effect with `hasKeystone` in the systems named in the catalogue, following the existing Berserker/Bulwark/Cartographer pattern (all effect maths clamped to the same `MAX_*` bounds).

**Tests:** one focused test per keystone — e.g. allocating `oreBaron` doubles `oreBonusChance` and halves `goldMultiplier`; `allOrNothing` triples a crit and reduces a non-crit; `soulDebt` prices an upgrade at 75% and a death removes 10% of Souls.

**Step order:** add the specs and glyphs → wire each system → write the tests → commit `Add six rule-changing keystones`.

---

### Task 5: Final QA

**Checks:** `npm test`, `npm run typecheck`, `npm run build`, `npm run balance` (the sim's passive policy still paths and spends); a 1280×900 and 390×844 smoke of the web (allocate, stage, refund, search, zoom, round icons); confirm an old save with an allocated web loads and keeps its points.

**Commit:** `Finish the passive-web rework`.

---

## Definition of done

- The web reads as clusters with short edges and cross-links, not radial spokes; a before/after screenshot is recorded.
- The tree has ~200 nodes (14 keystones, ~22 notables, ~160 smalls); the 99-point budget spends but leaves choices.
- Six new keystones each change a rule with a downside and are unit-tested.
- Node icons are round; no square halo remains; the five frame kinds and their accents survive.
- Every pre-existing node id still means the same stat, so old saves load with no migration; `SCHEMA_VERSION` stays 12.
- Full suite, typecheck, build and balance are green; nothing pushed.
