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
- any instruction change that modifies the verification workflow itself

## What The Suite Covers

The current suite covers static file checks, script order, metadata, i18n, card IDs, tag filters, case UI, 3D boundaries, theme toggle, axe budgets, image attributes, font-display, console errors, and mobile language controls.

## Reporting

In final updates, report whether verification passed. If it could not be run, say why and list residual risk.
