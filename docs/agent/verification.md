# Verification

Primary command:

```bash
npm run verify
```

Success means the command exits cleanly and reports `0 FAIL`. Do not hard-code an old expected pass count in instructions or hooks.

## When To Run

Run after changes to:

- `index.html`
- `free-assets.html`
- `verify-frozen.js`
- `css/*.css`
- non-vendor `js/*.js`
- `js/vendor/codex-three-viewer.js`
- any instruction change that modifies the verification workflow itself

## What The Suite Covers

The current suite covers static file checks, script order, metadata, free-assets JSON-LD depth, sitemap/robots pointers, i18n, card IDs, tag filters, case UI, 3D boundaries, theme toggle, axe budgets, image attributes, font-display, console errors, and mobile language controls.

## Asset Byte And 3D Runtime Gates

`scripts/asset-budget.mjs` is the repository byte-policy canon. The admin panel
keeps a classic-script mirror in `admin/js/state.js`; hard limits match the
canon, while advisory values remain intentionally slot-specific. Binary units
and strict upper-bound comparisons apply:

| Surface and class | Advisory band | Block when |
| --- | ---: | ---: |
| Repository model and admin model | `(25 MiB, 50 MiB]` | `> 50 MiB` |
| Repository vector or raster | `(256 KiB, 2 MiB]` | `> 2 MiB` |
| Admin image, OG, logo, or Free Assets thumbnail | `(200 KiB, 2 MiB]` | `> 2 MiB` |
| Admin blueprint | `(500 KiB, 2 MiB]` | `> 2 MiB` |

Exactly 25 MiB is warning-free for a model, exactly 50 MiB is allowed with an
advisory, and exactly 2 MiB is allowed for SVG and raster uploads. General
advisory parity is not a contract: only the model warning is a focused
repository/admin parity exception.

A passing byte gate never replaces browser/runtime proof. The generic viewer
and pagination assertions run first on the primary page against the smallest
visible referenced model and accept either inline `model-data.js` resolution
or an HTTP model response. The external heaviest-model acceptance runs last on
a dedicated normal-motion page, requires an exact 2xx GLB response and normal
Clay/Xray/PBR interactions, and closes the page only after the verified return
to PBR.

One absolute deadline covers that complete heaviest-model scenario, not each
phase separately:

- `<= 120,000 ms`: pass within target;
- `(120,000, 210,000] ms`: pass with the literal marker `PERF_WARN`;
- `> 210,000 ms`: fail as a runtime/model blocker.

Non-2xx response, missing readiness, wrong material state, page or console
error, and unexpected WebGL context loss fail regardless of elapsed time. The
210-second ceiling is CI-operability headroom, not an end-user performance SLA.

## Related Gates

```bash
npm run quality:governance
npm run check:assets
npm run content:check
npm run test:golden
npm run test:content-validate
npm run test:admin
npm run test:visual
```

`quality:governance` protects active instructions, package scripts, script-order policy, public-runtime no-storage/no-import-map constraints, and shared-runtime drift.

`check:assets` resolves the referenced shipped asset set, reports canonical
warnings, rejects hard-limit violations, and verifies admin hard-limit plus
focused model-warning parity.

`content:check` validates the editable content layer (`content/**`) and proves the generated targets (`js/cards-data.js`, `js/fa-data.js`, `js/i18n-data.js`, the `index.html` GEN region) match it byte-for-byte after EOL normalization. It runs inside `quality:fast` and `codex:ship`.

`test:golden` pins the current runtime data and grid markup against golden fixtures. After an intentional content edit it legitimately fails until fixtures are recaptured, which is why the `content-publish` workflow does not run it.

`test:content-validate` is the negative self-test for the content validator: it breaks a temp copy of `content/` and asserts every violation is reported. It runs inside `quality:deep`.

`test:admin` is the admin panel smoke (`admin/` served statically, the whole GitHub API mocked via `page.route`): login screen, PAT login, case list from the real `content/`, draft autosave across reload, Russian client-side validation, and the fully mocked Git Data API publish path. It runs inside `quality:deep`.

`test:visual` protects reviewed Playwright visual baselines for stable desktop and mobile surfaces. Update snapshots only after manual screenshot review.

## Reporting

In final updates, report whether verification passed. If it could not be run, say why and list residual risk.
