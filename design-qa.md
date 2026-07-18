# Design QA — Codex Design Lab

## Comparison target

- Specimen OS source board: Product Design session asset `exec-b1581186-447f-49cf-a20b-b465966008fc`.
- Black Chamber source board: Product Design session asset `exec-950135b8-0dd7-4fda-a192-e58b4a1a1e06`.
- Hybrid R2 sources: the owner-approved Home, Orbital Mk.II Case, and Free Assets desktop/mobile boards in the Second Brain Design Lab reference folder.
- Exact viewports: desktop `1440×1024`; mobile `390×844`; wide-spacing check `1600×1050`.

## Visual evidence

The original Design Lab comparison captures remain session-only artifacts outside Git. Stable reviewed surfaces are protected by committed Playwright baselines:

- four Original Home/Free Assets desktop/mobile baselines;
- `hybrid-home-desktop-1440x1024-win32.png`;
- `hybrid-home-mobile-390x844-win32.png`;
- `hybrid-case-desktop-1440x1024-win32.png`;
- `hybrid-case-mobile-390x844-win32.png`;
- `hybrid-free-assets-desktop-1440x1024-win32.png`;
- `hybrid-free-assets-mobile-390x844-win32.png`.

Each Hybrid source and runtime capture was inspected side by side at the same viewport and state before its baseline was accepted.

## Comparison result

- Specimen preserves the Technical Explorer contract: persistent project index, central media stage, dossier, blueprint motif, cobalt accents, dense metadata, and all 18 projects.
- Chamber preserves the Cinematic Monolith contract: full-bleed poster stage, dominant project typography, restrained navigation, chapter-style Case flow, and poster-first media.
- Hybrid Home matches R2: Black Chamber shell, horizontal desktop pager, unchanged mobile pager, continuous dark surface, and original grain.
- Hybrid Case combines Specimen anatomy with Black Chamber treatment: fixed media stage, compact dossier, coherent 2D/3D/Blueprints controls, and narrative spacing of `48px`, `64px`, and `24px`.
- Hybrid Free Assets keeps the Chamber shell with equal Specimen cards in a responsive `3/2/2/1` grid and explicit poster-first 3D activation.
- Hybrid Home safe insets are frozen at `48px` desktop, `64px` wide desktop, and `24px` mobile; settled anchor drift is at most `1px`.
- Home → Case → Back, previous/next, Copy Link, 2D/3D/Blueprints, EN/RU, Free Assets, and direct hashes remain coherent.
- Mobile has no horizontal overflow; tested visible controls meet the `44×44` target.

## Issues resolved during QA

- Hybrid CSS initially remained active after an optional-runtime failure. Global Hybrid tokens and controls now require `data-design-runtime-state="ready"`; fail-open restores the Original surface and visible theme control.
- Case now has one idempotent Hybrid dossier and one first-media hero without moving the frozen media DOM or adding a second route owner.
- The Case lifecycle regression covers 2D → Blueprints → 3D and proves teardown before returning Home.
- Hybrid Free Assets originally lacked its own complete interaction contract. Tests now cover filter, empty state, EN/RU, download, opt-in model runtime, fullscreen cleanup, focus return, and poster-first loading.
- The Free Assets fullscreen close target inherited `32×32` on mobile. The scoped Hybrid target is now at least `44×44`.
- A preloader optimization experiment produced noisy Lighthouse regressions and a large formatting diff. Both were removed; the final runtime keeps the proven frozen preloader.

## Accessibility, motion, and performance

- Axe: zero WCAG A/AA violations on tested Home, Case, and Free Assets surfaces.
- Pa11y: zero errors on both Original public pages.
- Reduced motion: explicit coverage on Specimen, Chamber, and all Hybrid surfaces.
- Hybrid contracts cover all 18 routes, EN/RU persistence, ten sequential transitions, crossfade reversal, ten same-frame inputs, latest-input-wins, and no stuck transition state.
- Motion QA uses decoded two-layer crossfades, a single color-graded media stack, fixed anchors, CLS `0`, no observed long tasks, and a direct reduced-motion path. Its dedicated one-worker gate pairs ten transitions with nearby idle controls, rejects results confidently above the 15% excess-jank budget through transition-level block resampling, and applies a 20% gross ceiling.
- Lighthouse accessibility is `100` on all eleven measured URLs; CLS is `0`.
- Three-run Lighthouse performance medians: Original `81/76`; Specimen `82/77/76`; Chamber `85/84/74`; Hybrid `83/80/73` for Home/Case/Free Assets. Hybrid deltas against Chamber are `-2/-4/-1`, inside the agreed five-point bound; every measured URL kept accessibility `100`, best practices `96`, and CLS `0`.
- Opt-in SEO scores of `66` are expected because Design Lab URLs intentionally use `noindex`; canonical Original URLs remain unchanged.

## Current boundaries

- Original remains the default design.
- Hybrid Home, Case, and Free Assets are opt-in through `?design=hybrid`.
- Production deployment is separate from source and draft-PR acceptance; this document does not claim that `codex.promo` has been updated.
- VIS-05.4 and VIS-05.5 do not promote Hybrid to the default.
- VIS-05.6 remains the owner review and polish pass before any promotion decision.
- VIS-05.6 still owns automating the now-recorded three-run baseline with an immutable source hash and an explicit Hybrid-versus-Chamber parity assertion.

## Fresh final verification — 2026-07-18

- `test:visual`: `10/10` pass.
- `quality:deep`: pass, including browser `56/56`, the isolated motion gate `1/1`, admin `25/25`, content validation, dependency/security/static gates, and Pa11y `0` errors.
- `check:lighthouse`: completed on all eleven configured URLs with expected opt-in `noindex` SEO warnings; accessibility `100`, best practices `96`, and CLS `0`.
- Hybrid lifecycle coverage includes all 18 cases, 2D/3D/Blueprints teardown, transition stress, Free Assets interaction cleanup, and the `44×44` mobile close target.
- Independent code, frozen-contract, visual, accessibility, performance, and motion review: PASS with no P0-P2 findings. Tablet visual polish and small deadwood cleanup remain P3 follow-ups for VIS-05.6.
- `codex:ship`: pass on the final runtime/source tree, including the focused Design Lab suite and frozen verification with `0 FAIL`. No runtime/source edits follow this recorded run.

final result: passed — VIS-05.4 and VIS-05.5 accepted for draft PR; Original remains default and VIS-05.6 remains open
