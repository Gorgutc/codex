# Codex Studio Admin Evolution Release A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make published content self-refresh on normal browser reload, add safe editable case URLs, preserve recoverable publication state, improve the existing media-editor workflow and accessibility, and expose critical global site identity through the admin.

**Architecture:** Keep `content/*.json` as the source of truth and `scripts/generate-content.mjs` as the deterministic compiler for the static site. Add content-hash query revisions to generated data scripts, keep case ids internal while routing public hashes through canonical slugs and aliases, and extend the existing tab-scoped admin state with a source-SHA-bound publication ledger. Recompose existing admin controls and tokens rather than introducing a new design system.

**Tech Stack:** Vanilla HTML/CSS/classic JavaScript, Node.js ESM generation and validation, Playwright, GitHub Git Data API and Actions, Beget static hosting.

**Spec:** `docs/superpowers/specs/2026-08-22-admin-evolution-design.md`

## Global Constraints

- Preserve the current Codex Studio visual language, tokens, typography, dark theme, density, and no-build vanilla architecture; no Figma, framework, bundler, first-party module script, or new public runtime storage.
- Code implementation is owned by `gpt-5.6-terra` workers. The controller reviews every diff, checks the worker's red/green evidence, and owns final acceptance.
- Never hand-edit `js/cards-data.js`, `js/fa-data.js`, `js/i18n-data.js`, `sitemap.xml`, or `CODEX:GEN` regions; use `npm run content:generate`.
- Do not rename a case id, JSON filename, asset directory, `cardOrder` entry, or `featuredWorks[].id`.
- Existing content remains valid with effective `slug=id`; no current public hash is intentionally broken.
- Tests derive ids, counts, visible categories, and block availability from controlled fixtures or content; no new current-owner-content literals.
- Preserve script order, i18n, lazy 3D loading, design modes, media path/MIME/size validation, content-publish auto-revert, and the rule that generated replacement assets are retained for rollback.
- Locally, Playwright commands use `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers` because this Ubuntu 26.04 host reuses the installed compatible Chromium through that temporary path.
- Run `npm run codex:ship` before implementation commits are pushed or a PR is opened. Do not edit `.claude/**` mirrors directly.

---

### Task 1: Deterministic generated-data cache revisions

**Files:**

- Modify: `tests/quality/content-visibility.test.mjs`
- Modify: `tests/quality/content-golden.spec.mjs`
- Modify: `tests/quality/admin-preview.spec.mjs`
- Modify: `tests/quality/design-modes.spec.mjs`
- Modify: `scripts/generate-content.mjs`
- Modify: `scripts/check-governance.mjs`
- Modify: `admin/js/preview.js`
- Modify: `verify-frozen.js`
- Modify via generator only: `index.html`
- Modify via generator only: `free-assets.html`
- Modify: `admin/index.html` only through the generator's exact data-script rewrite
- Modify: `.github/workflows/content-publish.yml` to include `admin/index.html` in generated-diff detection and the generated commit allowlist

**Interfaces:**

- Produces in `scripts/generate-content.mjs`:
  - `generatedPayloadVersion(source: string): string` — full lowercase 64-character SHA-256 of the exact emitted UTF-8 source.
  - `versionedDataScriptSrc(fileName: string, source: string): string` — `./js/<fileName>?v=<digest>`.
  - `replaceDataScriptSrc(html: string, filePath: string, fileName: string, source: string): string` — replaces exactly one matching data-script URL while preserving every other byte.
- `admin/js/preview.js::replaceDataScript()` identifies a source by `new URL(rawSrc, doc.baseURI).pathname`, ignoring only its query/hash.
- Consumers in later tasks may assume all three generated data globals load from query-versioned classic script URLs.

- [ ] **Step 1: Add generator RED assertions.** In the existing content sandbox, add literal SHA-256 expectations for all public/admin data-script references. Mutating one case title must change `cards-data` and `i18n-data` versions but not `fa-data`; mutating one Free Assets description must change `fa-data` and `i18n-data` but not `cards-data`; both public pages and the admin must use the same `i18n-data` version. The production mutation that must fail this test is “emit a bare stable data URL or hash content inputs instead of final emitted JS bytes.”

- [ ] **Step 2: Verify RED.** Run `node tests/quality/content-visibility.test.mjs`. Require failure because the current pages contain bare `./js/*-data.js` URLs.

- [ ] **Step 3: Add the returning-browser RED scenario.** In `content-golden.spec.mjs`, use one browser context and a controlled server response. First serve/cache legacy bare data URLs with `Cache-Control: public, max-age=31536000, immutable`; then serve regenerated HTML with the real versioned URLs and changed sentinel globals. Assert that the second normal navigation requests the versioned URLs and observes all new sentinel values without clearing context/cache or adding a test-only query. The production mutation that must fail is “remove the generated `?v=` from any data payload.”

- [ ] **Step 4: Verify browser RED.** Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npx playwright test tests/quality/content-golden.spec.mjs --workers=1`. Require the new scenario to fail against stable URLs for the expected stale-global reason.

- [ ] **Step 5: Implement exact-byte revisions.** Import `createHash` from `node:crypto`. Materialize `cardsJs`, `faJs`, and `i18nJs` once at the beginning of `buildTargets()`. Implement the three interfaces above and rewrite only the expected tags in `index.html`, `free-assets.html`, and `admin/index.html`. Require exactly one tag per expected payload and throw an error naming the shell and file when zero or multiple matches exist. Return the same materialized strings as the JS targets and include `admin/index.html` as a generated target.

- [ ] **Step 6: Keep pipeline generation atomic.** Add `admin/index.html` to both the workflow's generated-diff path list and `git add` list. Do not broaden the workflow to any other admin file.

- [ ] **Step 7: Repair preview and test interception.** Change `replaceDataScript()` to compare URL pathnames. Update the one exact Design Lab `i18n-data.js` route/unroute to a query-tolerant regular expression. Strengthen index and Free Assets preview tests so versioned public tags are replaced by blob-backed draft scripts and the draft globals render.

- [ ] **Step 8: Make governance and frozen verification query-aware.** Require exactly one `v` parameter matching `^[0-9a-f]{64}$` and the SHA-256 of the referenced local payload. Preserve the existing relative script order. Permit a query only on the three generated data files; a query on application/vendor scripts remains a governance failure.

- [ ] **Step 9: Regenerate and verify GREEN.** Run `npm run content:generate`, then the Step 2 and Step 4 commands, `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npx playwright test tests/quality/admin-preview.spec.mjs --workers=1`, and the focused Design Lab slow-bootstrap test. Require all new cache tests to pass.

- [ ] **Step 10: Run scoped gates and self-review.** Run `npm run content:check`, `npm run check:governance`, `npm run test:content-validate`, and `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:golden`. Inspect the diff for hand-edited generated content, query revisions on non-data scripts, changed classic-script order, or current-content literals.

- [ ] **Step 11: Commit.** Commit only Task 1 as `fix(admin): version generated content payloads`.

### Task 2: Stable internal ids with editable public slugs and aliases

**Files:**

- Create: `scripts/case-slug.mjs`
- Modify: `scripts/generate-content.mjs`
- Modify: `scripts/content-expectations.mjs`
- Modify: `js/main.js`
- Modify: `js/design-specimen.js`
- Modify: `js/design-chamber.js`
- Modify: `admin/js/state.js`
- Modify: `admin/js/ui.js`
- Modify: `admin/js/preview.js`
- Modify: `verify-frozen.js`
- Modify: `tests/quality/content-validate.test.mjs`
- Modify: `tests/quality/content-visibility.test.mjs`
- Create: `tests/quality/admin-slugs.spec.mjs`
- Modify: `tests/quality/admin-preview.spec.mjs`
- Modify: `tests/quality/design-modes.spec.mjs`
- Modify: `package.json`
- Generate via command: `js/cards-data.js`, public HTML/JSON-LD, golden fixtures

**Interfaces:**

- `scripts/case-slug.mjs` exports:
  - `CASE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
  - `effectiveCaseSlug(caseData): string` — explicit slug or id.
  - `caseRouteTokens(caseData): string[]` — stable id, canonical slug, then legacy aliases, de-duplicated in that order.
  - `caseSlugViolations(caseData, where): string[]` — local shape/grammar/redundancy diagnostics.
- `scripts/content-expectations.mjs` exports a content-derived visible case route map for verification.
- `window.CodexCase` adds:
  - `publicSlugForId(id): string|null`.
  - `resolveCaseToken(token): string|null`.
- Internal runtime state and DOM continue to use case ids.

- [ ] **Step 1: Add slug-contract RED tests.** Add controlled invalid fixtures for malformed slug, non-array/empty aliases, duplicate alias, alias equal to own id/canonical slug, canonical/alias collision with another case id, and collision involving a disabled case. Add a valid custom-slug fixture asserting stable file/id/cardOrder/data-id plus canonical href, data metadata, and featured JSON-LD URL. The mutation each test catches is an ambiguous or malformed route being accepted or an internal id changing with the URL.

- [ ] **Step 2: Verify RED.** Run `node tests/quality/content-validate.test.mjs` and `node tests/quality/content-visibility.test.mjs`. Require failures because slug fields are neither validated nor emitted.

- [ ] **Step 3: Implement the Node slug canon.** Create `case-slug.mjs` with the exact interfaces. In `validateContent()`, collect every case route token across enabled and disabled cases and reject cross-case collisions. Reject explicit `slug===id`; an absent slug remains valid. Keep `featuredWorks[].id`, filenames, paths, and `cardOrder` internal.

- [ ] **Step 4: Generate public metadata.** Emit `slug` on every `CARDS_DATA[id]` entry and `legacySlugs` only when non-empty. Render grid `href` and featured-work JSON-LD with the canonical slug while retaining `data-id=id`. Re-export route expectations and extend `verify-frozen.js` to compare content-derived keys, metadata, hrefs, and JSON-LD.

- [ ] **Step 5: Verify generator GREEN and regenerate.** Run the two Step 2 commands, `npm run content:generate`, and `npm run content:check`. Recapture golden fixtures through the repository capture script because `CARDS_DATA` gains slug metadata; verify current grid URLs remain unchanged when slug is absent.

- [ ] **Step 6: Add runtime RED scenarios.** Intercept a controlled cards payload and grid with one custom canonical slug and one legacy alias. Across Original, Specimen, Chamber, and Hybrid assert that canonical slug, legacy alias, and stable id all open one internal case; aliases canonicalize; next/previous, case links, and Copy Link emit only canonical `#slug`; the root bootstrap still keeps the first-case root behavior.

- [ ] **Step 7: Verify runtime RED.** Run the focused new scenarios in `design-modes.spec.mjs`. Require failure because current routing treats the fragment as an exact id.

- [ ] **Step 8: Implement runtime resolution.** Add the two `CodexCase` methods. Decode malformed hashes safely, never interpolate unresolved tokens into selectors, keep `currentCaseId` internal, and canonicalize only explicit case routes. Update Specimen and Chamber/Hybrid links and initial-route resolution through the shared methods.

- [ ] **Step 9: Add admin RED scenarios.** Add `admin-slugs.spec.mjs` to `test:admin`. Assert a read-only internal id, optional canonical field, full URL preview, newline/tag alias editor, automatic preservation of a previous custom canonical slug, clearing a custom slug back to id while preserving the old custom slug, and anchored Russian collision/grammar errors that block publish. Assert CTA stays a separate field.

- [ ] **Step 10: Verify admin RED.** Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npx playwright test tests/quality/admin-slugs.spec.mjs --workers=1`. Require failure because the fields do not exist.

- [ ] **Step 11: Implement admin mirror and preview.** Mirror the regex/token rules in `state.js`. Make `validateAll()` asynchronous, load the full catalog, overlay loaded/orphan drafts, and detect global collisions before publish; change the publish call site to `await State.validateAll()`. Add the Public URL section and preserve the prior effective canonical slug on commit unless it is the stable id. Include route metadata in preview `CARDS_DATA`, draft card hrefs, and preview featured JSON-LD.

- [ ] **Step 12: Verify GREEN.** Run the focused runtime/admin tests, `npm run test:content-validate`, `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:admin`, and `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:design-lab`.

- [ ] **Step 13: Commit.** Commit only Task 2 as `feat(admin): add safe public case slugs`.

### Task 3: Content-backed contact, Organization, featured works, and Free Assets JSON-LD

**Files:**

- Modify: `content/meta.json`
- Modify: `scripts/generate-content.mjs`
- Modify: `admin/js/state.js`
- Modify: `admin/js/ui.js`
- Modify: `admin/js/preview.js`
- Modify: `js/design-specimen.js`
- Modify: `verify-frozen.js`
- Modify: `tests/quality/content-validate.test.mjs`
- Modify: `tests/quality/content-visibility.test.mjs`
- Modify: `tests/quality/admin-smoke.spec.mjs`
- Modify: `tests/quality/admin-preview.spec.mjs`
- Generate via command: public HTML/JSON-LD, sitemap/golden fixtures as applicable

**Interfaces:**

- `content/meta.json` gains:

```json
{
  "contactUrl": "https://t.me/WhiteCatWeb",
  "structuredData": {
    "organization": {
      "name": "Codex Studio",
      "alternateName": "Codex",
      "url": "https://codex.promo/",
      "description": {
        "en": "Remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender.",
        "ru": "Удалённая студия 3D-дизайна: hard surface моделирование, продуктовая визуализация и game-ready ассеты."
      },
      "sameAs": ["https://t.me/WhiteCatWeb"]
    },
    "featuredWorks": []
  }
}
```

- `contactUrl` and every `sameAs` entry are validated credential-free HTTPS URLs with no control characters; `sameAs` is unique.
- Organization name, alternate name, canonical URL, and both descriptions are non-empty plain text.
- Free Assets JSON-LD is derived from every visible item in every visible category in content order. Name is `item.title`, description is `item.desc.en`, URL/id/category/thumbnail/model/archive facts come from existing validated fields and real files; optional formats are omitted when they cannot be derived honestly.

- [ ] **Step 1: Add metadata RED tests.** In generator sandboxes, mutate contact URL, Organization values, sameAs, featured order/about, and a visible Free Assets title/description/category. Assert all visible anchors and JSON-LD follow the fixture. Add negative credentialed/non-HTTPS/control-character/duplicate sameAs and empty Organization fixtures. Assert no fixed FA id allowlist remains behaviorally: a synthetic visible item appears without code changes, while a hidden item does not.

- [ ] **Step 2: Verify RED.** Run `node tests/quality/content-validate.test.mjs` and `node tests/quality/content-visibility.test.mjs`. Require failures against the current hardcoded contact/Organization/FA map.

- [ ] **Step 3: Add the content schema and generator validation.** Populate current production values exactly as shown in the interface. Mirror URL/plain-text/sameAs/featured validation in generator and admin state. Keep `ogImages.orgLogo` as the Organization logo source and keep fixed technical SEO fields code-owned.

- [ ] **Step 4: Generate all contact surfaces and Organization JSON-LD.** Add narrow generated contact-anchor regions for `#contact-btn` and `#contact-pill` on both public pages. Make Specimen read the generated contact anchor rather than a literal. Build Organization and publisher names/URLs from content; use the English description in static JSON-LD while retaining RU editability for future locale output.

- [ ] **Step 5: Remove hardcoded FA editorial mirrors.** Delete `FA_JSONLD_CATEGORY`, `FA_JSONLD_COPY`, and verifier id mirrors. Flatten visible categories/items in content order and generate an ItemList entry for each visible item from editable content. Preserve honest thumbnail/contentSize/contentUrl behavior based on actual files and retain CC0/isAccessibleForFree. Derive verification expectations from content.

- [ ] **Step 6: Add admin RED tests.** Assert the Meta screen exposes contact URL, Organization identity/descriptions/sameAs, and an editable/reorderable featured-work list whose case choices derive from `State.loadCatalog()`. Assert preview contact anchors and JSON-LD reflect drafts.

- [ ] **Step 7: Verify admin RED.** Run focused `admin-smoke` and `admin-preview` tests and require the new fields to be missing.

- [ ] **Step 8: Implement Meta editor and preview.** Reuse current pair/URL/list/reorder components. Keep featured ids internal and `about` editable. Preview must rebuild contact anchors, Organization JSON-LD, and featured URLs using Task 2 canonical slugs.

- [ ] **Step 9: Regenerate, recapture, and verify GREEN.** Run `npm run content:generate`, the Step 2 tests, focused admin tests, `npm run content:check`, `npm run test:content-validate`, and `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:golden`.

- [ ] **Step 10: Commit.** Commit only Task 3 as `feat(admin): edit global site identity`.

### Task 4: Durable source-SHA-bound publication settlement and recovery

**Files:**

- Create: `tests/quality/admin-publication.spec.mjs`
- Modify: `tests/quality/fixtures/admin-harness.mjs`
- Modify: `package.json`
- Modify: `admin/js/state.js`
- Modify: `admin/js/api.js`
- Modify: `admin/js/ui.js`
- Modify: `admin/index.html`
- Modify: `admin/css/admin.css`
- Modify: `.github/workflows/content-publish.yml`

**Interfaces:**

- Session key: `codexAdminPublication`, envelope version `1`.
- State phases: `submitting`, `awaiting_pipeline`, `published`, `reverted`, `timed_out`, `failed`.
- `AdminState` adds:
  - `createPublicationSnapshot(plan): PublicationRecord`.
  - `attachPublicationSource({ sha, date }): PublicationRecord`.
  - `getPublication(): PublicationRecord|null`.
  - `settlePublication(outcome): Promise<PublicationRecord>`.
  - `restorePublicationSnapshot(): Promise<{ restored: string[], reupload: string[] }>`.
  - `dismissPublication(): void`.
- `AdminAPI.waitForPipeline(sourceSha, sinceIso)` accepts a full 40-hex source SHA and recognizes only bot commit messages containing `[source:<sha>]` plus a terminal publish/revert marker.
- Bot messages are exactly suffixed with `[source:${github.event.after}]` on both successful generation and auto-revert commits.

- [ ] **Step 1: Add publication state-machine RED tests.** Mock the GitHub API and pipeline. Assert: no draft is promoted/cleared immediately after source commit; success settles and clears once; revert preserves/restores JSON; timeout remains unsettled and requires re-check; unrelated newer bot commits are ignored; reload resumes the source-bound record; concurrent base mismatch blocks restore; binary records after reload are listed for re-upload rather than claimed recovered.

- [ ] **Step 2: Verify RED.** Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npx playwright test tests/quality/admin-publication.spec.mjs --workers=1`. Require failure because publication is transient and source-unbound.

- [ ] **Step 3: Make workflow outcomes attributable.** Pass `${{ github.event.after }}` as `SOURCE_SHA` to the generation and revert commit steps and add `[source:$SOURCE_SHA]` to both bot commit messages. Preserve the existing `[content-publish]`/`[content-publish-revert]` markers so workflow guards and history remain compatible.

- [ ] **Step 4: Implement the ledger and recovery contract.** Snapshot changed paths with base JSON/base SHA/effective draft plus serializable staged-media descriptors before `API.publish()`. Never write `File`, `ArrayBuffer`, blob URL, or PAT into storage. After source creation attach its SHA/date and keep edits locked against a second publish until terminal settlement. On same-tab revert retain in-memory staged bytes; after reload restore JSON only and report each binary path that must be uploaded again. Before restore, fetch the current GitHub base and require it to equal the saved pre-publish base.

- [ ] **Step 5: Bind API polling to source SHA.** Validate the full SHA, inspect recent main commits, and accept only an exact `[source:<sha>]` marker. Return `{ status, sha, url, message }`; a timeout remains `timed_out`, not failure.

- [ ] **Step 6: Add the Publication UI.** Add a top-nav `#/publication` route using existing card/button/status styles. Show source commit, current phase, timestamps, terminal generated/revert commit, failure reason, and actions “Проверить статус”, “Восстановить черновик”, and “Скрыть завершённую запись” when applicable. Replace the inaccurate `~2 minutes` success copy with observed timestamps and “Open production” only after success. Resume unsettled records after login/reload.

- [ ] **Step 7: Verify GREEN.** Run the focused publication test and full `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:admin`. Inspect storage payloads to prove tokens and binary bytes are absent.

- [ ] **Step 8: Commit.** Commit only Task 4 as `feat(admin): preserve publication recovery state`.

### Task 5: Current-design media workflow and admin accessibility hardening

**Files:**

- Modify: `tests/quality/admin-case-media.spec.mjs`
- Modify: `tests/quality/admin-order-visibility.spec.mjs`
- Modify: `tests/quality/admin-preview.spec.mjs`
- Modify: `tests/quality/admin-smoke.spec.mjs`
- Modify: `admin/index.html`
- Modify: `admin/js/preview.js`
- Modify: `admin/js/ui.js`
- Modify: `admin/css/admin.css`

**Interfaces:**

- Preview uses native `<dialog id="preview-overlay">`, `showModal()`, `close()`, one cleanup path, and focus return to the actual invoker.
- `pairField()` produces stable control ids and visible associated labels; generic input/select helpers expose equivalent names.
- Media controls retain all existing `data-field` paths and `case.media[]` schema.
- Wide media grid maximum is three columns; medium is two; narrow is one. No new token palette or pixel font-size literal.

- [ ] **Step 1: Add media-layout/workflow RED tests.** Open a controlled six-block case. Assert no more than three media cards share a row at wide admin width, each card owns its caption label/description fields, technical details use a disclosure, the repeated seamless paragraph exists once per section, and reorder preserves media/caption/seamless identity plus focused control.

- [ ] **Step 2: Add accessibility RED tests.** Assert preview background is unreachable while open, Escape/Close use one cleanup path and return focus to the invoker, exactly one active nav link has `aria-current="page"`, representative pair/select/CTA/technical controls have accessible names, `#app` is not a live region, disclosures have controlled-region ids, and hidden-row functional text passes the existing contrast/axe gate.

- [ ] **Step 3: Verify RED.** Run focused admin case-media, order, preview, and smoke suites. Require failures for the current five-column/separate-caption/custom-dialog/unlabelled behavior.

- [ ] **Step 4: Recompose each media card.** Move its existing caption pair fields into `mediaSlotEditor()` without changing paths. Keep preview/status primary; place type/format/seamless/path/hints in native `<details>` and open caption details when non-empty or invalid. Keep the stable figcaption as a non-interactive slot label. Preserve Sortable, arrow fallback, `moveMediaSlot`, index remapping, staging-ticket remapping, manual-layout confirmation, and seamless-chain rules.

- [ ] **Step 5: Apply current-design responsive CSS.** Change only layout/composition rules using existing variables, borders, radii, spacing, and button styles. Set explicit three/two/one column behavior and enlarge reorder targets without a new visual system or new hardcoded color/font-size budget.

- [ ] **Step 6: Convert preview to a native modal.** Replace the custom div with a styled `<dialog aria-labelledby="preview-title">`. Store the opening element, call `showModal()`, handle `cancel` and Close through one idempotent cleanup that invalidates generation, blanks iframe, revokes blob URLs, restores scroll, closes dialog, and focuses the connected invoker.

- [ ] **Step 7: Label and announce deliberately.** Add stable `for`/`id` or `aria-labelledby` relationships in field helpers, `aria-current` in `setActiveNav()`, controlled ids for disclosures, and remove app-wide `aria-live`. Keep discrete toast status/error announcements. Update draft copy with saved-at tab scope and a separate count of memory-only uploads; expose Review changes and Discard draft through existing publish/draft components.

- [ ] **Step 8: Verify GREEN.** Run all Step 3 suites, `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:admin`, and `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run verify`. Require `0 FAIL` and no new axe violations.

- [ ] **Step 9: Visual comparison.** Capture the six-block editor at the same desktop width as the supplied evidence and a narrow admin viewport. Compare against the current design tokens and ensure no cropped previews, orphaned sixth-card layout, broken spacing, or control overflow. Do not create or publish a Figma file.

- [ ] **Step 10: Commit.** Commit only Task 5 as `feat(admin): improve media editing workflow`.

### Task 6: Integrate, review, document, and open the draft PR

**Files:**

- Modify: `docs/admin-guide.md`
- Modify: `docs/agent/admin-panel/tz.md`
- Modify: `docs/agent/admin-panel/handoff.md`
- Modify: `docs/agent/verification.md`
- Modify: `plugins/codex-studio-codex/skills/codex-studio-admin-rules/SKILL.md`
- Generate through command only: `.claude/skills/**` mirrors if the canonical skill changes
- Create after repository release evidence: `1-Projects/codex/Sessions/2026-08-22-admin-cache-slugs-evolution.md` in Second-brain
- Modify after repository release evidence: `1-Projects/codex/Sessions/_INDEX.md` or its active shard and `1-Projects/codex/_INDEX.md` in Second-brain

**Interfaces:**

- Documentation names versioned generated payloads, stable id/public slug separation, source-SHA publication recovery, current media workflow, and Release B/C deferrals.
- The final branch contains no unresolved Critical/Important or BLOCKER/MAJOR review finding.

- [ ] **Step 1: Update active guidance.** Document the generated data revision contract, the rule that cache proof uses a normal returning-browser reload, slug/id/alias semantics, publication recovery limitations for binary uploads after reload, and the revised media editor. Add a dated superseding handoff entry; do not rewrite historical journal entries.

- [ ] **Step 2: Sync harness only if canonical skills changed.** Run `npm run sync:harness`, inspect the generated mirror diff, then run `npm run check:parity` and `npm run codex:verify-plugin`.

- [ ] **Step 3: Run focused integration gates.** Run `npm run content:check`, `npm run check:assets`, `npm run test:content-validate`, `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:golden`, `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:admin`, and `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run test:design-lab`.

- [ ] **Step 4: Run the full ship gate fresh.** Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/codex-pw-browsers npm run codex:ship`. Read the complete output and require exit `0` plus `0 FAIL` where reported.

- [ ] **Step 5: Run Spec Guardian and Quality Gate reviews.** Review frozen architecture, script order, i18n, lazy 3D, admin storage boundary, SEO/JSON-LD derivation, keyboard behavior, contrast, responsive layout, and the returning-browser cache regression. Resolve every BLOCKER/MAJOR finding and rerun affected commands.

- [ ] **Step 6: Run a whole-branch code review.** Compare the merge base with HEAD against this plan/spec. Dispatch one consolidated Terra fix wave for any real findings, then one scoped re-review. The controller independently checks the final diff and verification evidence.

- [ ] **Step 7: Check release allowlists and commit docs.** Read `DO_NOT_PUSH.md`, inspect `git status --short --branch`, and commit only intended repository files.

- [ ] **Step 8: Push and open a draft PR.** Push `codex/admin-evolution` and open a draft PR to `main` describing root cause, each independently releasable task, red/green evidence, remaining Release B/C scope, and production acceptance criteria. Do not merge automatically.

- [ ] **Step 9: Record Second-brain evidence.** Pull Second-brain before editing. Write a scoped session note with branch/PR/commit/check evidence and update only the canonical project/session indices. Run the vault-prescribed checks, commit its exact allowlist, and push according to its repository rules.

- [ ] **Step 10: Final report.** Report the PR URL, commit range, focused/full verification outputs, production/manual acceptance still pending until merge/deploy, and explicit Release B/C deferrals. Do not claim production fixed before the PR is merged and the normal returning-browser scenario is observed.
