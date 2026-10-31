# Plan 24: Start screen

**Goal:** Add a proper start / new-game screen so that the first time a game opens — and every time a new world is started — the player is offered a random, editable character name and a randomly-chosen, editable world seed before the mine begins. The name is new state; the seed field replaces the existing "new world" dialog's seed choice with the same validation, and a single Start button creates the world and saves it.

- **The name.** A random character name is offered from the existing name generator (`creatureName` in `src/core/names.ts`), and it is editable. The chosen name is stored on the save and shown in the header. It never affects the world: same seed, same mine, whatever the name.
- **The seed.** The seed field is prefilled with a random seed text (the same `amber-fox-427` generator the game already uses), and it is editable and validated with the existing `isValidSeedText`. The "dice" rerolls it; the seed shown is always the seed used.
- **The gate.** The screen covers both entry points: the very first launch (no save in storage) and the Settings → "Start a new world…" path. The first has no back button; the second keeps the erase confirmation.

**Architecture:**

- **The name is pure-core state.** `characterName: string` is added to `GameState`. A `MAX_CHARACTER_NAME = 24` bound and `isValidCharacterName` live in `src/core/names.ts` beside the generator, and `randomCharacterName(next)` / `defaultCharacterName(seed)` wrap `creatureName`. Nothing here imports React or touches the DOM; `randomCharacterName` takes the RNG as an argument, so it stays pure.
- **The world does not depend on the name.** `newGame` gains `NewGameOptions.name`; the name is written to `characterName` only. `seed`, `rng`, `lootSeed` and `nextId` are unchanged by a name, so "same seed → same mine" is preserved byte-for-byte.
- **One schema bump.** `SCHEMA_VERSION` 16 → 17; `MIGRATIONS[16]` adds `characterName: defaultCharacterName(state.seed)` so every old save gets a deterministic, pronounceable name on load (no empty-name branch in the UI). The validator rejects a missing or malformed name.
- **The screen is one full-screen component.** `src/ui/start/StartScreen.tsx` renders the name field, the seed field and the Start button; it is mounted either by `App` as a first-launch gate or by `SettingsDialog` as the new-world path. The store gains `hasSave()`, `randomName()` and an extended `newWorld(name, seedText)`.
- **The old dialog is retired.** `src/ui/settings/NewWorld.tsx` is folded into the StartScreen (its seed logic and the "Really erase?" confirmation are reused), so there is exactly one place a world is named and seeded.

**Tech stack:** unchanged — Node 24, TypeScript, Vite, React, Vitest. No new dependencies. One schema bump (16 → 17, finalised by execution order — this is the next bump after runes).

**Spec:** main design §4.9 (the reference player and pacing) for where a name fits; `src/core/names.ts` (the generator), `src/core/seed.ts` (seed text/validation), `src/core/newGame.ts` (`newGame(seed, now, options)`), `src/core/save.ts` (schema, migrations, validator), `src/store/gameStore.ts` (how a world is started), `src/ui/settings/NewWorld.tsx` (the current new-world flow), `src/ui/App.tsx` (app boot), `src/main.tsx` (store wiring and `newSeed`).

**Builds on:** Plan 23, runes (`dev-ernest`, working tree at `a0aa114` + the in-progress runes changes), which set the schema-16 baseline this plan bumps to 17.

**Roadmap:** 15. level cap 100 · 16. the passive-web rework · 17. crafting overhaul and the ore economy · 18. character stats · 19. ascendancy tree expansion · 20. achievements · 21. the wiki · 22. the stats menu · 23. runes · **24. start screen** (this plan).

## Global Constraints

- Nothing under `src/core/` imports React or touches the DOM / `Date.now()` / `Math.random()`. `randomCharacterName` takes `next`; `defaultCharacterName` is a pure `hash2` of the seed.
- **Same seed → same mine.** The name draw and the stored `characterName` never touch `seed`, `rng`, `lootSeed` or `nextId`. A world seeded `amber-fox-427` is byte-identical whether the miner is named Gorvash or anything else.
- **No `!` non-null assertions** in `src/` (existing `?? []` and explicit checks stay).
- **One schema bump, exactly.** `SCHEMA_VERSION` becomes 17; `MIGRATIONS[16]` is the only new migration and it only adds `characterName`. Old saves load unchanged, and a schema-16 save round-trips to 17.
- **Determinism.** `newGame` without a name falls back to `defaultCharacterName(seed)`, so two fresh worlds from the same seed have the same name; the determinism test is extended, not weakened. `freshWorld`'s "calls `next` four times" contract is unchanged.
- **Tests stay green.** Every Plan 1–23 test keeps passing; the save/determinism tests gain name assertions rather than weakening old ones.
- Phones: the StartScreen is re-checked at 390 × 844; inputs and the Start button are ≥ 44 px.
- Git: work on `dev-ernest`; stage explicit paths; short imperative commit messages; no attribution; never push.

## Review Focus

1. **One screen, two paths.** `grep` finds the StartScreen mounted in `App` (first launch) and referenced from `SettingsDialog` (new world), and no remaining `NewWorld` import. First launch has no back button; new-world keeps the erase confirm.
2. **The name is random, editable and stored.** The name field is prefilled by `randomCharacterName` and rerolls on the dice; the typed name is trimmed, validated and written to `state.characterName`, which survives save/load and shows in the header.
3. **The seed is random, editable and validated.** The seed field is prefilled by the existing `randomSeedText` and rerolls; `isValidSeedText` gates Start, and the text shown is the exact text passed to `newGame` (`seedFromText(text) === state.seed`).
4. **The world ignores the name.** A test starts two worlds with the same seed text and different names and asserts `seed`, `rng` and the first metres are identical.
5. **Migration and validation.** A schema-16 save loads to 17 with a generated `characterName`; the validator accepts a valid name and rejects a missing, empty, over-long or control-character name.

## Decisions this plan makes (my calls; overrule them in review)

| Topic | Decision |
|---|---|
| Where the name lives | A top-level `characterName: string` on `GameState`, beside `worldSeed`. It is not a settings field (Settings stay per-run preferences); it is first-class save state. |
| Name length | `MAX_CHARACTER_NAME = 24`; valid is trimmed non-empty, ≤ 24 chars, no control characters (`isValidCharacterName`). `creatureName` tops out around 10 chars, so 24 is generous. |
| The generator | Reuse `creatureName(h)`. `randomCharacterName(next) = creatureName(next())` for the offered name; `defaultCharacterName(seed) = creatureName(hash2(seed, SALT_CHARACTER_NAME))` with `SALT_CHARACTER_NAME = 0x6b6b` for the deterministic fallback and migration. No new word lists. |
| `newGame` | `NewGameOptions` gains `name?: string`; the state sets `characterName: (options.name ?? '').trim() || defaultCharacterName(seed)`. `seed`, `rng`, `lootSeed`, `nextId` are untouched, so the world is name-independent. |
| Schema | `SCHEMA_VERSION` 16 → 17. `MIGRATIONS[16]` sets `characterName: defaultCharacterName(state.seed)`. The validator adds `isValidCharacterName(x.characterName)`. |
| Store API | `hasSave(): boolean` reads `storage.getItem(SAVE_KEY)` (null → first launch). `randomName(): string` and `randomSeedText(): string` draw from `deps.newSeed`. `newWorld` becomes `newWorld(name: string, seedText: string | null): boolean`, trimming/validating the name and reusing the existing seed path; it saves on success as today. |
| Seed field contract | The StartScreen always holds a concrete seed text (prefilled random, rerollable). Start passes that exact text (never `null`), so the displayed seed is always the seed used; `newWorld`'s `null` path remains only for programmatic random. |
| The screen | A full-screen `StartScreen` (not a dialog) with two modes. `first`: title + name + seed + Start, no cancel. `newWorld`: same form plus a Back button and the existing "Really erase this game?" confirm step before Start. |
| Entry points | `App`'s initializer checks `store.hasSave()`; if false it renders `StartScreen` (first mode) and defers `load()`/the game loop until Start. `SettingsDialog`'s "Start a new world…" opens `StartScreen` (new-world mode) instead of `NewWorld`; the read-only "World" seed row in Settings stays (it gains the name line). |
| Name display | The header shows the character name (the title becomes the name, with "Golden Miner" as the subtitle/`aria-label`), and the Settings "World" section lists it. No other surface changes this plan. |
| `NewWorld.tsx` | Deleted; its seed validation, the erase-confirm step and the "same seed → same mine" copy move into the StartScreen. |

## File structure

```
src/core/
  names.ts        MOD  MAX_CHARACTER_NAME, SALT_CHARACTER_NAME, isValidCharacterName,
                       randomCharacterName, defaultCharacterName
  newGame.ts      MOD  NewGameOptions.name; write characterName (name-independent)
  types.ts        MOD  GameState.characterName
  save.ts         MOD  SCHEMA_VERSION 17; MIGRATIONS[16]; validateState name check
src/store/
  gameStore.ts    MOD  hasSave(), randomName(), randomSeedText(); newWorld(name, seedText)
src/ui/
  App.tsx         MOD  first-launch gate → StartScreen; defer the loop until Start
  Header.tsx      MOD  show the character name
  start/
    StartScreen.tsx  NEW  the full-screen name + seed + Start form (two modes)
    start.css        NEW  layout/theme for the screen
  settings/
    SettingsDialog.tsx  MOD  "Start a new world…" opens StartScreen (new-world mode)
    NewWorld.tsx        DEL  folded into StartScreen
tests/
  core/names.test.ts      NEW  validity bounds, random name from a known RNG, deterministic default
  core/save.test.ts       MOD  schema-16 → 17 migration adds a name; name round-trips; invalid names rejected
  store/gameStore.test.ts MOD  hasSave(), newWorld(name, seed) persists the name; seed text stays exact
  ui/startScreen.test.ts  NEW  first-launch and new-world flows (prefill, reroll, validation, Start)
```

---

### Task 1: The name in core and the schema bump

**Files:** `src/core/names.ts`, `src/core/newGame.ts`, `src/core/types.ts`, `src/core/save.ts`; tests `tests/core/names.test.ts`, `tests/core/save.test.ts`.

**Interfaces:**
- `names.ts`: `export const MAX_CHARACTER_NAME = 24`; `export const SALT_CHARACTER_NAME = 0x6b6b`; `export function isValidCharacterName(text: string): boolean` (trimmed non-empty, ≤ 24, no control chars); `export function randomCharacterName(next: () => number): string` (`creatureName(next())`); `export function defaultCharacterName(seed: number): string` (`creatureName(hash2(seed, SALT_CHARACTER_NAME))`).
- `types.ts`: `GameState.characterName: string`.
- `newGame.ts`: `NewGameOptions { seedText?; lootSeed?; name? }`; set `characterName: (options.name ?? '').trim() || defaultCharacterName(seed)`. Nothing else changes, so `seed`/`rng`/`lootSeed`/`nextId` are byte-identical to today for a given seed and options.
- `save.ts`: `SCHEMA_VERSION = 17`; `MIGRATIONS[16] = (state) => isObject(state) && typeof state.seed === 'number' ? { ...state, characterName: defaultCharacterName(state.seed) } : state`; `validateState` adds `if (!isValidCharacterName(x.characterName)) return false`.

**Tests:**
- `names.test.ts`: `isValidCharacterName` accepts a normal name and rejects empty, whitespace-only, > 24 chars and embedded control characters; `randomCharacterName` over a pinned `next` sequence matches `creatureName`; `defaultCharacterName` is deterministic and pronounceable (matches `creatureName(hash2(seed, SALT))`).
- `save.test.ts`: a schema-16 save decodes to 17 with a non-empty `characterName`; a fresh `newGame` with a name round-trips through `encodeSave`/`decodeSave`; a state with a missing/empty/over-long name fails `validateState`.

**Step order:** write the failing name + save tests → add the core functions and the field → the migration and the validator → run `npx vitest run tests/core/names.test.ts tests/core/save.test.ts` → full suite → commit `Add the character name to the save (schema 17)`.

---

### Task 2: The store — hasSave, random draws, and a named new world

**Files:** `src/store/gameStore.ts`; tests `tests/store/gameStore.test.ts`.

**Interfaces:**
- `hasSave(): boolean` — `try { return this.deps.storage.getItem(SAVE_KEY) !== null } catch { return false }`.
- `randomName(): string` — `randomCharacterName(this.deps.newSeed)`.
- `randomSeedText(): string` — `randomSeedText(this.deps.newSeed)` (re-exported under the store so the screen draws from the same stream).
- `newWorld(name: string, seedText: string | null): boolean` — trim and validate the name first (`isValidCharacterName`); keep the existing seed logic exactly (random via `freshWorld` when `null`, else `newGame(seedFromText(text), now(), { seedText: text, lootSeed: newSeed(), name })`); on success, `replaceState` + `save()` as today. The `freshWorld`/`null` path now needs a name too, so it passes `name` through `newGame`'s options or falls back to the default.

**Tests:**
- `hasSave()` is true only when a save exists under `SAVE_KEY`.
- `newWorld('Gorvash', 'amber-fox-427')` sets `state.characterName === 'Gorvash'` and `state.worldSeed === 'amber-fox-427'`; `newWorld('  Thulmar  ', text)` trims to `'Thulmar'`.
- `newWorld('', text)` and `newWorld('   ', text)` return false and leave the world unchanged.
- Two `newWorld` calls with the same seed text and different names produce identical `seed`, `rng` and first-metre rolls.

**Step order:** failing store tests → the three helpers and the `newWorld` signature → run `tests/store/gameStore.test.ts` → full suite → commit `Name the miner when a world is started`.

---

### Task 3: The StartScreen and its two entry points

**Files:** `src/ui/start/StartScreen.tsx`, `src/ui/start/start.css`, `src/ui/App.tsx`, `src/ui/settings/SettingsDialog.tsx`, `src/ui/Header.tsx`; delete `src/ui/settings/NewWorld.tsx`; tests `tests/ui/startScreen.test.ts`.

**Interfaces:**
- `StartScreen({ store, mode, onBack, onStart }: { store: GameStore; mode: 'first' | 'newWorld'; onBack?: () => void; onStart: () => void })` — a full-screen surface with a name input (prefilled `store.randomName()`, a dice button that rerolls), a seed input (prefilled `store.randomSeedText()`, a dice button that rerolls), and a Start button. Start is disabled (or shows the problem line) until both fields are valid; `newWorld` mode adds a Back button and the existing "Really erase this game?" confirm before it calls `store.newWorld(name, text)` and then `onStart()`. Focus lands in the name field on mount.
- `App.tsx`: the initializer checks `store.hasSave()`; when false it renders `StartScreen mode="first" onStart={() => setNeedsStart(false)}` and does not call `store.load()` or start the loop until Start (which calls `store.newWorld(...)`). When a save exists the boot path is unchanged.
- `SettingsDialog.tsx`: "Start a new world…" opens `StartScreen mode="newWorld" onBack={back} onStart={onClose}` instead of the `NewWorld` sub-dialog; the read-only "World" section also lists the character name.
- `Header.tsx`: the title shows `state.characterName` with "Golden Miner" retained as the subtitle/`aria-label`.

**Tests:**
- `startScreen.test.ts`: first mode prefills a non-empty name and a valid seed; the dice buttons produce new values; an invalid seed (empty/too long) blocks Start; typing an empty name blocks Start; Start calls `store.newWorld` with the exact trimmed name and the exact seed text and then `onStart`. New-world mode shows Back and the erase confirm.

**Step order:** build the screen and CSS → wire `App` and `SettingsDialog` → delete `NewWorld.tsx` → `npm test && npm run typecheck && npm run build` → browser at 1280 × 900 and 390 × 844 (first launch with a cleared save, and the new-world path from a live game) → commit `Add the start screen for a name and seed`.

---

### Task 4: Final QA

**Files:** any leftover references to `NewWorld`; `README.md` if the start screen is worth a line.

**Work:**
- `grep -rn "NewWorld" src tests` returns nothing.
- `grep -rn "characterName" src/core src/store src/ui` shows the field flowing from `newGame` → `newWorld` → `StartScreen` → `Header`/Settings.
- Verify a schema-16 save (and a schema-1 save) still loads and shows a name; verify a fresh first launch shows the screen and a new-world from Settings returns the same screen with Back + confirm.
- Check the 44 px targets and the two widths; confirm same-seed different-name worlds match at the first metres.
- Run `npm test`, `npm run balance` (unchanged), `npm run typecheck`, `npm run build`.

**Commit:** `Finish the start screen`.

---

## Definition of done

- First launch (no save) and Settings → "Start a new world…" both show the start screen with a random, editable name and a random, editable, validated seed and a Start button; first launch has no back, new-world keeps the erase confirm.
- The name is stored on `GameState.characterName`, survives save/load, and shows in the header; it never changes the world (`seed`/`rng`/`lootSeed`/`nextId` are byte-identical for the same seed).
- `SCHEMA_VERSION` is 17; a schema-16 save migrates to a generated name and every old save still loads; the validator accepts valid names and rejects invalid ones.
- `NewWorld.tsx` is gone; there is one place a world is named and seeded.
- Full suite, typecheck and build are green; the determinism test covers the name; no new dependency; no push.
