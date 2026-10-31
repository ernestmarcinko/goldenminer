# Plan 14: Skill-tree icons and a sharper, gothic UI

**Goal:** Give every passive and ascendancy node a real pixel icon, made the same way the monsters are, and move the whole interface from soft rounded panels to sharp, beveled, Diablo II-style chrome.

- **Icons.** Every node currently draws as a plain circle or square. This plan adds a hand-authored pixel icon kit, maps every passive and ascendancy node to a glyph, and draws a framed icon in the web and on the node's card.
- **Look.** The UI is built from ~80 `border-radius` declarations and soft 8–12 px corners. This plan replaces them with square corners, inset bevels, bone/gold/blood accents and uppercase display type, keeping the existing semantic colours (mining gold, battle red, hybrid cyan, rarity colours) so nothing becomes harder to read.

**Architecture:**

- **The icon kit is pure core**, mirroring the monsters: ASCII pixel grids, an anchor/socket composer, and a palette of one-letter colours. `src/core/skillIcons.ts` owns the frames, the glyphs, the composition and the node→glyph mapping. No React or DOM.
- **One frame, three tiers, one permanent tree.** A 16 × 16 glyph is centred in a 24 × 24 frame: a light square for smalls, a double-bordered square with corner studs for notables, a heavy riveted square for keystones, and a bone/gold frame with a small diamond for ascendancy nodes. The frame's accent colour is the node's side.
- **Rendering stays in the SVG web.** A pixel grid becomes a cached data-URI PNG (the same canvas path as `PixelArt`), drawn as an SVG `<image>` with `image-rendering: pixelated`; the card reuses `PixelArt` at 2×. This keeps the pan/zoom web and the existing hit targets.
- **The gothic pass is token-first.** `theme.css` gains a zero radius, bevel and ink tokens; `app.css` updates the shared primitives (nav, buttons, dialogs, inputs, toasts, scrollbars); then each view's CSS is converted against a checklist. Circles survive only where the shape is semantic (a coin, a gem, a dot), never for a panel, button, tab, slot, card or dialog.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. Fonts stay Metamorphous / Alegreya Sans / IBM Plex Mono; the display face is used more aggressively (uppercase, letter-spaced) rather than replaced.

**Spec:** main design §3 (pixel-art placeholders and the replaceable atlas), §5 (the dark, lamp-lit look and the mockups); the mockups' dark gothic boards; the existing item and monster art (`src/sprites/grids.ts`, `src/core/monsterParts.ts`).

**Builds on:** `dev-ernest` at `7734201` (all 13 plans plus the post-launch UI fixes).

**Roadmap:** post-launch. 14. skill-tree icons and a gothic UI (this plan) · 15. launch (art pack, hosting, donate link) as the owner decides.

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM. The icon kit composes grids; the UI alone turns them into data URIs.
- **Pixel art only:** integer scales, `image-rendering: pixelated`, no gradients or anti-aliased icons. Every icon is a grid of palette letters; unknown letters are transparent.
- **Same method as the monsters:** `Part`-style grids with anchors; `compose`-style placement; one-letter palette; hand-authored, not generated from shapes.
- **Readability first:** the gothic pass never lowers contrast below the current palette, never shrinks a target below 44 px, and never hides a state cue (allocated, allocatable, staged, refunding, held, full bag).
- **No rounded chrome:** no `border-radius` above 2 px on panels, buttons, tabs, inputs, cells, cards, dialogs, bars, toasts or scrollbars. `50%` is allowed only for semantic dots, coins and gems.
- **No new dependencies, no schema change, no save change.** Icons and CSS only.
- **Tests stay green.** The icon mapping/composition is unit-tested; the CSS pass is verified by build and by the browser checklist.
- Phones: every view is re-checked at 390 × 844; the web still pans/zooms; every control is ≥ 44 px.
- Git: work on `dev-ernest`; explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **Every node has an icon.** A test walks all 141 passive and 30 ascendancy nodes and asserts each resolves to a known glyph and a frame; no fallback circle, no unknown id.
2. **The kit is honest pixel art.** The glyph grids are rectangular, the composer throws on an off-canvas pixel, and the composed palette contains every letter used. Task 1 tests each.
3. **The icons read at 1×.** In the web a small node's icon is 32 px (16 × 2); a notable/keystone is 32 px inside a larger frame. The browser check looks at 1280 × 900 and 390 × 844 and at the fitted and zoomed views.
4. **The gothic pass is complete.** A `grep` finds no radius above 2 px outside semantic circles; every checklist item is applied; the four view families (character/inventory, mine/run, merchant/log/settings, skills/ascend) are each checked.
5. **Nothing regressed.** Hover/action cards, pinned pairs, drag ghosts, click-pickup, staged allocation, refund mode, the card grace period, and all 861 tests still behave.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Icon size | A 16 × 16 glyph centred in a 24 × 24 frame. The web draws the glyph at 32 px (2×) inside a 36 / 44 / 52 / 56 px frame for small / notable / keystone / start. |
| Frames | `small`: single 1 px outline, two corner studs. `notable`: double outline, four corner studs. `keystone`: heavy outline, four rivets and a centre notch. `ascendancy`: bone/gold, a small diamond at the top, otherwise like a notable. `start`: the miner's face in a gold frame. |
| Frame accents | Mining `#e8b44a`, battle `#ff8a7a`, hybrid `#7fd3e8`, start `#f1e9dc`, ascendancy bone `#d9c9a3`. The frame ring carries the accent; the glyph itself uses bone/steel/gold/wood/blood so icons stay legible when a node is dim. |
| Palette | Reuse the item/monster letters: `k` outline, `b/B/d` dark/mid/light body, `s/S` steel, `g/G` gold, `w/W` wood, `c/C` crystal, `r/R` blood, `a/A` accent, `t` bone, `e/p` eye white/pupil. Add `h` dark blood, `i` bone shade, `j` leather, `f` flame, `o` ember, `u` soul, `v` void. |
| Mapping | `iconForPassive(node)` → `miner` (the start), the keystone's own id, the notable's own id, or the stat/structural glyph id (`digPower`, `goldYield`, …, `gemStack`, `materialStack`, `stashPages`, `autoMap`). `iconForAscendancy(node)` → `minerReborn` (the start), the notable's own id, or the stat/structural glyph id (`goldYield`, `startingDepth`, `passivePoints`, `autoMapTier`, …). |
| Glyph reuse | Item sprites whose symbol already matches (pickaxe, coin, diamond, chest, map, gem, ore, lamp, sword, armor, helm, boots, ring, amulet) are reused as glyphs, centred; the rest are new grids. Every glyph is authored at 16 × 16 even when the source is 12 × 12. |
| Rendering | A UI-only `iconDataUrl(grid, palette)` builds a canvas once per distinct grid+palette, caches it (LRU, like `PixelArt`), and returns a PNG data URI. The web uses `<image href={uri}>`; the card uses `PixelArt` at 3×. |
| Node shapes | The web's circles/keystone squares become the framed icons above. Ascendancy nodes use the bone/gold `ascendancy` frame at their kind's size. The start is the miner's face. The hit target stays ≥ 44 px. The node's `data-*` states and the core dot stay. |
| Glyph vocabulary | 8 keystone, 17 passive-notable and 6 ascendancy-notable glyphs are unique; the ~34 stat/structural glyphs cover the smalls. Exact art is the builder's; the ids and the mapping are fixed and tested. |
| Gothic tokens | `--gm-radius: 0px`; `--gm-ink: #0b0907`; deeper panel/raised tokens; `--gm-bone: #d9c9a3`; `--gm-gold-dim: #8a6a2a`; `--gm-blood: #8e2f26`; `--gm-steel: #6f7378`; `--gm-bevel: inset 1px 1px 0 rgba(255,255,255,.06), inset -1px -1px 0 rgba(0,0,0,.75)`; `--gm-edge: 1px solid #0a0806`. |
| Gothic primitives | Nav tabs and buttons become rectangular, beveled and uppercase; dialogs square with a gold header rule; inputs inset; scrollbars square; toasts square; corner rivets on the main panels. |
| Typography | Metamorphous stays the display face, now uppercase with `letter-spacing: .06em` and a 1 px black text shadow on headings/buttons. Body copy and numbers are unchanged. A switch to Cinzel is left as an owner decision. |
| Scope order | Icons and the theme primitives are file-disjoint and can be built in parallel worktrees. Then the component passes in four families, then the final QA. |

## Icon vocabulary

Named glyphs are unique; stat/structural glyphs are shared by every node with that effect. The builder hand-draws each as a 16 × 16 grid in the kit style.

| Group | Glyph ids |
|---|---|
| Starts (2) | `miner` (the passive tree's start: the miner's face), `minerReborn` (the ascendancy start: a phoenix/miner) |
| Keystones (8) | `earthshaker` (cracked rock/fist), `cartographer` (compass), `prospectorsLuck` (clover over a coin), `berserker` (axe), `soulReaper` (scythe), `bulwark` (tower shield), `deepPockets` (pouch), `twoWayStreet` (two crossed arrows) |
| Mining notables (5) | `veinSense` (eye over a vein), `prospector` (pick + coin), `deepLungs` (lungs), `oreSniffer` (nose + ore), `steadyHands` (gauntlet) |
| Battle notables (5) | `thickSkin` (hide), `sharpened` (whetstone), `deadlyAim` (crosshair), `soulWarden` (soul + shield), `treasureHunter` (star + chest) |
| Hybrid notables (7) | `lampAndBlade` (lamp + sword), `wellRested` (moon/bed), `sureFooting` (boot), `careful` (eye + shield), `gemPouch` (pouch + gem), `oreCart` (cart), `surveyor` (map + eye) |
| Ascendancy notables (6) | `midasTouch` (hand + coin), `deepRoots` (roots), `secondSight` (eye), `masterSurveyor` (compass + map), `tireless` (hourglass), `luckyBreak` (star/clover) |
| Stat glyphs (~34) | `digPower` pickaxe, `digPowerPct` pickaxe+up, `goldYield` coin stack, `diamondYield` diamond, `veinYield` gem cluster, `autoTickRate` gear, `ticksPerClick` gauntlet, `sellBonus` coin+tag, `chestFind` chest, `gemFind` gem, `mapFind` map, `oreFind` ore, `lampSight` lamp, `offlineCap` hourglass, `hazardWard` mask, `salvageYield` anvil, `damage` sword, `damagePct` sword+up, `elementalDamage` flame, `attackSpeed` crossed daggers, `critChance` crosshair, `critMultiplier` burst, `life` heart, `lifePct` heart+up, `armor` shield, `armorPct` shield+up, `resistAll` gemmed shield, `lifeRegen` heart+plus, `lifeOnKill` heart+skull, `soulFind` wisp, `magicFind` star, `xpFind` scroll |
| Structural | `gemStack` gem pouch, `materialStack` ore cart, `stashPages` strongbox, `autoMap` map+arrow, `startingDepth` down arrow, `passivePoints` plus, `autoMapTier` map+up |

**Sample grids** (16 × 16, kit style; the builder may refine the art):

```
coin                         sword
................             ................
.....kkkkkk.....             ........kk......
....kGgggggk....             .......kSSk.....
...kGgggggggk...             ......kSSk......
..kGggkkkkgggk..             .....kSSk.......
..kGgkggggkggk..             ....kSSk........
..kGgkggggkggk..             ...kSSk.........
..kGgkggggkggk..             ..kSSk..........
..kGgkggggkggk..             .kSSk...........
..kGggkkkkgggk..             kgggk...........
...kGgggggggk...             kgggk...........
....kGgggggk....             .kggk...........
.....kkkkkk.....             ..kk............
................             ................
................             ................
................             ................
```

A frame is drawn around the glyph by the composer, so the glyph grid never draws its own border.

## Gothic component checklist

The pass is complete when every line is applied and re-checked in the browser.

- **Tokens / global:** zero radius; ink background; bevel tokens; square scrollbars (`::-webkit-scrollbar`, `scrollbar-color`); black text shadow on display headings.
- **Nav:** rectangular tabs, beveled; active tab gold bottom bar and dark fill; Run tab soul-coloured.
- **Buttons:** rectangular, uppercase, beveled; primary gold with ink text; danger blood; pressed inset; disabled dim.
- **Inputs / textareas:** square, inset, 1 px line.
- **Dialogs / overlays:** square, black panel, gold header rule, corner rivets; settings, save, new world, loot filter, run result.
- **Notices / toasts:** square, beveled.
- **Header:** square currency chips, level bar, sharp separators.
- **Inventory / character:** square cells, slots, tabs; beveled paper doll; sharp hover/action/pinned cards and the paired side column; sharp rarity borders; held/ghost states.
- **Mine / run:** square status panel, progress bar, finds feed, minimap frame, shaft frame; sharp room track, life bars, combat log, loot list.
- **Merchant / log / settings:** square portraits/stock/gamble panels; sharp log tabs/rows; square toggles, sliders and checkboxes.
- **Skills / ascend:** framed pixel icons; square web panel; sharp zoom controls, action bar, legend, floating card; staged/refund frames sharp.
- **Keep circles only for:** coin/gem dots, the minimap miner blip, and any other genuinely round token.

## File structure

```
src/core/
  skillIcons.ts        NEW  IconGlyphId, IconFrame, IconGlyph, ICON_GLYPHS, FRAMES,
                           composeIcon, iconForPassive, iconForAscendancy
src/ui/
  PixelArt.tsx          MOD  export a cached iconDataUrl(grid, palette)
  skills/
    SkillIcon.tsx      NEW  <SkillIcon> for SVG <image> and an HTML <img>/PixelArt variant
    skillsView.ts      MOD  SkillNodeVM gains `icon: { grid, palette, id }`
    Web.tsx            MOD  framed icons replace circles/squares
    SkillsView.tsx     MOD  icon in the card and legend
    skills.css         MOD  square web panel, controls, frames
  ascend/
    AscensionView.tsx  MOD  icon in the card
    ascend.css         MOD  sharp layout
  theme.css            MOD  radius/ink/bone/blood/bevel tokens
  app.css              MOD  nav, buttons, dialogs, inputs, toasts, scrollbars
  character/character.css, inventory/inventory.css          MOD  cells, slots, cards, pair
  mine/mine.css, shaft.css, minimap.css, run/run.css        MOD  panels, bars, lists
  merchant/merchant.css, log/log.css, settings/settings.css  MOD  portraits, rows, controls
tests/
  core/skillIcons.test.ts   NEW  coverage, composition, palettes, bounds
  ui/skillsView.test.ts     MOD  the VM carries an icon for every node
```

---

### Task 1: The icon kit (parallel with Task 3)

**Files:** create `src/core/skillIcons.ts`, `tests/core/skillIcons.test.ts`.

**Interfaces:**
- `export type IconGlyphId = ...` — the ids in the vocabulary table.
- `export interface IconGlyph { grid: string[]; anchor: [number, number] }` — a 16 × 16 glyph centred on its anchor.
- `export type IconFrameKind = 'small' | 'notable' | 'keystone' | 'start' | 'ascendancy'`.
- `export interface IconFrame { grid: string[]; glyphAt: [number, number]; palette: Record<string, string> }`.
- `export const ICON_SIZE = 24`.
- `export const ICON_GLYPHS: Record<IconGlyphId, IconGlyph>` — hand-authored 16 × 16 grids, with the item sprites reused where they fit.
- `export const ICON_FRAMES: Record<IconFrameKind, IconFrame>`.
- `export function composeIcon(kind: IconFrameKind, glyphId: IconGlyphId, side: PassiveSide | 'ascendancy'): { id: IconGlyphId; grid: string[]; palette: Record<string, string> }` — the frame's grid with the glyph centred, recoloured by side; throws on an off-canvas pixel.
- `export function iconForPassive(node: PassiveNode): IconGlyphId` and `iconForAscendancy(node: AscendancyNode): IconGlyphId` — the mapping rules above.
- The frame palettes use the side accent for the ring and a fixed bone/steel/gold/wood/blood glyph palette.

**Tests:**
- Every `PASSIVE_NODES` and `ASCENDANCY_NODES` entry gets a glyph from `ICON_GLYPHS` (141 + 30).
- The kind mapping is right: keystones/notables use their own ids; smalls use their stat/structural id; the starts use `start:miner` / `minerReborn`.
- `composeIcon` produces a 24 × 24 grid for every frame/glyph pair and never throws.
- Every non-`.` letter in every composed grid exists in its palette.
- The item-sprite reuse is centred and does not clip.
- Deterministic: the same input gives the same grid/palette.

**Step order:** write the failing coverage/composition tests → author the frames and the glyphs → run `npx vitest run tests/core/skillIcons.test.ts` → full suite → commit `Add the skill and ascendancy icon kit`.

---

### Task 2: Icons in the web and the cards

**Files:** modify `src/ui/PixelArt.tsx`, `src/ui/skills/SkillIcon.tsx`, `skillsView.ts`, `Web.tsx`, `SkillsView.tsx`, `AscensionView.tsx`, `skills.css`, `ascend.css`; test `tests/ui/skillsView.test.ts`.

**Interfaces:**
- `PixelArt.tsx`: `export function iconDataUrl(grid: readonly string[], palette: Record<string, string>): string` — cached, 1 px per cell, PNG data URI.
- `SkillIcon.tsx`: `<SkillIcon icon={...} size={32} mode="svg" />` and `mode="html"` (the card uses `PixelArt` at 3× or the same URI).
- `skillsView.ts`: `SkillNodeVM` gains `icon: { id: IconGlyphId; grid: string[]; palette: Record<string, string> }`, filled by `iconForPassive`/`iconForAscendancy` and `composeIcon`.
- `Web.tsx`: the node renders a sharp `<rect>` frame (36 / 44 / 52 / 56 px by kind) and an `<image>` icon (32 px) instead of the circle/keystone rect. The `data-*` attributes and `<title>` stay; the core dot and state colours move to the frame. The hit circle stays ≥ 44 px.
- `SkillsView.tsx` / `AscensionView.tsx`: the card shows the icon (3×) beside the name; the legend shows one sample frame per kind.
- `skills.css` / `ascend.css`: square frames, sharp web panel, beveled controls; the old radius declarations in these files go to 0.

**Tests:** `skillsView.test.ts` gains an icon assertion: every VM has an icon id, a 24 × 24 grid and a palette; the start/keystone/notable ids are right. No DOM test for the data URI; the build and browser check cover it.

**Step order:** add the VM icon field and tests → `SkillIcon`/`dataUrl` → `Web` → cards/legend → CSS → `npm test && npm run typecheck && npm run build` → browser at 1280 × 900 and 390 × 844 → commit `Draw pixel icons on the skill and ascendancy trees`.

---

### Task 3: Gothic tokens and shared primitives (parallel with Task 1)

**Files:** `src/ui/theme.css`, `src/ui/app.css`.

**Work:**
- Add the tokens from Decisions; set `body` to the ink ground; keep every semantic colour.
- Convert `.gm-nav`, `.gm-btn`, `.gm-textarea`, `.gm-dialog`, `.gm-overlay`, `.gm-notice`, `.gm-toast`, `.gm-blocked` to square, beveled chrome.
- Uppercase/letter-spaced buttons and tabs; gold header rule on dialogs; corner rivets on dialogs/panels via a shared class or pseudo-elements.
- Square scrollbars (WebKit + Firefox) and focus rings (keep 2 px gold outlines).
- 44 px targets unchanged.

**Tests:** `npm run build`; a `grep` for `border-radius` in these two files should show only 0/2 px (and `50%` for dots, if any).

**Step order:** tokens → primitives → build → commit `Square off the shared UI chrome`.

---

### Task 4: Character and inventory chrome

**Files:** `src/ui/character/character.css`, `src/ui/character/ItemCard.tsx` (only class hooks if needed), `src/ui/inventory/inventory.css`.

**Work:** square item cells and worn slots; beveled paper doll; sharp tabs; square hover/action/pinned cards and the paired side column; sharp rarity borders; held/ghost states; sharp craft and filter dialogs. Keep the item sprites and the new click-pickup ghost unchanged.

**Tests:** the full suite (drag/pair/action tests) + build; browser at both widths, including a hovered pair, a pinned pair, a dragged item and a held item.

---

### Task 5: Mine, run, merchant, log and settings chrome

**Files:** `src/ui/mine/mine.css`, `mine/shaft.css`, `mine/minimap.css`, `src/ui/run/run.css`, `src/ui/merchant/merchant.css`, `src/ui/log/log.css`, `src/ui/settings/settings.css`.

**Work:** square status/finds/minimap/shaft panels; sharp progress bars and room track; square life bars, combat log and loot list; square merchant portraits, stock, gamble and trade panels; sharp log tabs/rows; square settings sections, toggles, sliders and checkboxes; square run result and offline summary.

**Tests:** full suite + build; browser check of every view and a map run.

---

### Task 6: Final polish and QA

**Files:** any remaining CSS/token files; `README.md` only if a look note is wanted.

**Work:**
- `grep -rn "border-radius" src/ui` and confirm only 0/2 px and semantic circles remain.
- Re-check the four families at 1280 × 900 and 390 × 844: all tabs, a map run, the Ascend tab (use the level-60 save), a hovered pair, a pinned pair, drag and click-pickup, a full bag, the offline summary, settings.
- Confirm contrast and 44 px targets; confirm the web still pans/zooms and the icons read at the fitted and zoomed views.
- Run `npm test`, `npm run typecheck`, `npm run build`.

**Commit:** `Finish the gothic UI pass`.

---

## Definition of done

- Every passive and ascendancy node has a framed pixel icon; no node falls back to a circle.
- The icon kit is composed and mapped in pure core, with coverage and composition tests.
- Panels, buttons, tabs, inputs, cells, cards, dialogs, bars, toasts and scrollbars are square and beveled; only semantic dots/gems stay round.
- The four view families are checked at desktop and phone widths; the states (allocated, allocatable, staged, refunding, held, dragged, full) remain clear.
- 861+ tests, typecheck and build green; no new dependency; no save/schema change; nothing pushed.
