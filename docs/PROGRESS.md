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

## Phase 2: First playable yard (built 2026-09-27)

### What was built

**The core loop is playable:** visitor → tap to reveal → walks in → babies → hold timer → sell → coins, on desktop and emulated iPad.

**World (Phaser, `src/game/`)**

- `YardScene` replaces the Phase 0 `MeadowScene`. It's render-only: every frame it reconciles sprites with sim state, and uses sim events only for flourishes (reveal star burst, birth hearts, sale "+45 🪙" and wave goodbye).
- Placeholder art drawn in code: grass, flowers, the path, a fence with an open gate, and the house in the saved exterior color (default Butter).
- `AnimalSprite`: a round critter in its variant color, with a name label and badge icons over its head (🤒 🍼 🪙 ❤️ ✨). Babies are 65% size. Sparkle animals get a twinkling ✦ ring.
- Animals move in three ways: idle breathing, hop-walks, and render-only ambling around their sim position every few seconds. Sprites are depth-sorted by y. Tap targets are 96×120 world px, which is at least 77×96 CSS px on an iPad mini.
- `VisitorSprite`: a wobbling silhouette with a "?" bubble. It pops into the animal with its name and colored rarity stars when revealed, shows "No room!" while waiting, and waves 👋 when it leaves.
- `src/game/layout.ts` holds all world coordinates. It has no Phaser import, so e2e tests use it to find things.
- Reduced motion (the system setting or `settings.reducedMotion`) turns off breathing, ambling, hops, and bursts.

**React overlay (`src/ui/`)**

- **HUD:** coins, gems, and a capacity pill ("5/6", red when Crowded). A visitor pill reads "Next visitor in 4:32", "A visitor is at the gate!" or "Too crowded for visitors". There's also a small Privacy link.
- **Animal Card:** opens when you tap an animal and closes with ✕ or by tapping empty ground. It shows a portrait, name, colored stars and rarity word, Sparkle tag, badge chips, and "Babies coming in", "Grows up in" and "Ready to sell in 12:34" / "Ready to sell!". The Sell button shows the price. When it can't sell yet it looks disabled but still takes taps and explains why ("Not ready to sell yet.").
- **Toasts** (bottom center, max 3, 3.5 s) with the DESIGN 17.4 wording plus: visitor waved goodbye, sold "+price", room again, a "Welcome back!" summary after catch-up, and a save-failed message.
- **Startup screen** while the save loads, and a friendly "Try again" if it can't load. A broken save is never overwritten.

**Session wiring (`src/bridge/`)**

- `GameSession` loads the `default` profile's save (then runs catch-up) or starts and saves a new game.
- It autosaves every `save.autosaveSeconds` (15 s) while visible, when the page is hidden (`visibilitychange`, `pagehide`), and after every sale.
- It runs catch-up when the page becomes visible again. Save failures become a toast instead of a crash.
- `runSession` connects it to requestAnimationFrame and page events. The session lives outside React, so StrictMode can't start two games.
- **The game clock never runs backwards:** it resumes from the later of the device time and the save's last tick. This also carries the dev time scale.

**Sim additions**

- The wander timer (`systems/wander.ts`): every 60–120 s (`wander.*`) each animal picks a new spot in its zone. It's paused offline. Phase 6 adds switching zones at the same moment.
- New events: `changed` (drives React re-renders) and `gemsChanged`. There's also `addGems`.
- `debugCommands.ts` (dev only): spawn a visitor now with forced rarity, species, variant, Sparkle, or litter; add coins or gems; and run online across a clock jump.
- `ScaledClock` gained `startAt` and `jump()`.

**Debug Panel (`src/dev/`, dev builds only)**

- The panel has: time scale 1x/10x/30x/60x/120x, advance +1/+5/+20/+60 min (played with online rules), and spawn visitor with rarity/species/Sparkle/pregnancy choices. It also adds coins or gems, saves now, and starts a new game (deletes the save).
- It loads through `import.meta.env.DEV ? lazy(...) : null`. Production builds contain none of it; an e2e test and a check of `dist/` confirm this.

**Tests**

- **Unit:** 178 in total (31 new). They cover:
  - Wander, the `changed` event, and debug commands.
  - `GameSession`: new game, load plus catch-up, save after sale, hide/visible, autosave, save failures, the clock never going backwards, deleting a save, and the version counter.
  - Countdown formatting, names, and toast wording.
  - A regression test for sale-event ordering (see bugs below).
- **E2E:** 17 tests × 3 browser setups. The Phase 0 tap-counter tests were replaced with real flows:
  - A new game's HUD.
  - Tap a mystery visitor so it walks in.
  - Sell for coins, and the sale survives a reload.
  - A disabled Sell button explains itself.
  - Tapping empty ground closes the card.
  - A litter is born with its toast.
  - Canvas taps reach the world, and card taps don't fall through.
  - Card buttons are at least 48 px.
  - No Debug Panel in production.
  - Tests seed saves straight into IndexedDB and use reduced motion, so animals sit at known spots.

### Bugs found and fixed

- `animalSold` fired before the coins were added, so the save-after-sale saved the old balance. The e2e reload test caught this. The event now fires after the state is final.
- Newborns popped in at adult size: the pop-in animation grew each sprite before its baby size was set.

### Defaults chosen (spec left open)

1. **In-yard movement.** The sim moves each animal to a new spot on its wander timer. Between moves the scene ambles it around that spot, render-only.
2. **Visitors reveal on a single tap.** Animals open their card on tap. Phase 3 adds tap-and-hold petting.
3. **The Animal Card is a right-side panel** (the spec allows a bottom sheet or side panel), so the yard stays visible.
4. **Toasts sit at the bottom center** so they never cover the HUD or the card.
5. **House color:** the first of the 8 swatches (Butter) until onboarding in Phase 8.
6. **One default profile** (`default` / "Player"). Profiles arrive in Phase 8.

### Known issues

- **Needs a real-device check:** playing the core loop on a real iPad and on desktop Safari/Firefox (DESIGN 22 manual checklist). Everything was verified in Chromium and emulated iPad WebKit only.
- Placeholder art: every species has the same round shape, and very dark variants (black kitten, dark otter) hide their eyes. Phase 10 is the art pass.
- Headless test browsers have no color emoji font, so 🪙 renders gray in screenshots. Real iPads and desktops show color.
- A baby's name label keeps the adult position, so it floats a little low under the smaller body.
- The iPad "Add to Home Screen" prompt (DESIGN 18.4) is still not built (planned with onboarding, Phase 8).
- A kept animal never gets a "Ready to sell" toast. That's by design, but Keep itself arrives in Phase 5.

## Phase 3: Care (built 2026-09-27)

### What was built

**Sim (`src/sim/systems/`)**

- `needs.ts`: hunger drains 100 → 0 over 30 min and happiness over 40 min. Happiness drains ×1.5 while Crowded (×2 while sick, ready for Phase 4). Zone cleanliness is `100 − 20 × poops in the zone`.
  - Care samples (the average of the three needs) are recorded once a minute; the last 10 minutes are kept.
  - **`careMultiplier`** maps that average linearly onto 0.8–1.3 and now feeds the sale price. It uses current needs when there are no samples yet.
- `feeding.ts`: an animal with hunger < 50 walks to a bowl in its zone that has food and eats one serving (fills hunger). Tapping a bowl refills it for free. **Treats** cost 5 coins for +30 hunger and +25 happiness; they're refused when the animal is already full or you're short on coins.
- `poop.ts`: every 8–14 min an animal poops at its spot. Tap to clean.
- `petting.ts`: tap-and-hold gives +15 happiness, then a 20 s cooldown.
- `naming.ts`: 1–14 characters (letters in any language, numbers, space, `' . -`). The local word filter (`src/config/wordFilter.ts`) blocks whole words ("Stupid") and fragments anywhere, including leetspeak and spaced-out tricks ("sh1t", "f u c k"). Innocent names that contain a blocked word survive ("Cassie", "Grape", "Cucumber", "Fuku"). An empty name clears it.
- **Offline (DESIGN 14):** needs don't decay, nobody poops or eats, and care sampling pauses. Poop and wander timers that come due while away just roll forward, so there's no pile of poop and no stampede on return.
- `GameSim` gains `refillBowl`, `feedTreat`, `cleanPoop`, `pet`, `rename`, `careMultiplier`, `cleanliness`, `bowls`, and events for eating, bowl empty/refill, treats, petting, poop appear/clean, and rename.
- New content: `src/config/yard.ts` (12×5 yard tile grid, `STARTING_ITEMS` = one food bowl) and the `food_bowl` item.

**Save v2** (`src/save/migrations.ts`): v1 → v2 gives every animal (out or stored) `nextPetAt`, and gives a game with no bowl a full starting bowl. Migration steps now turn any crash into a clean `SaveError`, so a malformed old save can't take the game down.

**World**

- **Food bowl:** the food mound shrinks as it's eaten, and it shows a bouncing "!" when empty. Tap to refill ("nom!" pops when an animal eats; "Full!" if it's already full).
- **Poop:** a little swirl with wavy lines. Tap it for a sparkle and it shrinks away.
- **Petting:** press and hold (450 ms) an animal to pet it, with floating hearts. A quick tap still opens the card. If it's still on cooldown, "💕 Loved that!" shows instead.
- Thought bubbles over animals when hunger < 25 (🍽️) or happiness < 25 (😢), so neglect is visible in the yard, not just on the card.
- Treats show 🍪 and hearts. Long walks (e.g. to the bowl) are capped at 2.5 s.

**Animal Card**

- Food / Happy / Clean bars (green/yellow/orange), a "Press and hold to pet!" tip, and "Care bonus +20%" / "Needs care −20%" next to the price.
- Tap the name (✏️) to rename it. The keyboard-friendly input shows the filter's reason when a name is refused.
- A 🍪 Treat button next to Sell. Refused actions explain themselves.

**Other**

- A "The food bowl is empty! Tap it to refill." toast.
- The session also saves right after treats (a purchase) and renames.
- Debug Panel: "😢 Neglect all" / "💖 Fill all" needs buttons.
- **Economy harness** has `caring` (default: refills, cleans, pets) and `neglect` bots: `npm run economy -- --neglect`.

**Tests**

- **Unit:** 213 in total (35 new). They cover:
  - Decay rates and clamping, Crowded drain, and offline pause.
  - Eating: hungry thresholds, sharing servings, zone-only bowls.
  - Free refill, and treats (cost, cap, refusals).
  - Poop timing and position, cleaning, per-zone cleanliness, and no offline poop.
  - The pet cooldown, the care multiplier mapping, and the sampling window.
  - Neglect vs care pricing, and the naming rules and filter.
  - The v1 → v2 migration, save-after-treat/rename, and caring-vs-neglect bots in the harness.
- **E2E:** 22 tests × 3 browser setups (6 new):
  - Hold to pet (and a hold doesn't open the card).
  - Tapping poop raises Clean.
  - Tapping the empty bowl feeds a hungry animal.
  - A treat costs 5 coins.
  - A neglected Rare sells for 80 with "Needs care −20%".
  - Renaming (unkind names refused), and the name survives a reload.

### Phase 3 "Done when"

- **Neglect lowers the price and care raises it.** The care multiplier runs 0.8× (neglected) to 1.3× (well cared for). Averaged over 30 bots × 24 h, the caring bot earns **~606 coins/hour** (care ×1.25) and the neglectful bot **~478** (×0.98). A unit test and an e2e test both check this.
- **Need math and multipliers are tested:** see the list above.

### Bugs found and fixed

- **First tap landed off target on desktop.** Phaser caches where the canvas sits on the page. In the letterboxed desktop layout its copy was stale after boot, so the first tap landed 64 px off (a probe measured 711 instead of 640). In Phase 2 I wrongly blamed this on Playwright and papered over it in the test helper. Now the game re-reads the canvas position at the start of every press (capture phase) and on resize. The test workaround is gone.
- The e2e suite could silently reuse a hand-started `vite preview` on port 4173 serving an old build. E2E now uses its own port (4317).

### Defaults chosen (spec left open) — please confirm or change

1. **Treat:** 5 coins, +30 hunger, +25 happiness; refused if already full.
2. **One serving fills hunger to 100.** With 5 servings per bowl, a bowl feeds about 5 meals, so with a full yard the kid refills it every 10–15 minutes.
3. **Cleanliness** drops 20 per uncleaned poop in the zone (5 poops = 0).
4. **Care multiplier mapping:** linear, where a 0 average → 0.8, 40 → 1.0, and 100 → 1.3. The average includes zone cleanliness as the third need. One sample per minute; the last 10 samples count.
5. **Pacing drift:** good care pays ~20% above the DESIGN 15.1 estimate (~500/h assumed ×1.0). **Designer call:** keep it (care feels rewarding), or lower `care.maxMultiplier` / base prices.
6. **Starting bowl:** one food bowl in the yard near the house (tile 1,0). More bowls come from the Home Store (Phase 6, default price 40).
7. **Hold to pet = 450 ms.** A quick tap opens the card. A press that drifts more than 28 px is neither.
8. **Visible neglect cues:** thought bubbles when hunger or happiness < 25 (render-only threshold).
9. **Word filter:** a local list in `src/config/wordFilter.ts`. Silly-but-harmless words (poop, fart, butt) are allowed as pet names on purpose. Edit the list freely.
10. **Eating is instant.** The animal's hunger fills as it starts walking to the bowl (the walk is at most 2.5 s).

### Known issues

- House bowls, beds, and coziness come with the House in Phase 6. `tickFeeding` already works per zone.
- Headless test browsers can't show color emoji, so 🍽️, 🪙 and friends look gray in screenshots only.
- Real-device check still pending: iPad tap-and-hold feel, and the on-screen keyboard with the rename field.

## Phase 4: Health and Vet (built 2026-09-27)

### What was built

**Content (`src/config/illnesses.ts`)**

- The 6 illnesses from DESIGN 9.4. Each has a yard symptom icon, short visible symptoms, a symptom animation kind, the correct treatment, and clues for each exam tool.
- 3 exam tools (🩺 Stethoscope, 🌡️ Thermometer, 🔍 Magnifying Glass) and a 6-treatment cabinet.
- Adding an illness is a data entry that reuses one of the 6 animation kinds.
- Config tests check that no two illnesses give the same clues through all three tools, so every illness can be diagnosed.

**Sim**

- `systems/sickness.ts`: once per simulated minute, each healthy animal rolls using the exact DESIGN 9.1 formula:
  - Base 0.002, ×2 when hunger < 25, ×2 with ≥ 3 poops in the zone, ×1.5 when happiness < 25.
  - Plus 0.01 for each contagious animal in the same zone.
  - The roll never happens offline, or when `settings.sicknessEnabled` is off.
  - Kept pets out in the world can get sick. Stored pets can't.
  - An immunity (30 min after a cure) protects against that illness. Expired immunities are pruned.
  - Emits `animalSick`.
- **Contagion copies the illness:**
  - One roll decides both whether the animal gets sick and what it gets. A roll in the contagion share catches that neighbor's illness, so an outbreak is all one illness.
  - Everyone rolls against the same snapshot, so an outbreak spreads one step per minute.
- **Effects:** can't sell, can't train (`canTrain` is ready for Phase 9), and happiness drains ×2. Never fatal.
- `systems/vet.ts`:
  - `goToVet`: pays the 20 fee once, or starts the Free Clinic. Going back is free.
  - `vetExamine`: returns the tool's clues and changes nothing.
  - `vetTreat`: 10 coins. The wrong treatment is spent with no effect. The right one cures and gives immunity.
  - Events: `vetVisitStarted`, `clinicReady`, `vetTreated`, `animalCured`.
- **Free Clinic (your choice):** if coins < fee + one treatment (30), the visit and all its treatments are free after a 3-minute wait. On a paid visit, a treatment you can't afford is free too. The wait keeps running offline.
- A sick animal doesn't show the "Ready to sell" badge.
- Economy harness: both bots take sick animals to the vet (25% of the time trying one wrong treatment first). The report adds sickness cases/hour, Free Clinic visits, and vet coins.

**Save v3:** `sickness.visit` ('paid' | 'free') records a check-in, so leaving the clinic or reloading never charges twice. The v2 → v3 migration only bumps the version (nobody could be sick before v3). The game also saves after vet fees and treatments.

**World and UI**

- **Yard:** each sick animal shows its illness's icon (🤧 🤢 🐜 🐾 🌡️ 💤, or 🏥 while waiting at the Free Clinic) and a placeholder animation:
  - A drippy nose and "achoo!"
  - Green cheeks and a wobbly tummy
  - Bouncing flea dots and scratching
  - A pink sore paw and a limp
  - Red spots and a warm glow
  - Droopy eyes and floating Z's
  - All of them hold still with reduced motion.
- **Animal Card:**
  - Shows the symptoms ("Sneezing a lot"), not the diagnosis.
  - A 🩺 "Go to Vet for 20" / 🏥 "Free Clinic" / "Back to the vet" button.
  - A Free Clinic countdown, and "Ready to sell once it's better".
- **`VetScene` (Phaser):** the patient stands on an exam table with 3 big tool buttons. Tap a tool, or drag it onto the patient. It goes over, wiggles, and pops up the clue icons. A drop anywhere else sends it back to the tray. The treatment icon shows over the patient; a cure gets stars and hearts, a wrong one a head-shake and "?". The yard sleeps meanwhile.
- **Clinic panel (React):**
  - Visit type, and a clue notebook listing each clue by tool.
  - A 2×3 treatment cabinet showing the cost ("10 coins each" / "Free").
  - A waiting room with a countdown.
  - "Hmm, that didn't work. Look at the clues again."
  - An "is all better!" screen, and Back to the yard.
- **Toasts:** "Oh no, Pip looks sick!", "The vet is ready to see Pip!", and "Pip is all better!".
- **Debug Panel:** make one or all animals sick (random or chosen illness), cure all, and turn sickness rolls on/off.

**Tests**

- **Unit:** 281 in total (68 new).
  - Every multiplier and its threshold edge.
  - Contagion is same-zone only, and waiting animals aren't contagious.
  - Statistical checks over 100k rolls: base rate, fully neglected rate, all illnesses picked about evenly, contagion copies the illness.
  - One step per minute, immunity and pruning, offline, and turned off.
  - Stored vs kept pets, and the effects of sickness.
  - Fee once, and refusals.
  - Clues change nothing.
  - Each illness is cured by its own treatment and nothing else.
  - A clue-only "detective" diagnoses all 6.
  - Free Clinic rules, and a paid visit where the next treatment can't be afforded.
  - The migration, save-after-vet, and the new toasts.
- **No-stuck proof:** at 0, 1, 5, 10, 19, 20, 25, 29, 30, 31, 45, and 100 coins, six animals (one with each illness) all get cured and sold. At every step the check confirms the next action is affordable. Also a 3-hour neglected game at 0 coins recovers.
- **E2E:** 36 new runs (12 tests × 3 browser setups):
  - The symptom shows, and Sell is refused.
  - Paid visit → clue → wrong treatment → cure → sell.
  - Dragging a tool onto the patient (and not elsewhere).
  - A paid visit survives a reload.
  - The Free Clinic waiting room.
  - The Free Clinic's free cure after the wait.
  - Diagnosing and curing each of the 6 illnesses from the clues in the UI.

### Phase 4 "Done when"

- **A player can diagnose and cure all 6 illnesses:** e2e tests do it in the real UI for each illness, using only the clues shown.
- **The game can't get stuck at 0 coins with sick animals:** the unit tests above.

### Economy (24 h × 30 runs)

- A caring bot has ~9.6 illnesses/day and spends ~310 coins/day at the vet (~13/hour).
- A neglectful bot has ~19/day and spends ~630 (~26/hour).
- Gross earnings are unchanged within seed noise (different seed ranges swing ±40/hour).

### Bugs found and fixed

- **Petting sometimes opened the card instead** (a Phase 3 bug): the hold was timed only by Phaser's game-loop timer, so with slow frames a real 800 ms hold ended before the timer fired. The e2e suite exposed it under full parallel load; a slow iPad could hit it too. On release, the yard now also checks real elapsed time.
- The visitor-schedule unit test depended on seed luck (it failed once sickness rolls shifted the RNG). It now counts Crowded-skipped arrivals too.

### Defaults chosen (spec left open): please confirm or change

1. **Free Clinic** covers the visit *and* treatments when coins < 30 (fee + one treatment), after a 3-min wait. On a paid visit, a treatment you can't afford is free. (Your answer.)
2. **Contagion gives the neighbor's illness** (your answer); the base-risk share gives a random one.
3. **Specific symptom icons in the yard** (your answer). The card shows symptoms, not the illness name.
4. **Exam is optional:** you can pick a treatment before using any tool.
5. **Waiting at the Free Clinic:** the animal stays in the yard with a 🏥 icon, but isn't contagious while waiting. You can leave and come back.
6. **Immunity** is to the cured illness only (DESIGN 9.1 "the same illness").
7. **Clue texts, symptom icons, and treatment icons** are in `illnesses.ts`: edit them freely.
8. The clinic panel covers the right ~38% of the screen. The scene keeps everything left of that.

### Known issues

- "Tricky cases" (two illnesses at once) are Phase 10 per DESIGN 9.5.6. The sneeze sound is Phase 10 audio.
- Symptom animations are placeholders until the Phase 10 art pass.
- Headless test browsers show some emoji gray (🪙) in screenshots only.
- Real-device check still pending: dragging tools on an iPad, and the clinic panel on iPad mini.
