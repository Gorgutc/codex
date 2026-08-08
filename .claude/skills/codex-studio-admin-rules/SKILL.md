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
- Runtime never reads `content/*.json`; the deployed site equals the generated
  files committed to the repo. There is no host-side build step; `deploy-beget`
  mirrors the settled `main` revision to Beget production.

## Publish pipeline (iteration C)

- The admin panel commits `content/**` plus any newly uploaded `assets/**` in
  one atomic commit (message `content: ... [admin]`). No other paths are valid.
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

### Budget contract

`scripts/asset-budget.mjs` is the repository byte-policy canon;
`admin/js/state.js` keeps the intentional classic-script `MEDIA_RULES` mirror.
Every mapped admin `blockBytes` value matches the repository hard limit.
Advisory values stay slot-specific except for the model warning, which must
match the canon.

| Surface and class | Advisory band | Block when |
| --- | ---: | ---: |
| Repository model and admin model | `(25 MiB, 50 MiB]` | `> 50 MiB` |
| Repository vector or raster | `(256 KiB, 2 MiB]` | `> 2 MiB` |
| Admin image, OG, logo, or Free Assets thumbnail | `(200 KiB, 2 MiB]` | `> 2 MiB` |
| Admin blueprint | `(500 KiB, 2 MiB]` | `> 2 MiB` |

Binary units and strict `>` comparisons apply: exactly 25 MiB is warning-free
for GLB, exactly 50 MiB is advisory but allowed, and exactly 2 MiB is accepted
for SVG and raster. `blueprint` maps to the repository `vector` hard limit. Do
not create general advisory parity between the admin and repository image
rules.

- Both case-editor and Free Assets model hints derive their 25/50 MiB values
  from `State.getMediaRule('model')`; do not add another numeric UI mirror.
- Passing the upload byte gate does not prove 3D operability. Refer to
  `docs/agent/verification.md` for the mandatory 120/210-second runtime gate,
  smallest-model generic check, adjacent non-heaviest pagination pair, and
  external heaviest-model proof after the primary page closes.

### Upload mechanics

- Uploaded files get cache-bust names `{base}-{hash8}.{ext}` (first 8 hex of
  the content SHA-256) so every upload has a stable content identity across
  carrier caches. Beget currently caches asset types for seven days;
  `netlify.toml` keeps Netlify previews revalidating after one day. Neither
  carrier uses a one-year immutable asset policy. Replaced files are NOT
  deleted so existing production and rollback references stay valid while the
  source commit settles and the Beget mirror runs; orphan cleanup is a
  separate maintenance task.
- Every media path must stay inside `./assets/` (traversal guard in the
  validator and in `state.js`).
- Free-assets `model` is a BASE NAME, not a path (runtime appends
  `./assets/models/free/{base}.glb`): absent key = the item id, `null` =
  preview disabled, replacement uploads write the base name `{id}-{hash8}`
  (`stageMedia` valueMode `baseName`).
- Free-assets posters (`thumb`, `category.tagCard.thumb`) accept EITHER that
  historical base name (still `./assets/cards/{base}.svg`) OR a full
  `./assets/...` path carrying its own extension - that is how a raster render
  (`svg`/`png`/`jpg`/`webp`) replaces the SVG placeholder (FA-POSTER-01).
  Uploads write the full path (`stageMedia` with no valueMode). A raster
  poster additionally sets `data-poster-kind="raster"` on the thumb slot, which
  weakens the branded veil in `css/free-assets.css`; a vector poster emits NO
  attribute, so an all-SVG catalog keeps its generated bytes.
- `scripts/fa-poster-path.mjs` is the ONE poster parser: the generator, the
  orphan audit and `scripts/content-expectations.mjs` import it; `js/free-assets.js`,
  `admin/js/state.js` and `admin/js/preview.js` mirror the same segment walk
  because classic scripts cannot import. Rules: forward slashes only, a path
  form starts with `./assets/`, every segment is non-empty, not `.`/`..`, and
  matches `[A-Za-z0-9._-]`; the extension is allowlisted; the poster KIND comes
  from the RESOLVED path. Non-canonical spellings (`//`, `/./`, trailing slash)
  are REJECTED, never normalized - a value that resolves differently in any one
  consumer is how `clean-orphan-assets --delete` deletes a live poster. The
  charset rule is also what removes URL-encoding: generator and runtime emit the
  same bytes with no encode step. An absent `tagCard.thumb` falls back to the
  category key through `faTagCoverValue` - one fallback, not three.
- Never write a test that asserts something about the OWNER'S current content
  ("no category uses a raster cover"). The first legitimate publish then breaks
  a mandatory gate. Author the control case inside the sandbox/fixture instead.

## Verification

- `verify-frozen.js` derives expectations (card ids, filters, motion
  contract, JSON-LD featured list, sitemap images, FA counters) from
  `content/` - extend by derivation, never by re-pinning literals that the
  owner can change through the admin panel.
- Gate commands: `npm run content:check`, `npm run test:golden`,
  `npm run check:assets`, `npm run test:content-validate`, `npm run test:admin`,
  `npm run verify` after model or shipped asset-reference changes, and
  `npm run codex:ship` before any commit.
