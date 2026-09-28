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
