# Preview Contract

This note records the current production-facing preview rules for Sprint A cleanup.

## Portfolio Cards

- Every active work card keeps its stable `data-id` and uses `./assets/cards/<id>.svg` as the first-frame preview.
- The CAD cards may keep `data-cad-placeholder="true"` as an internal replacement marker, but visible titles, descriptions, alt text, and case copy must read as production-facing CAD studies.
- If a future card lacks a final preview asset, do not present it as shipped work until the copy, alt text, and verifier exception are intentionally updated together.

## Case View

- Case media and captions live in `CARDS_DATA` in `js/main.js` and are mirrored by `CASE_LOCALES` in `js/i18n-data.js`.
- Updating case copy requires changing the runtime data and the i18n overlay together so language toggles cannot restore stale text.
- `js/model-data.js` remains out of scope unless the user explicitly asks to change model metadata.

## Free Assets

- Free asset rows live in `js/fa-data.js`; rendered card markup lives in `js/free-assets.js`.
- `thumb: null` disables the SVG thumbnail only. A local GLB preview is still expected for rendered catalog cards.
- `verify-frozen.js` currently asserts that rendered free-asset cards have mini 3D previews with local `./assets/models/free/*.glb` sources.

## Guards

- `scripts/verify-codex-plugin.mjs` blocks stale active instruction pass totals such as historic `N/N PASS` expectations.
- `verify-frozen.js` blocks known debug copy and visible placeholder copy in shipped site data.
- Verification success is always `0 FAIL`; the pass total may change as the suite grows.
