# Progress

## Phase 0: Foundation (built 2026-09-27)

### What was built

**Tooling**

- Vite 8 + React 19 + TypeScript 6 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Phaser 4.2 (the current latest stable major; DESIGN 18.1 says "latest stable").
- Vitest (unit), Playwright (e2e on desktop Chromium plus iPad mini and iPad Pro 11 landscape WebKit), ESLint flat config + Prettier.
- Scripts: `dev`, `build`, `typecheck`, `test`, `e2e`, `lint`, `format`, `format:check`, `icons`.

**Architecture guardrails**

- `src/sim` and `src/config` are typechecked by their own `tsconfig.sim.json` with **no DOM lib**, so browser globals are compile errors there.
- ESLint `no-restricted-imports` blocks Phaser, React, and app layers (`game/`, `ui/`, `save/`, `dev/`) from `src/sim` and `src/config`.
- Both guardrails were checked against a deliberate violation.

**Sim foundations (`src/sim`)**

- `clock.ts`: `Clock` interface, `systemClock`, `FakeClock` (forward-only; for tests), `ScaledClock` (for the future dev time scale; re-anchors on scale change so time never jumps).
- `rng.ts`: seeded sfc32 RNG (splitmix32 seeding) with `next`, `int`, `range`, `chance`, `pick`, `weightedIndex`, `weighted`, and JSON-safe `getState`/`fromState` for saves. A pinned-sequence test guards against accidental algorithm changes.
- `emitter.ts`: tiny typed event emitter (for the sim's events from Phase 1, and the app bus now).
- `types.ts`: `Ms`, `Rarity`/`RARITIES`, `Zone`, `CommandResult`.

**Config (`src/config`)**

- `balance.ts`: every value from DESIGN Section 15, verbatim, deep-frozen at runtime and `as const` typed.
- `species.ts`: data for the full starter roster (see deviations): id, name, rarity, asset key, 3–5 color variants with placeholder colors.

**App shell**

- `index.html` has the exact 18.5 viewport meta, iOS web-app metas, and an apple-touch-icon.
- Full-screen Phaser canvas (`MeadowScene`, FIT scaling, 1280×800 logical world, WebGL with Canvas fallback). Tapping draws a ripple.
- React overlay (`Hud`) layered above the canvas. The overlay is `pointer-events: none` and its widgets opt back in, so taps on empty space reach the canvas and taps on buttons don't. It shows canvas-tap and button-tap counters and a "Send a heart" button that makes the Phaser scene react (UI → world messaging). Coins/gems show `BALANCE` starting values as display-only placeholders.
- Touch: `touch-action: none` on the canvas, `manipulation` elsewhere, Safari `gesture*` pinch blocking, no overscroll/selection/callouts, safe-area insets, `100dvh`. All tap targets are at least 48×48 px (checked by e2e).
- Rotate screen: pure CSS `@media (orientation: portrait)` overlay.
- `prefers-reduced-motion` is respected in CSS and in the scene's tweens.
- PWA via `vite-plugin-pwa`: manifest (`standalone`, `orientation: landscape`), auto-updating service worker precaching the whole game (including Phaser) for offline play, icons (192, 512, maskable 512, 180 apple-touch). Original SVG icon rendered to PNG by `scripts/generate-icons.mjs`.
- Self-hosted Nunito font (Fontsource, Latin subset only, bundled into the build).
- `privacy.html`: plain-language privacy page with the DESIGN Section 20 wording, linked from the HUD.
- Phaser is split into its own chunk (~357 KB gzipped) so game updates don't re-download the engine.

**CI / deploy**

- `.github/workflows/ci.yml`: lint, format check, unit tests, build, and e2e on push/PR; deploys `dist/` to GitHub Pages on push to `main`. Setup steps are in `README.md`.

**Tests**

- 43 unit tests: RNG, clock, emitter, balance/species data integrity (including a 100k-roll ±1% check of the rarity base weights).
- 11 e2e smoke tests × 3 browser configs: loads with HUD over canvas; a canvas tap registers only in the world; a button tap registers only in the UI; 48 px targets; portrait rotate screen; viewport/touch-action; **no requests to other origins**; self-hosted font loads; manifest is installable and landscape; service worker registers (Chromium only); privacy page.

### Defaults chosen (spec left open)

- **Host: GitHub Pages** via GitHub Actions (18.1 lists GitHub Pages, Netlify, or Cloudflare Pages). The build is host-agnostic, so switching later is trivial.
- **Font: Nunito**: rounded, friendly, very legible for kids.
- **Logical world size 1280×800** (16:10), FIT-scaled. It letterboxes slightly on 4:3 iPads with grass-colored bars. Revisit when the Phase 2 yard layout exists.
- **Rotate screen shows on any portrait viewport**, including a tall, narrow desktop window; the text says "screen", not "iPad".
- **Node 24** in CI (`.nvmrc`).
- TypeScript is pinned to 6.0 because typescript-eslint doesn't yet support TS 7.

### Deviations from the spec

- **Species count:** DESIGN 7.1's heading says "Starter species roster (20)", but its table lists **21** species (6 common, 5 uncommon, 4 rare, 3 epic, 3 legendary). `species.ts` follows the table (21). **Needs a designer decision:** keep 21, or name one to cut. Phase 10's "all 20 species" wording has the same issue.
- The Phase 0 HUD (tap counters, "Send a heart") is a temporary test harness to prove the layering, not the real HUD from 17.2. It will be replaced in Phase 2.

### Not verifiable from the dev machine (manual steps)

The Phase 0 "Done when" asks for things that need a real deploy and device:

1. Create the GitHub repo, push, and set Pages source to GitHub Actions (see README), plus an optional custom domain.
2. On the public URL: load it on desktop and in iPad Safari, confirm canvas and button taps register, then **Share → Add to Home Screen** and launch it from the Home Screen.
3. Manual iPad checklist items (DESIGN 22): no accidental zoom (pinch and double-tap), rotate prompt, touch targets.

Everything short of that is verified locally: build, unit tests, and e2e on emulated iPad WebKit and desktop Chromium.

### Known issues

- Playwright's WebKit can't test service workers, so SW registration is only checked on Chromium. iPad install needs the manual check above.
- The service worker only runs in production builds (`npm run build && npm run preview`), not in `npm run dev`.
- The iPad "add to Home Screen so Safari doesn't clear your saves" prompt (DESIGN 18.4) isn't built yet. It belongs with saves/onboarding (Phase 1/8).

## Phase 1: Simulation core (built 2026-09-27)

### What was built

**`GameSim` (`src/sim/GameSim.ts`)**: the headless game. It has a fixed 1-second tick and injected `Clock`, and every random roll goes through the seeded `Rng`, whose state is saved.

- `update()` runs every whole tick up to the clock's time. A gap longer than `time.offlineGapSeconds` counts as offline time.
- `catchUp()` runs offline catch-up and emits `caughtUp` with a summary. The app will call it after loading and when the tab becomes visible again (Phase 2).
- Commands: `revealVisitor(id)` and `sell(id)`. Both return `CommandResult` and never throw on bad ids.
- Queries: `capacity`, `animalCount`, `freeCapacity`, `isCrowded`, `lureScore`, `houseTier`, `msUntilNextVisitor`, `salePrice`, `canSell`, `badges` (New, Pregnant, Baby, Sick, Ready to Sell, Kept), `getAnimal`, and a read-only `state`.
- Events (`src/sim/events.ts`): `visitorArrived`, `visitorSkipped`, `visitorRevealed`, `visitorEntered`, `visitorLeft`, `animalBorn`, `animalGrew`, `readyToSell`, `animalSold`, `coinsChanged`, `crowdedChanged`, `dexDiscovered`, `caughtUp`.

**Systems (`src/sim/systems/`)**

- `rarity.ts`: the Lure Score (house base lure plus placed **yard** lures, capped at 100), the 6.3 weight formula, the species roll with affinity, Sparkle, pregnancy, and litter size.
- `visitors.ts`: the visitor timer, gate queue, tap reveal and 60 s auto-reveal, first-in-first-out admission while there's room, and the 5-minute wave-goodbye.
- `pregnancy.ts`: births at `birthAt` that ignore capacity. Babies keep the mother's color 70% of the time. A Sparkle mother gives each baby a 25% Sparkle chance. Babies are placed near the mother.
- `lifecycle.ts`: `animalGrew` / `readyToSell` fire once when their timestamps pass.
- `housing.ts` (capacity and Crowded), `selling.ts` (price formula, rules, outfits back to inventory), `economy.ts` (integer coins that can't go negative), `animals.ts` (factory and Dex), `timeShift.ts` (shifts every timer; reused by Pet Storage in Phase 5).
- `tick.ts`: the tick order (births, then lifecycle, then the visitor timer, then the gate) and the online/offline runners.

**Content data**: `src/config/items.ts` (the 10 yard lures from 6.5 with lure values and affinities) and `src/config/houseColors.ts` (8 swatches). New tunables in `balance.ts`: `affinity.bonusPerLure`, `pregnancy.birthScatter`, `newBadgeSeconds`, `time.tickSeconds`, `time.offlineGapSeconds`.

**Saves (`src/save/`)**: `schema.ts` (`SaveFile` v1 = `{ schemaVersion, profile, world, meta }`, key `profile:<id>`), `migrations.ts` (a chain of N→N+1 steps; refuses saves that are newer, missing a step, or malformed), `SaveManager.ts` (save/load/delete/list over a `KeyValueStore`, and loading always migrates), `MemoryStore` for tests, and `idbStore.ts` (idb-keyval). None of this is wired into the app yet; that's Phase 2.

**Economy harness**: `src/sim/harness/economy.ts` plus `npm run economy -- [--hours 3] [--seed 1] [--runs 1]`. A bot taps every visitor and sells everything as soon as it can. 3 hours simulate in about 10 ms. Averaged over 50 seeds × 24 h the bot earns **507 coins/hour**, which matches the DESIGN 15.1 estimate of about 500.

**Tests**: 146 unit tests in total (103 new). They cover:

- **Rarity:** the lure worked examples, floors, and clamping; a 100k-roll ±1% check; Lure Score and affinity (yard only).
- **Visitor roll:** Sparkle, pregnancy, and litter statistics.
- **Visitors:** the timer at every tier, reveal and auto-reveal, waiting at capacity, leaving after 5 minutes, admission when a sale frees a spot, first-in-first-out order, and skipping while Crowded.
- **Births:** a litter of 5 at capacity, baby timers, color and Sparkle inheritance, growth, the ready-to-sell event, and the New badge.
- **Selling:** every sale rule and the price formula, capacity math, and coin guards.
- **Offline catch-up:** the queue of 3, the free-capacity bound, births, the 8 h cap, offline progress turned off, and gap detection. A timestamp-shift test catches any timer field that gets forgotten.
- **Saves:** a round trip where save → load → continue equals an uninterrupted game, plus the migration chain and refusal of garbage saves.
- **Harness:** determinism, update-rate independence, 3 hours in under 1 s, and average earnings in the 400–600 coins/hour band.

### Defaults chosen (spec left open) — please confirm or change

1. **Crowded pauses visitors by skipping them.** When the timer fires while over capacity, nobody comes (`visitorSkipped`) and the next timer stays on schedule. When _exactly at_ capacity a visitor still comes and waits at the gate (6.1).
2. **Gate visitors always reveal**, by tap or after 60 s, even with no room. A visitor with no room waits revealed for 5 minutes, so a kid always sees who it was. It's added to the Dex on reveal, even if it later leaves.
3. **Offline visitors** wait unrevealed at the gate. On return, everyone at the gate (including visitors who were already waiting) gets a fresh 60 s auto-reveal and a fresh 5-minute wait, so nobody leaves unseen. Gate visitors don't leave or come in while you're away.
4. **The 8-hour catch-up cap** works by pausing the time beyond 8 hours: every world timer shifts forward by the excess. For example, a hold with 9 h left and 3 days away ends up with 1 h left. With the parent setting `offlineProgress: false`, the whole gap is paused.
5. **Species affinity strength:** every species starts at weight 1 within its tier. Each placed yard lure with affinity for it adds `affinity.bonusPerLure` (1). Example: one Bamboo Grove makes Red Panda 2/5 of Rare rolls instead of 1/4.
6. **Non-Sparkle mothers' babies** roll the normal 2% Sparkle chance (the spec only defines Sparkle mothers).
7. **Pregnant animals can't be sold** ("Babies are on the way!"). This never triggers with the current numbers (3-minute gestation, 20-minute hold); it only guards against future tuning.
8. **Selling admits waiting gate visitors immediately** instead of on the next tick.
9. **Positions** are normalized 0..1 within a zone; scenes map them to pixels.
10. **`offlineGapSeconds` = 300.** This is only a safety net for a missed `visibilitychange`. It is large enough that a frame hitch at the 120x dev time scale isn't mistaken for going offline.
11. **Sim time is tick-aligned.** Commands act at the last processed tick (at most 1 s behind the clock).

### Deviations from the DESIGN 19 sketch

- `Visitor.rolled: Omit<Animal, 'id'>` became `Visitor.roll: VisitorRoll` (species, variant, Sparkle, rarity, litter size). Timers are created when the animal comes in. `Visitor` also has an explicit `autoRevealAt`.
- `house.petSlots` became `house.petSlotsPurchased` (a count of purchases, like `roomExpansions`).
- `meta` also stores `rngState` (for exact resume) and `nextId` (deterministic ids).
- `Profile` is `{ id, username }` for now. The avatar fields arrive in Phase 8 with a v1→v2 migration.
- Every other field for later phases (needs, poop, sickness, outfits, tricks, storage, settings) already exists with defaults, so those phases won't need migrations for them.
- The spec's `offline.ts` lives in `src/sim/tick.ts` (`runOffline`) next to the online runner.

### Known issues

- The save layer isn't connected to the app, and autosave (every 15 s, on hide, and after purchases or sales) isn't built. Both are Phase 2 work.
- Care and trick multipliers are stubbed at 1.0 (as the phase asks). The trick bonus formula is implemented and tested with injected tricks.
- The species-count question from Phase 0 (21 vs 20) is still open.
