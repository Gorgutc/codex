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

## Related Gates

```bash
npm run quality:governance
npm run content:check
npm run test:golden
npm run test:content-validate
npm run test:admin
npm run test:visual
```

`quality:governance` protects active instructions, package scripts, script-order policy, no-storage/no-import-map constraints, and shared-runtime drift.

`content:check` validates the editable content layer (`content/**`) and proves the generated targets (`js/cards-data.js`, `js/fa-data.js`, `js/i18n-data.js`, the `index.html` GEN region) match it byte-for-byte after EOL normalization. It runs inside `quality:fast` and `codex:ship`.

`test:golden` pins the current runtime data and grid markup against golden fixtures. After an intentional content edit it legitimately fails until fixtures are recaptured, which is why the `content-publish` workflow does not run it.

`test:content-validate` is the negative self-test for the content validator: it breaks a temp copy of `content/` and asserts every violation is reported. It runs inside `quality:deep`.

`test:admin` is the admin panel smoke (`admin/` served statically, the whole GitHub API mocked via `page.route`): login screen, PAT login, case list from the real `content/`, draft autosave across reload, Russian client-side validation, and the fully mocked Git Data API publish path. It runs inside `quality:deep`.

`test:visual` protects reviewed Playwright visual baselines for stable desktop and mobile surfaces. Update snapshots only after manual screenshot review.

## Reporting

In final updates, report whether verification passed. If it could not be run, say why and list residual risk.
