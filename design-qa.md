# Design QA — Codex Design Lab

## Comparison target

- Specimen OS source board: Product Design session asset `exec-b1581186-447f-49cf-a20b-b465966008fc`.
- Black Chamber source board: Product Design session asset `exec-950135b8-0dd7-4fda-a192-e58b4a1a1e06`.
- Hybrid Home source: owner-approved R2 `hybrid-home-desktop-1440x1024.png` and `hybrid-home-mobile-390x844.png`.
- Implementation surfaces: Home, Orbital Mk.II Case, and Free Assets for Specimen and Chamber; staged Hybrid Home with Original Case and Free Assets fallbacks.
- Exact viewports: desktop `1440×1024`; mobile `390×844`; Hybrid wide-spacing check at `1600×1050`.

## Visual evidence

The original Design Lab QA set contains twelve exact-viewport captures, two normalized source-versus-implementation boards, and one six-screen mobile contact sheet. Those session screenshots stay out of Git:

- `specimen-source-vs-implementation.png`;
- `chamber-source-vs-implementation.png`;
- `mobile-design-lab-contact-sheet.png`;
- `{specimen|chamber}-{home|case|assets}-{desktop|mobile}.png`.

Hybrid Home adds committed runtime regression baselines:

- `hybrid-home-desktop-1440x1024-win32.png`;
- `hybrid-home-mobile-390x844-win32.png`.

Each desktop source board and its implementation were inspected in normalized views. Free Assets had no original source frame, so it was judged against the selected direction's tokens, hierarchy, typography, media treatment, and navigation language.

## Comparison result

- Specimen preserves the Technical Explorer contract: persistent project index, central media stage, dossier, blueprint motif, cobalt accents, dense metadata, and all 18 projects.
- Chamber preserves the Cinematic Monolith contract: full-bleed poster stage, dominant project typography, restrained navigation, chapter-style Case flow, and poster-first media.
- Hybrid Home matches R2: Black Chamber shell, horizontal desktop pager, unchanged mobile pager, continuous dark surface, and static original grain.
- Hybrid safe insets are frozen at `48px` desktop, `64px` wide desktop, and `24px` mobile; settled anchor drift is at most `1px`.
- The intentional desktop departures support the real 18-project catalog: Specimen keeps the full index visible; Chamber and Hybrid use the compact vertical index.
- Home → Case → Back, previous/next, Copy Link, 2D/3D/Blueprints, EN/RU, Free Assets, and direct case hashes remain coherent in every enabled capability.
- Mobile layouts retain readable hierarchy, no horizontal overflow, and reachable Hybrid Home controls of at least `44×44`.
- Variant Free Assets remains poster-first. `model-viewer` and GLB load only after explicit preview activation.

The final independent `/review` found no remaining P0-P3 issues in the implemented surfaces. Runtime acceptance is complete for VIS-05.3; promotion to the default design remains out of scope.

## Issues found and resolved during QA

- Direct case deep links could leave GSAP media items transparent; the visible route now restarts the 2D reveal and has a regression assertion.
- Variant Free Assets respected `hidden` in DOM but not in layout because card CSS overrode the browser rule; a shared explicit hidden rule now protects Original and both variants.
- Fullscreen overlays could remain mounted when browser Back returned from Case to a Design Lab Home; route teardown now disposes video/WebGL state without restoring focus into hidden Case UI.
- Variant Free Assets initially auto-loaded `model-viewer`, scoring `44` in Lighthouse; poster-first opt-in loading raised the scores to `74` and `73`.
- The token-only Specimen accent refactor exposed a `4.39:1` contrast miss; the shared strong accent token restores AA and the repeated axe run passes.
- Copy Link keeps only allowlisted `design` and `lang`, strips URL credentials, and replaces only the case fragment; Hybrid is now part of that explicit allowlist.
- The initial Chamber poster swap changed `src` before decode and removed its state after two frames. Hybrid now has one motion owner with decode gating, rapid-input coalescing, route cancellation, fixed slots, and a direct reduced-motion path.

## Accessibility, motion, and performance

- Axe: zero WCAG A/AA violations on tested Home, Case, and Free Assets surfaces.
- Pa11y: zero errors on both Original public pages.
- Reduced motion: explicit coverage on Specimen, Chamber, and staged Hybrid capabilities.
- Hybrid browser contracts cover all 18 routes, EN/RU selection persistence, five sequential transitions, crossfade reversal, ten same-frame inputs, latest-input-wins, and no stuck transition classes.
- Motion QA uses decoded two-layer crossfades, fixed anchors, CLS `0`, no observed long tasks, relative host-cadence stability, and a direct reduced-motion path. The motion stress repeat passed `5/5` with two Chromium workers.
- Lighthouse accessibility: `100` on all eleven measured URLs; CLS: `0`.
- Lighthouse performance: Original `86/73`; Specimen `92/81/76`; Chamber `92/80/75`; Hybrid `84/86/75` for Home/Case fallback/Free Assets fallback.
- Opt-in SEO scores `66–69` are expected because those URLs intentionally use `noindex`; canonical Original URLs remain unchanged.
- Free Assets LCP remains about `5.8–6.2 s`, matching the Original fixture baseline rather than introducing a Design Lab regression.

## Staged Hybrid boundaries

- Original remains the default and production is unchanged.
- Hybrid Case uses the Original presentation pending VIS-05.4.
- Hybrid Free Assets uses the Original presentation pending VIS-05.5.
- R2 approval and Hybrid Home runtime acceptance do not promote Hybrid to the default.

## Fresh final verification — 2026-07-16

- `test:visual`: `6/6` pass. Four Original baselines remained stable; the two Hybrid baselines were recaptured only after the frozen runtime-ready, decoded-image, visible-controls, and double-frame settle barrier.
- `quality:deep`: pass, including static/dependency/security gates, browser `55/55`, admin `25/25`, content validation, and Pa11y `0` errors.
- `check:lighthouse`: pass on all eleven configured URLs. Accessibility `100`, best practices `96`, CLS `0`; the intentional opt-in `noindex` URLs retain documented SEO warnings.
- `test:design-lab` motion stress: `5/5` pass with two workers after replacing the host-frequency assumption with a relative cadence, jank-share, and no-long-task contract.
- Independent code, frozen-contract, visual, accessibility, and motion `/review`: PASS with no P0-P3 findings.
- `codex:ship`: pass on the final runtime/source tree, including Design Lab `52/52` and frozen verification `137 PASS`, `0 FAIL`, `1` dormant skip. No runtime/source edits follow this recorded run.

final result: VIS-05.3 runtime accepted for draft PR; Original remains default
