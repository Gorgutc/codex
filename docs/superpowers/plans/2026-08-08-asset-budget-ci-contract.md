# Asset Budget And CI Contract Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the deterministic asset-policy CI failure, move the model advisory threshold to 25 MiB without weakening any hard limit, and make the existing 3D verification wait for the heaviest visible referenced model deterministically.

**Architecture:** Keep `scripts/asset-budget.mjs` as the Node-side policy canon and `admin/js/state.js` as the intentional classic-script mirror. Add narrow audit coverage for model warning parity and blueprint hard-limit parity, derive both admin model hints from the mirror, and strengthen only the Playwright harness in `verify-frozen.js`; shipped viewer/runtime code and binary assets remain unchanged. The owner-approved measured runtime contract uses a 120-second target and one 210-second absolute scenario ceiling.

**Tech Stack:** Node.js ESM policy scripts, vanilla classic JavaScript admin UI, Playwright, Markdown project instructions, GitHub Actions.

**Global Constraints:** Preserve repository hard limits exactly: model 50 MiB, HDR 4 MiB, video 40 MiB, vector 2 MiB, raster 2 MiB, and download warn-only. Model size-warning semantics are exactly `<= 25 MiB` no warning, `(25, 50] MiB` warning, and `> 50 MiB` block. Repository vector/raster warnings remain 256 KiB; admin generic-image warnings remain 200 KiB; admin blueprint warnings remain 500 KiB. Exactly 2 MiB remains allowed. Preserve lazy loading, extension/MIME/path/CSP/rendering/publish-revert protections. Do not edit binary assets, content JSON, generated content data, deployment behavior, `js/model-data.js`, shipped viewer runtime, archived Claude references, or generated `.claude/**` files by hand. The only workflow edit is a comment-only correction in `content-publish.yml`; run `npm run sync:harness` after canonical skill edits and `npm run codex:ship` before commit or push. The current owner request explicitly authorizes readying and merging the PR, pushing the merged repository, and committing/merging/pushing the Second Brain update; no further integration-choice prompt is required.

---

## Task 1: Pin and implement the canonical and admin asset contracts

**Files:**

- Modify: `tests/quality/asset-budget.test.mjs`
- Modify: `scripts/asset-budget.mjs`
- Modify: `scripts/asset-budget-audit.mjs`
- Modify: `admin/js/state.js`
- Modify: `verify-frozen.js` only for the static asset-audit result wording

- [ ] Run `npx playwright test tests/quality/admin-media.spec.mjs --workers=1` before any production edit and record the existing RED fingerprint `Expected < 2097152, Received 2097152`.
- [ ] Add explicit test assertions for the model warning value (`25 * MiB`), model hard value (`50 * MiB`), the complete hard-limit map, exact boundary behavior, model warning mirror parity, and `blueprint -> vector` hard-limit coverage.
- [ ] Run `node tests/quality/asset-budget.test.mjs` and record the intentional RED caused by the still-live 15 MiB threshold or missing mirror coverage.
- [ ] Change only the model warning threshold in `scripts/asset-budget.mjs` and `admin/js/state.js` from 15 MiB to 25 MiB; update their executable-policy comments and Russian warning copy without changing hard stops.
- [ ] Add `blueprint: 'vector'` and focused model `warnBytes` parity to `scripts/asset-budget-audit.mjs`; correct stale audit prose while retaining slot-specific advisory differences.
- [ ] Update the static asset-audit success detail in `verify-frozen.js` to state that hard limits and the model warning match.
- [ ] Run `node tests/quality/asset-budget.test.mjs` and `npm run check:assets`; require GREEN with zero hard-limit violations and no model-size warning for the current 22,908,588-byte GLB.
- [ ] Self-review `git diff` for accidental changes to HDR/video/vector/raster/download hard limits.

## Task 2: Replace the false cross-class test and prove admin upload/UI boundaries

**Files:**

- Modify: `tests/quality/admin-media.spec.mjs`
- Modify: `tests/quality/admin-case-blueprints.spec.mjs`
- Modify: `tests/quality/admin-free-assets.spec.mjs`
- Modify: `admin/js/ui.js`

- [ ] Replace the `vector < raster` premise with independent SVG and raster checks: exactly 2 MiB accepted and 2 MiB + 1 byte rejected for each class; pin model `warnText` to 25 MiB and `blockText` to 50 MiB.
- [ ] Add a blueprint upload test proving an SVG above 2 MiB is rejected before pending media or publish-tree mutation while existing path, SVG, `<img>`, and CSP coverage remains intact.
- [ ] Add assertions that both case-editor and Free Assets model screens show guidance derived from `State.getMediaRule('model')`; run `npx playwright test tests/quality/admin-media.spec.mjs --workers=1` and `npx playwright test tests/quality/admin-free-assets.spec.mjs --workers=1` before the UI edit and record the intended RED for stale 15/50 copy.
- [ ] Add `formatMiB(bytes)` and `modelUploadHint(suffix = '')` in `admin/js/ui.js`. `formatMiB` returns an integer MiB label from exact binary byte thresholds; `modelUploadHint` calls `State.getMediaRule('model')` and returns `Только GLB · до <warn> МБ (жёсткий предел <block> МБ)<suffix>`. Use it for both model drop zones without changing upload behavior.
- [ ] Run `npx playwright test tests/quality/admin-media.spec.mjs --workers=1`, `npx playwright test tests/quality/admin-case-blueprints.spec.mjs --workers=1`, and `npx playwright test tests/quality/admin-free-assets.spec.mjs --workers=1`; require GREEN.
- [ ] Run `npm run test:admin`; require GREEN and confirm no replacement of normal upload safety assertions.

## Task 3: Make the heaviest-model 3D smoke deterministic

**Files:**

- Modify: `verify-frozen.js`
- Create: `scripts/model-runtime-contract.cjs`
- Create: `tests/quality/model-runtime-contract.test.mjs`
- Modify: `tests/quality/verify-frozen-fatal-exit.test.mjs`
- Modify: `package.json`
- Modify: `eslint.config.mjs`

- [ ] Define the shared runtime contract in `scripts/model-runtime-contract.cjs`, including `MODEL_RUNTIME_TARGET_MS = 120_000`, `MODEL_RUNTIME_TIMEOUT_MS = 210_000`, absolute-deadline handling, general-model planning, context-loss classification, and outcome validation. Derive a module-scope `HEAVIEST_MODEL_CASE` object `{ caseId, publicPath, bytes }` from visible current content plus `fs.statSync`; fail setup if no visible referenced local model exists.
- [ ] Keep the existing motion-case checks independent, but ensure the 3D smoke opens the derived heaviest case before asserting lazy-before-click; if the case differs, navigate through the normal UI and wait for its case title.
- [ ] Implement `runHeaviestModelSmoke(page)` so the exact-GLB `page.waitForResponse`, normal 3D-tab click, readiness selector, and normal Clay/Xray/PBR interactions all consume one absolute `MODEL_RUNTIME_TIMEOUT_MS` deadline; require response status 200-299 and verify `.is-on` plus `aria-pressed` after every material click.
- [ ] Remove the old 800 ms assumption plus swallowed 5,000 ms canvas wait. Record `responseMs`, `readyMs`, each material interaction, total time, and WebGL context loss; do not use `force: true` or DOM clicks.
- [ ] Always emit named `CASE-3d-heaviest-model-ready` and `CASE-3d-heaviest-model-runtime` results with case id, path, bytes, status, and timings. Mark a successful total above 120 seconds with literal `PERF_WARN`; fail above 210 seconds or on non-2xx, missing readiness, wrong state, page error, or unexpected viewer context loss. Record but exclude the intentional `WEBGL_lose_context` capability-probe release by matching its instrumented canvas id.
- [ ] Run generic viewer/pagination checks first on the primary page using the smallest visible referenced model. Run the heaviest-model contract last on a dedicated normal-motion page and close it after the return to PBR so Corten's continuous render loop cannot starve unrelated Playwright actions.
- [ ] Let the generic helper accept the existing `model-data.js` inline resolution for small models; keep the exact 2xx HTTP response requirement on the external heaviest GLB.
- [ ] Pin the 120/210-second boundaries, same-model generic fallback, non-2xx, never-ready, wrong-material, page/console error, context-loss, and actual never-resolving watchdog failure modes in `tests/quality/model-runtime-contract.test.mjs`; keep the fatal-exit fixture self-contained by copying the shared contract beside its temporary verifier.
- [ ] Record the exact 180,008 ms ceiling failure that triggered the owner-authorized remeasurement; do not add retry-on-timeout and do not expand the final 210-second ceiling again in this task.
- [ ] Run `npm run verify` twice locally, then use the `verify` inside `codex:ship` as the third consecutive local proof. A failure above the measured ceiling or a state/context error stops this task as a separate runtime/model blocker rather than further expanding the timeout or changing shipped runtime.
- [ ] Run `npm run test:verify-fatal` and `npm run test:design-lab`; require GREEN before proceeding.

## Task 4: Update owner guidance and active instruction routes

**Files:**

- Modify: `docs/superpowers/specs/2026-08-08-asset-budget-ci-contract-design.md`
- Modify: `README.md`
- Modify: `.github/workflows/content-publish.yml`
- Modify: `AGENTS.md`
- Modify: `docs/admin-guide.md`
- Modify: `docs/agent/admin-panel/research.md`
- Modify: `docs/agent/verification.md`
- Modify: `docs/agent/admin-panel/tz.md`
- Modify: `docs/agent/admin-panel/handoff.md`
- Modify: `.agents/skills/codex-studio-assets/SKILL.md`
- Modify: `plugins/codex-studio-codex/skills/codex-studio-rules/SKILL.md`
- Modify: `plugins/codex-studio-codex/skills/codex-studio-admin-rules/SKILL.md`
- Modify: `plugins/codex-studio-codex/skills/codex-studio-frontend-rules/SKILL.md`
- Generate only via command: matching `.claude/skills/**` mirrors

- [ ] Mark the approved design status accurately and add only a canonical-budget pointer plus `npm run check:assets` to `AGENTS.md` without duplicating numbers there.
- [ ] Document the exact disjoint advisory bands and strict upper-bound semantics in the owner/admin/verification docs; add a new superseding handoff entry instead of rewriting historical 15/50 text.
- [ ] Update the active asset/admin/rules/frontend skills to route current asset work to live policy code and current verification; leave `references/claude-original/` unchanged.
- [ ] Remove active one-year immutable/Netlify-production claims while preserving the conditional Netlify OAuth/preview path; document `deploy-beget` as the production mirror.
- [ ] Add a dated superseding carrier note to the active admin research so its original Netlify-era decision cannot be mistaken for current production policy.
- [ ] Run `npm run sync:harness` and inspect the generated mirror diff; reject any unrelated generated change.
- [ ] Run `npm run check:parity`, `npm run codex:verify-plugin`, `npm run check:governance`, `npm run check:markdown`, and `npm run check:spelling`; require GREEN.

## Task 5: Integrate, review, publish, and record release evidence

**Files:**

- Verify all changed repository files
- Modify: `tests/quality/design-modes.spec.mjs`
- Modify: `tests/quality/content-visibility.test.mjs`
- Create after repository merge: `1-Projects/codex/Sessions/2026-08-08-asset-budget-ci-contract.md` in the Second Brain repository
- Modify after repository merge: the appropriate `1-Projects/codex/Sessions/_INDEX*.md` shard and `1-Projects/codex/_INDEX.md` in Second Brain

- [ ] Run `npm run test:content-validate`, `npm run test:admin`, `npm run verify`, and fresh full `npm run codex:ship`; require exit 0 and `0 FAIL` where reported.
- [ ] Replace the independent stale Hybrid premise exposed by current main (`inlineOverlayCount === 1` whenever any tall media exists) with the real invariant: inline copy appears exactly once, either as the pinned overlay or as the existing full-width fallback when manual layout pairs all tall media. Keep the dedicated overlay-geometry test unchanged and require the previously red focused test to pass.
- [ ] Keep generic Design Lab 3D transition tests on the smallest visible referenced model; the dedicated `verify-frozen.js` contract remains the sole heaviest-model runtime proof. This prevents a large decode/render loop from starving unrelated click assertions without skipping 3D behavior.
- [ ] Make the independent blueprint generator self-test construct its own zero-blueprint baseline before adding one sheet carrier; do not infer an empty fixture from the live catalog now that Corten legitimately carries authored sheets.
- [ ] Run a whole-branch independent `/review` against this plan and the approved design; resolve every Critical/Important or BLOCKER/MAJOR finding and re-run affected tests.
- [ ] Commit the scoped implementation, push `codex/asset-budget-ci-contract`, and open a draft PR to `main` with root cause, policy changes, runtime-harness change, and fresh validation evidence.
- [ ] Wait for the PR `quality` check to finish; if red, inspect the current run logs and fix only a demonstrated in-scope cause. A persistent runtime/model failure or unrelated out-of-scope failure invokes the approved stop rule and is reported for a separate decision instead of expanding scope automatically.
- [ ] Mark the PR ready if required by repository policy, merge it into `main`, update local `main`, and verify the merge SHA and post-merge workflows/deployment rather than inferring them from the PR check.
- [ ] Pull the Second Brain repository, write a scoped session note with exact repo branch/PR/merge SHA/check/deploy evidence, update its session index and canonical project status, and run the vault-prescribed verification.
- [ ] Commit the exact Second Brain allowlist, push its task branch if one is required, merge to its default branch, and push the merged result; verify remote equivalence.
- [ ] Report repository and vault commit/merge/push state, CI/deploy outcomes, warnings that remain intentional, and explicit defers (`none` unless a separately scoped runtime blocker was encountered).
