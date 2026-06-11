---
name: codex-studio-admin-rules
description: Use when working on the Codex Studio content layer or admin panel - editing content/*.json, scripts/generate-content.mjs, GEN regions in index.html/free-assets.html/sitemap.xml, admin/, netlify/functions/cms-auth.mjs, or the content-publish pipeline. Provides the content-vs-generated contract, publish pipeline semantics, media naming, and test commands.
---

# Codex Studio Admin Rules

Rules for the content layer (iterations B-H of the admin-panel project).
Full spec and session journal: `docs/agent/admin-panel/` (`tz.md`, `handoff.md`).

## Content contract

- Site content is edited ONLY in `content/*.json` (`settings.json`,
  `cases/{id}.json`, `free-assets.json`, `i18n-ui.json`, `meta.json`).
- `scripts/generate-content.mjs` deterministically derives the shipped files:
  `js/cards-data.js`, `js/fa-data.js`, `js/i18n-data.js`, the
  `<!-- CODEX:GEN ... -->` regions of `index.html` / `free-assets.html`
  (cards-grid, filters, head-meta, jsonld, fa-filters) and `sitemap.xml`.
- Visibility: cases, filter categories, free-assets items AND free-assets
  categories accept an optional strict-boolean `enabled:false`; every
  consumer (data files, locales, GEN regions, JSON-LD) reads the visible
  selection only. At least one case and one free asset must stay visible.
- NEVER hand-edit generated targets or GEN regions. After editing content run
  `npm run content:generate`; `npm run content:check` must report zero diffs.
- Runtime never reads `content/*.json`; the deployed site equals the
  generated files committed to the repo (no build step on Netlify).

## Publish pipeline (iteration C)

- The admin panel commits ONLY `content/**` to `main` (one atomic commit,
  message `content: ... [admin]`).
- `.github/workflows/content-publish.yml` regenerates, runs `npm run verify`,
  recaptures golden fixtures, and bot-commits the result
  (`[content-publish]`); on failure it auto-reverts the content commits
  (`[content-publish-revert]`). Never imitate or race these bot commits.
- `npm run test:golden` pins the CURRENT published content. After a
  legitimate content change CI recaptures fixtures;
  run `scripts/capture-content-golden.mjs` locally only when intentionally
  updating the golden baseline.

## Admin panel architecture

- `admin/` is a vanilla no-build app: `js/api.js` (GitHub client),
  `js/state.js` (drafts, validation mirror, pending media),
  `js/preview.js` (draft preview in a same-origin iframe),
  `js/ui.js` (hash router and screens). Classic scripts, this order.
- Login: GitHub OAuth via `netlify/functions/cms-auth.mjs` or a fine-grained
  PAT. Tokens live in sessionStorage only. `robots.txt` disallows `/admin/`.
- Client-side validation in `state.js` mirrors `validateContent()` from the
  generator - keep both sides in sync when adding rules.
- Tests: `npm run test:admin` (Playwright, GitHub API fully mocked).

## Media rules

- Uploaded files get cache-bust names `{base}-{hash8}.{ext}` (first 8 hex of
  the content SHA-256) because `/assets/*` ships with a one-year immutable
  cache. Replaced files are NOT deleted (deleting would 404 production until
  the bot commit lands); orphan cleanup is a separate maintenance task.
- Every media path must stay inside `./assets/` (traversal guard in the
  validator and in `state.js`).
- Free-assets `thumb`/`model` are BASE NAMES, not paths (runtime appends
  `./assets/cards/{base}.svg` / `./assets/models/free/{base}.glb`): absent
  key = the item id, `null` = preview disabled, replacement uploads write
  the base name `{id}-{hash8}` (`stageMedia` valueMode `baseName`). The FA
  poster slot accepts ONLY `.svg` - the runtime hardcodes the extension.

## Verification

- `verify-frozen.js` derives expectations (card ids, filters, motion
  contract, JSON-LD featured list, sitemap images, FA counters) from
  `content/` - extend by derivation, never by re-pinning literals that the
  owner can change through the admin panel.
- Gate commands: `npm run content:check`, `npm run test:golden`,
  `npm run test:content-validate`, `npm run test:admin`,
  `npm run codex:ship` before any commit.
