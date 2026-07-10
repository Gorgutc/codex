# Design QA — Codex Design Lab

## Comparison target

- Specimen OS source board: Product Design session asset `exec-b1581186-447f-49cf-a20b-b465966008fc`.
- Black Chamber source board: Product Design session asset `exec-950135b8-0dd7-4fda-a192-e58b4a1a1e06`.
- Implementation surfaces: Home, Orbital Mk.II Case, and Free Assets for both modes.
- Exact viewports: desktop `1440×1024`; mobile `390×844`.

## Visual evidence

The final local QA set contains twelve exact-viewport captures, two normalized source-versus-implementation boards, and one six-screen mobile contact sheet. These screenshots stay out of Git; their session filenames are:

- `specimen-source-vs-implementation.png`;
- `chamber-source-vs-implementation.png`;
- `mobile-design-lab-contact-sheet.png`;
- `{specimen|chamber}-{home|case|assets}-{desktop|mobile}.png`.

Each desktop source board and its Home/Case implementation were inspected in one combined image. Free Assets had no source frame, so it was judged against the selected direction's tokens, hierarchy, typography, media treatment, and navigation language.

## Comparison result

- Specimen preserves the Technical Explorer contract: persistent project index, central media stage, dossier, blueprint motif, cobalt accents, dense metadata, and all 18 projects.
- Chamber preserves the Cinematic Monolith contract: full-bleed poster stage, dominant project typography, restrained navigation, chapter-style Case flow, and poster-first media.
- The intentional desktop departures support the real 18-project catalog: Specimen keeps the full index visible; Chamber adds a compact vertical index rather than limiting the first fold to four projects.
- Home → Case → Back, previous/next, Copy Link, 2D/3D/Blueprints, EN/RU, Free Assets, and direct case hashes remain one coherent system in both modes.
- Mobile layouts retain readable hierarchy, no horizontal overflow, and reachable controls of at least `44×44`.
- Variant Free Assets remains poster-first. `model-viewer` and GLB load only after explicit preview activation.

No remaining P0, P1, or P2 visual differences were found.

## Issues found and resolved during QA

- Direct case deep links could leave GSAP media items transparent; the visible route now restarts the 2D reveal and has a regression assertion.
- Variant Free Assets respected `hidden` in DOM but not in layout because card CSS overrode the browser rule; a shared explicit hidden rule now protects Original and both variants.
- Fullscreen overlays could remain mounted when browser Back returned from Case to a Design Lab Home; route teardown now disposes video/WebGL state without restoring focus into hidden Case UI.
- Variant Free Assets initially auto-loaded `model-viewer`, scoring `44` in Lighthouse; poster-first opt-in loading raised the scores to `74` and `73`.
- The token-only Specimen accent refactor exposed a `4.39:1` contrast miss; the shared strong accent token restores AA and the repeated axe run passes.
- Copy Link now keeps only allowlisted `design` and `lang`, strips URL credentials, and replaces only the case fragment.

## Accessibility, motion, and performance

- Axe: zero WCAG A/AA violations on Home, Case, and Free Assets in both modes.
- Pa11y: zero errors on both Original public pages.
- Reduced motion: explicit coverage on Home, Case, and Free Assets in both modes.
- Lighthouse accessibility: `100` on all eight measured URLs; CLS: `0`.
- Lighthouse performance: Specimen `87/92/74` and Chamber `90/92/73` for Home/Case/Free Assets.
- Variant SEO score `66` is expected: opt-in URLs intentionally use `noindex` and canonical Original URLs.
- Free Assets LCP remains about `6.0–6.4 s`, matching the Original fixture baseline rather than introducing a Design Lab regression.

## Final verification

- `npm run codex:ship`: pass.
- Design Lab/admin preview suite inside ship: `36/36` pass.
- Frozen verification: `137 PASS`, `0 FAIL`, `1` dormant skip.
- Browser smoke plus frozen visual baselines: `43/43` pass.
- `quality:fast`: pass.
- Knip, JSCPD, content validation, dependency audit, and Pa11y: pass.
- Lighthouse: all configured gates pass; expected `noindex` SEO warnings only.
- Independent code `/review`: SHIP, no remaining P0–P3 findings.

final result: passed
