---
name: codex-studio-assets
description: Use for Codex Studio images, SVG cards and case slides, GLB models, HDR maps, favicons, OG images, downloads, asset naming, lazy loading, and media optimization.
---

# Codex Studio Assets

## Asset Rules

- Portfolio IDs couple cards, case slides, GLB models, i18n data, and tests.
- Do not edit `js/model-data.js` by hand unless the user explicitly asks; it is large inline GLB data and is lazy-loaded.
- Runtime GLB handling and `<model-viewer>` are lazy. Current app logic loads the self-hosted model-viewer bundle through `js/shared-runtime.js`, not Google APIs or legacy jsdelivr docs.
- Downloads may be placeholders until the user supplies real archives; do not treat placeholder archives as dead runtime code without user confirmation.
- OG images are page-specific: index uses `og-image.jpg`, free assets uses `og-free-assets.jpg`.

## Byte Policy

`scripts/asset-budget.mjs` is the repository canon. `admin/js/state.js` is an
intentional classic-script mirror: every admin hard limit matches the canon,
but advisory values remain slot-specific except for the focused model-warning
parity check.

| Surface and class | Advisory band | Block when |
| --- | ---: | ---: |
| Repository model and admin model | `(25 MiB, 50 MiB]` | `> 50 MiB` |
| Repository vector or raster | `(256 KiB, 2 MiB]` | `> 2 MiB` |
| Admin image, OG, logo, or Free Assets thumbnail | `(200 KiB, 2 MiB]` | `> 2 MiB` |
| Admin blueprint | `(500 KiB, 2 MiB]` | `> 2 MiB` |

Comparisons use binary units and strict `>` hard stops. Exactly 25 MiB is
warning-free for GLB, exactly 50 MiB is advisory but allowed, and exactly
2 MiB is allowed for SVG and raster uploads. Do not normalize the intentionally
different repository and admin image advisories.

## Runtime Proof

A warning-free model is not runtime-approved by size alone. In `npm run verify`:

- the generic viewer opens first on the smallest visible referenced model and
  accepts inline `model-data.js` or HTTP resolution; nine pagination remounts
  then alternate through a content-derived adjacent non-heaviest pair, require
  the expected settled case after every step, and fail closed when no such pair
  exists with two or more visible cases;
- the external heaviest model runs last on a dedicated normal-motion page,
  requires an exact 2xx GLB response and normal Clay/Xray/PBR interactions, and
  starts only after the primary page closes and closes only after the verified
  return to PBR;
- one absolute deadline covers the complete heaviest-model scenario:
  `<= 120,000 ms` passes, `(120,000, 210,000] ms` passes with literal
  `PERF_WARN`, and `> 210,000 ms` fails. It is not a per-phase timeout or a UX
  performance SLA.

Run `npm run check:assets` after asset additions or reference changes. Run
`npm run verify` after asset-reference changes in shipped HTML/CSS/JS or any
3D-model change; use `npm run test:verify-fatal` when changing the runtime gate.
